import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GitCompareArrows,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Contact } from "../../../types";
import SearchableSelect from "../../SearchableSelect";
import {
  fetchContactById,
  fetchContacts,
} from "../../../services/customerDatabaseLocalApiService";
import {
  executeCustomerMerge,
  previewCustomerMerge,
  type CustomerMergePreview,
} from "../../../services/duplicateCustomerService";
import { shouldSuppressAuthError } from "../../../services/localApiAuth";
import { useToast } from "../../ToastProvider";

const PAGE_TUTORIAL_STEPS = [
  {
    title: "Choose customer A",
    body: "Search the live customer directory and choose the first record to compare.",
    target: "[data-tutorial='customer-a-select']",
  },
  {
    title: "Choose customer B",
    body: "Search for the second customer. The same customer cannot be selected in both cards.",
    target: "[data-tutorial='customer-b-select']",
  },
  {
    title: "Compare the actual records",
    body: "This is the live comparison for the selected pair. Customer A and B are separated by color; amber rows differ and muted rows match. Review the actual values before making a merge decision.",
    target: "[data-tutorial='customer-diff']",
  },
  {
    title: "Open the merge controls",
    body: "Open the merge controls for your selected pair. The next step lets you choose which customer record and company name will survive.",
    target: "[data-tutorial='match-review']",
  },
  {
    title: "Choose the customer record that survives",
    body: "Choose A or B. That record and company name will remain, and become the destination for the other customer’s transferred history and transactions.",
    target: "[data-tutorial='survivor-select']",
  },
  {
    title: "Explain why these records are duplicates",
    body: "The survivor’s company name will be retained. Enter a clear reason for the audit trail before previewing." ,
    target: "[data-tutorial='merge-reason']",
  },
  {
    title: "Preview before any changes happen",
    body: "Click this to check what will transfer. Nothing is merged by the preview. If a required field decision is needed, the preview will tell you what to resolve.",
    target: "[data-tutorial='preview-merge']",
  },
  {
    title: "Review the real merge preview",
    body: "Check the actual record counts, financial totals, warnings, and any conflicting values shown here. Resolve each required choice and preview again before confirming.",
    target: "[data-tutorial='merge-preview']",
  },
  {
    title: "Confirm only after reviewing everything",
    body: "For an executable preview, type the exact phrase shown. This is the final safeguard before the merge runs.",
    target: "[data-tutorial='merge-confirmation']",
  },
  {
    title: "Run the customer merge",
    body: "This permanently performs the reviewed merge. Use it only after confirming the survivor and its company name, transferred history, totals, and decisions are correct.",
    target: "[data-tutorial='confirm-merge']",
  },
];

type SpotlightBounds = { top: number; left: number; width: number; height: number };

const contactLocation = (contact: Contact): string =>
  [contact.address, contact.city, contact.province]
    .filter(Boolean)
    .join(", ") || "—";

const contactPhone = (contact: Contact): string =>
  [contact.mobile, contact.phone].filter(Boolean).join(" · ") || "—";

const mergeFieldValue = (
  contact: Record<string, unknown> | undefined,
  field: string,
): string => {
  if (!contact) return "Not available";
  const value =
    field === "vat_type"
      ? contact.lvat_type ?? contact.vat_type ?? contact.vatType
      : field === "terms"
        ? contact.lterms ?? contact.terms
        : field === "price_group"
          ? contact.lprice_group ?? contact.price_group ?? contact.priceGroup
          : field === "sales_person"
            ? contact.lsales_person ?? contact.sales_person ?? contact.salesman ?? contact.assignedAgent ?? "Unassigned"
            : "";
  return String(value || "Not set");
};

const mergeDecisionFieldValue = (
  record: Record<string, unknown> | undefined,
  contact: Contact | undefined,
  field: string,
): string => {
  if (field === "sales_person") {
    const salespersonName = contact?.salesman || contact?.assignedAgent;
    if (salespersonName) return salespersonName;
  }
  return mergeFieldValue(record, field);
};

const newMergeKey = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `merge-${crypto.randomUUID()}`;
  }
  return `merge-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const comparisonValue = (value: unknown): string => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "—";
  }
  return String(value);
};

const primaryContactPerson = (contact: Contact): string =>
  contact.contactPersons?.find((person) => person.enabled)?.name ||
  contact.contactPersons?.[0]?.name ||
  contact.name ||
  "—";

const DiffComparison: React.FC<{
  left: Contact;
  right: Contact;
  leftLabel: string;
  rightLabel: string;
  compact?: boolean;
  "data-tutorial"?: string;
}> = ({ left, right, leftLabel, rightLabel, compact = false, "data-tutorial": tutorialTarget }) => {
  const formatContactPersons = (contact: Contact): string =>
    contact.contactPersons?.length
      ? contact.contactPersons.map((person, index) => {
          const details = [
            person.position,
            person.telephone && `Tel: ${person.telephone}`,
            person.mobile && `Mobile: ${person.mobile}`,
            person.email,
            person.birthday && `Birthday: ${person.birthday}`,
          ].filter(Boolean);
          return `${index + 1}. ${person.name || "Unnamed contact"} (${person.enabled ? "Enabled" : "Disabled"})${details.length ? `\n   ${details.join(" · ")}` : ""}`;
        }).join("\n")
      : "—";
  const formatDeliveryAddresses = (contact: Contact): string =>
    [...new Set([contact.deliveryAddress, ...(contact.deliveryAddresses || [])].filter(Boolean))].join("\n") || "—";
  const formatComments = (contact: Contact): string =>
    contact.comments?.length
      ? contact.comments.map((comment, index) => `${index + 1}. ${comment.text}${comment.author ? ` — ${comment.author}` : ""}${comment.timestamp ? ` (${comment.timestamp})` : ""}`).join("\n")
      : "—";
  const rows = [
    ["Company name", left.company, right.company],
    ["Previous company name", left.pastName, right.pastName],
    ["Customer since", left.customerSince, right.customerSince],
    ["Team", left.team, right.team],
    ["Sales assignment", left.salesman || left.assignedAgent, right.salesman || right.assignedAgent],
    ["Referred by", left.referBy, right.referBy],
    ["Contact persons", formatContactPersons(left), formatContactPersons(right)],
    ["Primary contact", primaryContactPerson(left), primaryContactPerson(right)],
    [
      "Email",
      left.contactPersons?.[0]?.email || left.email,
      right.contactPersons?.[0]?.email || right.email,
    ],
    ["Phone", contactPhone(left), contactPhone(right)],
    ["Address", contactLocation(left), contactLocation(right)],
    ["Area", left.area, right.area],
    ["Delivery address(es)", formatDeliveryAddresses(left), formatDeliveryAddresses(right)],
    ["TIN", left.tin, right.tin],
    ["Business line", left.businessLine, right.businessLine],
    ["Payment terms", left.terms, right.terms],
    ["Transaction type", left.transactionType, right.transactionType],
    ["VAT type", left.vatType, right.vatType],
    ["VAT percentage", left.vatPercentage, right.vatPercentage],
    ["Price group", left.priceGroup, right.priceGroup],
    ["Price code", left.priceCode, right.priceCode],
    ["Discount code", left.discountCode, right.discountCode],
    ["Credit limit", left.creditLimit, right.creditLimit],
    ["Dealership terms", left.dealershipTerms, right.dealershipTerms],
    ["Dealership since", left.dealershipSince, right.dealershipSince],
    ["Dealership quota", left.dealershipQuota, right.dealershipQuota],
    ["Preferred brand", left.preferredBrand, right.preferredBrand],
    ["Ishinomoto dealer since", left.ishinomotoDealerSince, right.ishinomotoDealerSince],
    ["Ishinomoto signage since", left.ishinomotoSignageSince, right.ishinomotoSignageSince],
    ["Signage since", left.signageSince, right.signageSince],
    ["Customer code", left.codeText, right.codeText],
    ["Customer code date", left.codeDate, right.codeDate],
    ["Status", left.status, right.status],
    ["Verification", left.verification, right.verification],
    ["Customer status", left.customerStatus, right.customerStatus],
    ["Debt type", left.debtType, right.debtType],
    ["Hidden from lists", left.isHidden ? "Yes" : "No", right.isHidden ? "Yes" : "No"],
    ["Customer note", left.comment, right.comment],
    ["Recorded comments", formatComments(left), formatComments(right)],
    ["Duplicate override reason", left.duplicateOverrideReason, right.duplicateOverrideReason],
  ].map(([label, leftValue, rightValue]) => ({
    label,
    leftValue: comparisonValue(leftValue),
    rightValue: comparisonValue(rightValue),
  }));

  const differenceCount = rows.filter(
    ({ leftValue, rightValue }) =>
      leftValue.trim().toLowerCase() !== rightValue.trim().toLowerCase(),
  ).length;

  return (
    <div data-tutorial={tutorialTarget} className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
      <div className="min-w-[760px]">
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
        >
          <div>
            <p
              className={`${compact ? "text-xs" : "text-sm"} font-black text-slate-900`}
            >
              Customer record comparison
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Highlighted rows differ. Matching values are intentionally muted.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">
            {differenceCount}{" "}
            {differenceCount === 1 ? "difference" : "differences"}
          </span>
        </div>
        <div className="grid grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)] border-b border-slate-300 text-xs font-black uppercase tracking-wide text-white">
          <div
            className={`bg-slate-900 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
          >
            Field
          </div>
          <div
            className={`flex items-center gap-2 border-l-4 border-blue-300 bg-blue-800 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
          >
            <span
              className={`flex shrink-0 items-center justify-center rounded-full bg-white font-black text-blue-800 ${compact ? "h-5 w-5 text-xs" : "h-6 w-6 text-sm"}`}
            >
              A
            </span>
            <span>{leftLabel}</span>
          </div>
          <div
            className={`flex items-center gap-2 border-l-4 border-violet-300 bg-violet-800 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
          >
            <span
              className={`flex shrink-0 items-center justify-center rounded-full bg-white font-black text-violet-800 ${compact ? "h-5 w-5 text-xs" : "h-6 w-6 text-sm"}`}
            >
              B
            </span>
            <span>{rightLabel}</span>
          </div>
        </div>
        {rows.map(({ label, leftValue, rightValue }) => {
          const isDifferent =
            leftValue.trim().toLowerCase() !== rightValue.trim().toLowerCase();
          return (
            <div
              key={label}
              className="grid grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)] border-b border-slate-200 last:border-b-0"
            >
              <div
                className={`break-words bg-slate-50 text-xs font-bold text-slate-600 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
              >
                {label}
              </div>
              <div
                className={`whitespace-pre-wrap break-words border-l-4 border-blue-400 text-sm ${compact ? "px-3 py-2 text-xs" : "px-4 py-3"} ${isDifferent ? "bg-amber-50 font-semibold text-amber-950" : "bg-blue-50/60 text-slate-500"}`}
              >
                {leftValue}
              </div>
              <div
                className={`whitespace-pre-wrap break-words border-l-4 border-violet-400 text-sm ${compact ? "px-3 py-2 text-xs" : "px-4 py-3"} ${isDifferent ? "bg-amber-50 font-semibold text-amber-950" : "bg-violet-50/60 text-slate-500"}`}
              >
                {rightValue}
              </div>
            </div>
          );
        })}
        <div
          className={`flex items-center gap-2 bg-slate-50 text-xs text-slate-500 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
        >
          <GitCompareArrows className="h-4 w-4 shrink-0 text-amber-600" />
          Compare the highlighted fields before choosing the surviving customer
          below.
        </div>
      </div>
    </div>
  );
};

export default function DuplicateCustomersView() {
  const { addToast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [selectedBId, setSelectedBId] = useState("");
  const [selectedB, setSelectedB] = useState<Contact | null>(null);
  const [showMergeReviewModal, setShowMergeReviewModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [spotlightBounds, setSpotlightBounds] = useState<SpotlightBounds | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<CustomerMergePreview | null>(null);
  const [survivorId, setSurvivorId] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [fieldDecisions, setFieldDecisions] = useState<
    Record<string, "survivor" | "duplicate">
  >({});
  const [confirmation, setConfirmation] = useState("");
  const [mergeKey, setMergeKey] = useState("");
  const [merging, setMerging] = useState(false);
  const selectionSequence = useRef({ a: 0, b: 0 });
  const previewRequestSequence = useRef(0);
  const tutorialTargetSelector = PAGE_TUTORIAL_STEPS[tutorialStep]?.target;

  useEffect(() => {
    if (!showTutorial) {
      setSpotlightBounds(null);
      return;
    }

    let frame = 0;
    const selector = tutorialTargetSelector;
    const updateSpotlight = () => {
      if (!selector) return;
      const target = document.querySelector<HTMLElement>(selector);
      if (!target || target.matches(":disabled")) {
        setSpotlightBounds(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      setSpotlightBounds((previous) => {
        const next = {
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
        };
        if (
          previous &&
          Math.abs(previous.top - next.top) < 1 &&
          Math.abs(previous.left - next.left) < 1 &&
          Math.abs(previous.width - next.width) < 1 &&
          Math.abs(previous.height - next.height) < 1
        ) return previous;
        return next;
      });
    };

    const target = selector
      ? document.querySelector<HTMLElement>(selector)
      : null;
    target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    frame = window.requestAnimationFrame(updateSpotlight);
    const observer = new MutationObserver(updateSpotlight);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [showTutorial, tutorialStep, tutorialTargetSelector]);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    setError("");
    try {
      setContacts(await fetchContacts({ lightweight: true }));
    } catch (err) {
      if (!shouldSuppressAuthError(err))
        setError(
          err instanceof Error ? err.message : "Unable to load customers.",
        );
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const customerOptions = useMemo(
    () => contacts.filter((contact) => String(contact.id || "").trim()).map((contact) => ({
      value: String(contact.id),
      label: `${contact.company || "Unnamed customer"}${contact.mobile || contact.phone ? ` · ${contact.mobile || contact.phone}` : ""}`,
      keywords: [contact.name, contact.mobile, contact.phone, contact.address].filter(Boolean),
    })),
    [contacts],
  );

  const activeDuplicate = selectedB;
  const survivorContact =
    survivorId === String(selected?.id)
      ? selected
      : survivorId === String(activeDuplicate?.id)
        ? activeDuplicate
        : null;
  const finalName = survivorContact?.company || "";
  const canPreview = Boolean(
    selected &&
    activeDuplicate &&
    survivorId &&
    finalName.trim() &&
    mergeReason.trim(),
  );
  const tutorialCanAdvance =
    (tutorialStep === 0 && Boolean(selected)) ||
    (tutorialStep === 1 && Boolean(activeDuplicate)) ||
    (tutorialStep === 2 && Boolean(selected && activeDuplicate)) ||
    (tutorialStep === 4 && Boolean(survivorId)) ||
    (tutorialStep === 5 && Boolean(mergeReason.trim())) ||
    (tutorialStep === 6 && Boolean(preview)) ||
    (tutorialStep === 7 && Boolean(preview?.executable)) ||
    (tutorialStep === 8 && confirmation === "MERGE CUSTOMER RECORDS");

  const invalidateMergePreview = () => {
    previewRequestSequence.current += 1;
    setPreview(null);
    setConfirmation("");
    setError("");
  };

  const resetMerge = () => {
    previewRequestSequence.current += 1;
    setPreview(null);
    setSurvivorId("");
    setMergeReason("");
    setFieldDecisions({});
    setConfirmation("");
    setMergeKey("");
  };

  const selectCustomer = async (side: "a" | "b", id: string) => {
    const sequence = ++selectionSequence.current[side];
    setError("");
    if (side === "a") {
      if (id && id === selectedBId) {
        selectionSequence.current.b += 1;
        setLoadingB(false);
        setSelectedBId("");
        setSelectedB(null);
      }
      setLoadingA(Boolean(id));
      setSelected(null);
    } else {
      setLoadingB(Boolean(id));
      setSelectedBId(id);
      setSelectedB(null);
    }
    setShowMergeReviewModal(false);
    resetMerge();
    if (!id) {
      if (side === "a") setSelected(null);
      else { setSelectedBId(""); setSelectedB(null); }
      if (side === "a") setLoadingA(false);
      else setLoadingB(false);
      return;
    }
    if (side === "b" && id === String(selected?.id || "")) {
      setSelectedBId("");
      setLoadingB(false);
      return;
    }
    try {
      const contact = await fetchContactById(id);
      if (sequence !== selectionSequence.current[side]) return;
      if (!contact) throw new Error("Customer details could not be loaded.");
      if (side === "a") {
        setSelected(contact);
        if (showTutorial && tutorialStep === 0) setTutorialStep(1);
        if (selectedBId && selectedBId !== id) {
          setMergeKey(newMergeKey());
        }
      } else {
        if (showTutorial && tutorialStep === 1) setTutorialStep(2);
        setSelectedB(contact);
        setMergeKey(newMergeKey());
      }
    } catch (err) {
      if (sequence === selectionSequence.current[side] && !shouldSuppressAuthError(err))
        setError(err instanceof Error ? err.message : "Unable to load customer details.");
    } finally {
      if (sequence === selectionSequence.current[side]) {
        if (side === "a") setLoadingA(false);
        else setLoadingB(false);
      }
    }
  };

  const requestPreview = async () => {
    if (!selected || !activeDuplicate || !canPreview) return;
    const sequence = ++previewRequestSequence.current;
    setError("");
    setConfirmation("");
    const key = mergeKey || newMergeKey();
    setMergeKey(key);
    try {
      const result = await previewCustomerMerge({
        survivor_session_id: survivorId,
        duplicate_session_id:
          survivorId === String(selected.id)
            ? String(activeDuplicate.id)
            : String(selected.id),
        final_company_name: finalName.trim(),
        merge_reason: mergeReason.trim(),
        idempotency_key: key,
        field_decisions: fieldDecisions,
      });
      if (sequence !== previewRequestSequence.current) return;
      setPreview(result);
      if (showTutorial && tutorialStep === 6) setTutorialStep(7);
    } catch (err) {
      if (sequence !== previewRequestSequence.current) return;
      if (!shouldSuppressAuthError(err))
        setError(
          err instanceof Error ? err.message : "Unable to preview the merge.",
        );
    }
  };

  const executeMerge = async () => {
    if (
      !preview ||
      !preview.executable ||
      confirmation !== "MERGE CUSTOMER RECORDS"
    )
      return;
    setMerging(true);
    setError("");
    try {
      await executeCustomerMerge({
        survivor_session_id: preview.survivor_session_id,
        duplicate_session_id: preview.duplicate_session_id,
        final_company_name: preview.final_company_name,
        merge_reason: mergeReason.trim(),
        confirmation: "MERGE CUSTOMER RECORDS",
        idempotency_key: mergeKey,
        field_decisions: fieldDecisions,
      });
      addToast({
        type: "success",
        title: "Customer merge completed",
        description: `${preview.final_company_name} is now the surviving customer.`,
        durationMs: 5000,
      });
      selectionSequence.current.a += 1;
      selectionSequence.current.b += 1;
      setSelected(null);
      setSelectedBId("");
      setSelectedB(null);
      resetMerge();
      await loadContacts();
      if (showTutorial) setShowTutorial(false);
    } catch (err) {
      if (!shouldSuppressAuthError(err))
        setError(
          err instanceof Error ? err.message : "Unable to execute the merge.",
        );
    } finally {
      setMerging(false);
    }
  };

  return (
    <section className="h-full overflow-y-auto bg-[#f7f9fc] p-5 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-blue-700">
              <GitCompareArrows className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wide">
                Maintenance / Customer
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black">Duplicate Customers</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Select two customer records manually, compare their details, and review a complete merge preview before confirming.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMergeReviewModal(false);
                setTutorialStep(0);
                setShowTutorial(true);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100"
            >
              <BookOpen className="h-4 w-4" />
              How to use this page
            </button>
            <button
              type="button"
              onClick={() => void loadContacts()}
              disabled={loadingContacts}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingContacts ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </button>
          </div>
        </header>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Master User controlled merge.</strong> Every preview is
              tenant-scoped, stale-checked, audited, and fails closed when a
              safe transfer cannot be proven.
            </p>
          </div>
        </div>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        ) : null}
        {showTutorial ? (
          <>
            {spotlightBounds ? (
              <div
                aria-hidden="true"
                className="pointer-events-none fixed z-[60] rounded-xl border-4 border-cyan-300 shadow-[0_0_0_9999px_rgba(15,23,42,0.62)] ring-4 ring-cyan-500/40 transition-[top,left,width,height] duration-200"
                style={spotlightBounds}
              />
            ) : (
              <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-[59] bg-slate-950/45"
              />
            )}
            <aside
              aria-label="Duplicate customer page walkthrough"
              aria-live="polite"
              className="fixed bottom-4 left-1/2 z-[61] w-[min(94vw,36rem)] -translate-x-1/2 rounded-xl border border-blue-200 bg-white p-4 shadow-2xl sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-blue-700 p-2 text-white">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-blue-700">
                      Guided walkthrough · Step {tutorialStep + 1} of {PAGE_TUTORIAL_STEPS.length}
                    </p>
                    <h2 className="mt-1 text-lg font-black text-slate-900">
                      {PAGE_TUTORIAL_STEPS[tutorialStep].title}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTutorial(false)}
                  aria-label="Close tutorial"
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-700">
                {PAGE_TUTORIAL_STEPS[tutorialStep].body}
              </p>
              {tutorialStep === 7 && preview && !preview.executable ? (
                <p className="mt-2 text-xs font-semibold text-red-800">
                  The preview is blocked, so confirmation is intentionally unavailable. Resolve the listed decisions and preview again; if a blocking warning cannot be resolved, stop and ask an administrator.
                </p>
              ) : null}
              {!spotlightBounds ? (
                <p className="mt-2 text-xs font-semibold text-amber-800">
                  {loadingContacts
                    ? "Loading the live customer directory…"
                    : "Complete the highlighted customer selection or review step to continue."}
                </p>
              ) : null}
              {tutorialStep === 0 && !loadingContacts && contacts.length === 0 ? (
                <button
                  type="button"
                  onClick={() => void loadContacts()}
                  className="mt-3 rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800"
                >
                  Refresh customer directory
                </button>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-500">
                  {tutorialCanAdvance
                    ? "Review this highlighted area, then click Next."
                    : "Click the highlighted control; the guide advances after the action."}
                </span>
                <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowTutorial(false)}
                    className="text-xs font-bold text-slate-500 underline hover:text-slate-800"
                  >
                    Exit walkthrough
                  </button>
                  <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const previousStep = Math.max(0, tutorialStep - 1);
                      if (previousStep < 4) setShowMergeReviewModal(false);
                      setTutorialStep((step) => Math.max(0, step - 1));
                    }}
                    disabled={tutorialStep === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (tutorialStep === PAGE_TUTORIAL_STEPS.length - 1) {
                        setShowTutorial(false);
                      } else if (tutorialCanAdvance) {
                        setTutorialStep((step) => step + 1);
                      }
                    }}
                    disabled={tutorialStep !== PAGE_TUTORIAL_STEPS.length - 1 && !tutorialCanAdvance}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {tutorialStep === PAGE_TUTORIAL_STEPS.length - 1 ? "Finish" : "Next"}
                    {tutorialStep < PAGE_TUTORIAL_STEPS.length - 1 ? <ChevronRight className="h-4 w-4" /> : null}
                  </button>
                  </div>
                </div>
              </div>
            </aside>
          </>
        ) : null}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-black">Choose customers to compare</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search and select two live customer records. Review every field before choosing which record will survive.
            </p>
          </div>
          {loadingContacts ? (
            <p role="status" className="mb-4 text-sm text-slate-500">Loading customer directory…</p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4" aria-labelledby="customer-a-heading">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-800 text-lg font-black text-white">A</span>
                <div><h3 id="customer-a-heading" className="font-black text-slate-900">Customer A</h3><p className="text-xs text-slate-500">First record</p></div>
              </div>
              <div data-tutorial="customer-a-select"><SearchableSelect value={selected ? String(selected.id) : ""} options={customerOptions} onChange={(id) => void selectCustomer("a", id)} disabled={loadingContacts || loadingA || merging} loading={loadingA} placeholder="Search and select customer A" searchPlaceholder="Search company, contact, phone, or address…" /></div>
            </section>
            <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4" aria-labelledby="customer-b-heading">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-800 text-lg font-black text-white">B</span>
                <div><h3 id="customer-b-heading" className="font-black text-slate-900">Customer B</h3><p className="text-xs text-slate-500">Second record</p></div>
              </div>
              <div data-tutorial="customer-b-select"><SearchableSelect value={activeDuplicate ? selectedBId : ""} options={customerOptions.filter((option) => option.value !== String(selected?.id || ""))} onChange={(id) => void selectCustomer("b", id)} disabled={loadingContacts || loadingA || loadingB || merging} loading={loadingB} placeholder="Search and select customer B" searchPlaceholder="Search company, contact, phone, or address…" /></div>
            </section>
          </div>
          {loadingA || loadingB ? <p className="mt-4 text-sm text-blue-700" role="status">Loading full customer details…</p> : null}
          {selected && activeDuplicate ? (
            <div className="mt-4 space-y-3">
              <DiffComparison left={selected} right={activeDuplicate} leftLabel={selected.company || "Customer A"} rightLabel={activeDuplicate.company || "Customer B"} data-tutorial="customer-diff" />
              <div className="flex justify-end">
                <button type="button" data-tutorial="match-review" onClick={() => { setShowMergeReviewModal(true); if (showTutorial && tutorialStep === 3) setTutorialStep(4); }} disabled={loadingA || loadingB || merging} className="rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">Configure merge</button>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">Choose both customer records to display their side-by-side comparison.</p>
          )}
        </section>
        {showMergeReviewModal && selected && activeDuplicate ? (
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-review-dialog-title"
          >
            <div className="flex h-full w-full max-w-[98vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                    Customer merge review
                  </p>
                  <h2
                    id="duplicate-review-dialog-title"
                    className="mt-1 text-lg font-black text-slate-900 sm:text-xl"
                  >
                    Review all customer details before merging
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose the surviving record; its company name will remain.
                    Review transferred history, conflicts, and totals before
                    explicitly confirming the merge.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowMergeReviewModal(false);
                    if (showTutorial && tutorialStep >= 4) setTutorialStep(3);
                  }}
                  aria-label="Close customer merge review"
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>
              <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
                <div className="min-h-0 space-y-3 lg:overflow-y-auto">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                      <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                        Customer A
                      </p>
                      <p className="mt-1 font-black text-slate-900">
                        {selected.company || "Unnamed customer"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">Status: {selected.status || "—"}</p>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm">
                      <p className="text-xs font-black uppercase tracking-wide text-violet-700">
                        Customer B
                      </p>
                      <p className="mt-1 font-black text-slate-900">
                        {activeDuplicate.company || "Unnamed customer"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">Status: {activeDuplicate.status || "—"}</p>
                    </div>
                  </div>
                  <DiffComparison
                    left={selected}
                    right={activeDuplicate}
                    leftLabel="Customer A"
                    rightLabel="Customer B"
                    compact
                    data-tutorial="customer-diff"
                  />
                </div>
                <div className="min-h-0 overflow-y-auto rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-blue-800">
                    Step 2 · Choose the surviving record
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-bold text-slate-600">
                      1. Select the surviving customer
                      <select
                        data-tutorial="survivor-select"
                        className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm"
                        value={survivorId}
                        onChange={(event) => {
                          setSurvivorId(event.target.value);
                          setMergeKey(newMergeKey());
                          setFieldDecisions({});
                          invalidateMergePreview();
                          if (event.target.value && showTutorial && tutorialStep === 4) setTutorialStep(5);
                        }}
                      >
                        <option value="">
                          Choose the customer whose history
                          will remain
                        </option>
                        <option value={String(selected.id)}>
                          Customer A · {selected.company || "Unnamed customer"}
                        </option>
                        <option value={String(activeDuplicate.id)}>
                          Customer B · {activeDuplicate.company || "Unnamed customer"}
                        </option>
                      </select>
                    </label>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-bold text-slate-600">Final company name</span>
                      <p className="mt-1 font-semibold text-slate-900">{finalName || "Choose the surviving customer to set the final name."}</p>
                    </div>
                    <label className="text-xs font-bold text-slate-600 md:col-span-2">
                      Merge reason
                      <textarea
                        className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                        value={mergeReason}
                        onChange={(event) => {
                          setMergeReason(
                            event.target.value,
                          );
                          setMergeKey(newMergeKey());
                          invalidateMergePreview();
                          if (event.target.value.trim() && showTutorial && tutorialStep === 5) setTutorialStep(6);
                        }}
                        data-tutorial="merge-reason"
                        placeholder="Why are these records duplicates?"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    data-tutorial="preview-merge"
                    onClick={() => void requestPreview()}
                    disabled={!canPreview}
                    className="rounded-md bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Preview safe merge
                  </button>
                  {!preview && Object.keys(fieldDecisions).length > 0 ? (
                    <p role="status" className="text-sm font-medium text-blue-800">
                      Your choice is saved. Preview the merge again to continue.
                    </p>
                  ) : null}
                  {preview ? (
                    <div data-tutorial="merge-preview" className="space-y-3 rounded-md border border-slate-300 bg-slate-50 p-3 text-sm">
                      <p className="font-black">
                        Preview:{" "}
                        {preview.executable
                          ? "ready for confirmation"
                          : "blocked"}
                      </p>
                      {Object.keys(preview.conflicts)
                        .length > 0 ? (
                        <div className="rounded border border-amber-200 bg-amber-50 p-3">
                          <p className="font-bold text-amber-900">
                            Resolve field differences ({Object.keys(preview.conflicts).length})
                          </p>
                          <p className="mt-1 text-sm text-amber-900">
                            These two customers have
                            different values. Choose which
                            value the merged customer should
                            keep.
                          </p>
                          {Object.entries(
                            preview.conflicts,
                          ).map(([field, label]) => {
                            const survivorPreview=
                              preview.customers.find(
                                (customer) =>
                                  String(customer.lsessionid ?? customer.id) ===
                                  preview.survivor_session_id,
                              );
                            const duplicatePreview=
                              preview.customers.find(
                                (customer) =>
                                  String(customer.lsessionid ?? customer.id) ===
                                  preview.duplicate_session_id,
                              );
                            return (
                              <div
                                key={field}
                                className="mt-3 rounded border border-amber-200 bg-white p-3"
                              >
                                <p className="text-sm font-bold text-slate-800">
                                  {label}
                                  {fieldDecisions[field] ? ` · Keeping Customer ${fieldDecisions[field] === "survivor" ? "A" : "B"}` : " · Choose one"}
                                </p>
                                {field === "tin" ? (
                                  <span className="mt-2 block font-semibold text-red-700">
                                    These TINs cannot be
                                    chosen automatically.
                                    Resolve the TIN
                                    difference before
                                    merging.
                                  </span>
                                ) : (
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    <button
                                      type="button"
                                      aria-pressed={fieldDecisions[field] === "survivor"}
                                      onClick={() => {
                                        setFieldDecisions(
                                          (previous) => ({
                                            ...previous,
                                            [field]:
                                              "survivor",
                                          }),
                                        );
                                        setMergeKey(newMergeKey());
                                        invalidateMergePreview();
                                        if (showTutorial && tutorialStep === 7) setTutorialStep(6);
                                      }}
                                      className={`rounded border px-3 py-2 text-left text-xs ${fieldDecisions[field] === "survivor" ? "border-blue-600 bg-blue-100 ring-2 ring-blue-200" : "border-slate-300 hover:bg-slate-50"}`}
                                    >
                                      <span className="block font-bold text-slate-700">
                                        Keep Customer A
                                      </span>
                                      <span className="mt-1 block text-slate-600">
                                        {mergeDecisionFieldValue(
                                          survivorPreview,
                                          selected,
                                          field,
                                        )}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      aria-pressed={fieldDecisions[field] === "duplicate"}
                                      onClick={() => {
                                        setFieldDecisions(
                                          (previous) => ({
                                            ...previous,
                                            [field]:
                                              "duplicate",
                                          }),
                                        );
                                        setMergeKey(newMergeKey());
                                        invalidateMergePreview();
                                        if (showTutorial && tutorialStep === 7) setTutorialStep(6);
                                      }}
                                      className={`rounded border px-3 py-2 text-left text-xs ${fieldDecisions[field] === "duplicate" ? "border-blue-600 bg-blue-100 ring-2 ring-blue-200" : "border-slate-300 hover:bg-slate-50"}`}
                                    >
                                      <span className="block font-bold text-slate-700">
                                        Keep Customer B
                                      </span>
                                      <span className="mt-1 block text-slate-600">
                                        {mergeDecisionFieldValue(
                                          duplicatePreview,
                                          activeDuplicate,
                                          field,
                                        )}
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Object.entries(
                          preview.financial_totals,
                        ).map(([key, value]) => (
                          <div
                            key={key}
                            className="rounded border border-slate-200 bg-white px-2 py-1"
                          >
                            <span className="text-xs text-slate-500">
                              {key.replaceAll("_", " ")}
                            </span>
                            <strong className="ml-2">
                              {value ?? "not available"}
                            </strong>
                          </div>
                        ))}
                      </div>
                      <details className="rounded border border-slate-200 bg-white p-2">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                          Show technical transfer details
                        </summary>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          The merge checks related records
                          before transferring them. This
                          detail is normally safe to leave
                          closed.
                        </p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {Object.entries(preview.counts)
                            .map(
                              ([table, count]) =>
                                `${table}=${count ?? "unknown"}`,
                            )
                            .join(", ")||
                            "No related records found."}
                        </p>
                      </details>
                      {preview.blocking_warnings.length>
                        0 ? (
                        <ul className="list-disc pl-5 text-red-700">
                          {preview.blocking_warnings.map(
                            (warning) => (
                              <li key={warning}>
                                {warning}
                              </li>
                            ),
                          )}
                        </ul>
                      ) : null}
                      {preview.executable ? (
                        <div className="flex flex-wrap gap-2">
                          <input
                            aria-label="Merge confirmation phrase"
                            data-tutorial="merge-confirmation"
                            className="h-10 rounded-md border border-slate-300 px-2 text-sm"
                            value={confirmation}
                            onChange={(event) => {
                              setConfirmation(event.target.value);
                              if (event.target.value === "MERGE CUSTOMER RECORDS" && showTutorial && tutorialStep === 8) setTutorialStep(9);
                            }}
                            placeholder="MERGE CUSTOMER RECORDS"
                          />
                          <button
                            type="button"
                            data-tutorial="confirm-merge"
                            onClick={() =>
                              void executeMerge()
                            }
                            disabled={
                              merging ||
                              confirmation !==
                              "MERGE CUSTOMER RECORDS"
                            }
                            className="rounded-md bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {merging
                              ? "Merging..."
                              : "Confirm merge"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
