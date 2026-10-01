import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GitCompareArrows,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Contact } from "../../../types";
import {
  fetchContactById,
  fetchContacts,
} from "../../../services/customerDatabaseLocalApiService";
import {
  executeCustomerMerge,
  findPotentialDuplicates,
  previewCustomerMerge,
  type CustomerMergePreview,
  type PotentialDuplicateMatch,
} from "../../../services/duplicateCustomerService";
import { shouldSuppressAuthError } from "../../../services/localApiAuth";
import { useToast } from "../../ToastProvider";

const MATCH_LABELS: Record<string, string> = {
  company_exact: "Exact company name",
  company_similar: "Similar company name",
  tin: "TIN",
  phone: "Phone number",
  address: "Address",
  contact_person: "Contact person",
};

const PAGE_TUTORIAL_STEPS = [
  {
    title: "Choose a customer to check",
    body: "Click a customer card in the directory. The page will check that customer against the live records. If it finds no matches, close the results and choose another customer.",
    target: "[data-tutorial='customer-card']",
  },
  {
    title: "Open a possible match",
    body: "When a pair is found, click Review disparities on that pair. No button appears when there are no matches.",
    target: "[data-tutorial='match-review']:not(:disabled)",
  },
  {
    title: "Compare the actual records",
    body: "This is the live comparison for the selected pair. Customer A and B are separated by color; amber rows differ and muted rows match. Review the actual values before making a merge decision.",
    target: "[data-tutorial='customer-diff']",
  },
  {
    title: "Choose the customer record that survives",
    body: "Choose A or B. The surviving record keeps its customer ID and becomes the destination for the other customer’s transferred history and transactions.",
    target: "[data-tutorial='survivor-select']",
  },
  {
    title: "Choose the final company name",
    body: "The survivor’s name is selected by default. You can keep the other customer’s name or enter a new one. This is separate from choosing which record survives.",
    target: "[data-tutorial='name-choice']",
  },
  {
    title: "Explain why these records are duplicates",
    body: "Enter a clear reason for the audit trail. The preview button becomes available once the survivor, final name, and reason are set.",
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
    body: "This permanently performs the reviewed merge. Use it only after confirming the survivor, final company name, transferred history, totals, and decisions are correct.",
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
  contact: Contact | undefined,
  field: string,
): string => {
  if (!contact) return "Not available";
  const value =
    field === "vat_type"
      ? contact.vatType
      : field === "terms"
        ? contact.terms
        : field === "price_group"
          ? contact.priceGroup
          : field === "sales_person"
            ? contact.salesman || contact.assignedAgent || "Unassigned"
            : "";
  return String(value || "Not set");
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
  const rows = [
    ["Company name", left.company, right.company],
    ["Contact person", primaryContactPerson(left), primaryContactPerson(right)],
    [
      "Email",
      left.contactPersons?.[0]?.email || left.email,
      right.contactPersons?.[0]?.email || right.email,
    ],
    ["Phone", contactPhone(left), contactPhone(right)],
    ["Address", contactLocation(left), contactLocation(right)],
    ["Delivery address", left.deliveryAddress, right.deliveryAddress],
    ["TIN", left.tin, right.tin],
    ["VAT type", left.vatType, right.vatType],
    ["Payment terms", left.terms, right.terms],
    ["Price group", left.priceGroup, right.priceGroup],
    [
      "Sales assignment",
      left.salesman || left.assignedAgentId,
      right.salesman || right.assignedAgentId,
    ],
    ["Status", left.status, right.status],
    ["Verification", left.verification, right.verification],
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
                className={`flex items-center bg-slate-50 text-xs font-bold text-slate-600 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
              >
                {label}
              </div>
              <div
                className={`border-l-4 border-blue-400 text-sm ${compact ? "px-3 py-2 text-xs" : "px-4 py-3"} ${isDifferent ? "bg-amber-50 font-semibold text-amber-950" : "bg-blue-50/60 text-slate-500"}`}
              >
                {leftValue}
              </div>
              <div
                className={`border-l-4 border-violet-400 text-sm ${compact ? "px-3 py-2 text-xs" : "px-4 py-3"} ${isDifferent ? "bg-amber-50 font-semibold text-amber-950" : "bg-violet-50/60 text-slate-500"}`}
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
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [matches, setMatches] = useState<PotentialDuplicateMatch[]>([]);
  const [matchDetails, setMatchDetails] = useState<Contact[]>([]);
  const [hasRunDetection, setHasRunDetection] = useState(false);
  const [showMatchesModal, setShowMatchesModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [spotlightBounds, setSpotlightBounds] = useState<SpotlightBounds | null>(null);
  const [activeDuplicateId, setActiveDuplicateId] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<CustomerMergePreview | null>(null);
  const [survivorId, setSurvivorId] = useState("");
  const [nameChoice, setNameChoice] = useState<
    "survivor" | "duplicate" | "custom" | ""
  >("");
  const [customFinalName, setCustomFinalName] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [fieldDecisions, setFieldDecisions] = useState<
    Record<string, "survivor" | "duplicate">
  >({});
  const [confirmation, setConfirmation] = useState("");
  const [mergeKey, setMergeKey] = useState("");
  const [merging, setMerging] = useState(false);
  const detectionSequence = useRef(0);
  const tutorialTargetSelector =
    tutorialStep === 4 && nameChoice === "custom"
      ? "[data-tutorial='custom-name']"
      : PAGE_TUTORIAL_STEPS[tutorialStep]?.target;

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

  const filteredContacts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return contacts.slice(0, 20);
    return contacts
      .filter((contact) =>
        [
          contact.company,
          contact.name,
          contact.mobile,
          contact.phone,
          contact.address,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(needle),
        ),
      )
      .slice(0, 20);
  }, [contacts, search]);

  const detailById = useMemo(
    () => new Map(matchDetails.map((contact) => [String(contact.id), contact])),
    [matchDetails],
  );
  const hasReviewableMatch = matches.some((match) =>
    detailById.has(String(match.session_id)),
  );
  const activeMatch =
    matches.find((match) => String(match.session_id) === activeDuplicateId) ||
    null;
  const activeDuplicate = activeMatch
    ? detailById.get(String(activeMatch.session_id)) || null
    : null;
  const survivorContact =
    survivorId === String(selected?.id)
      ? selected
      : survivorId === String(activeDuplicate?.id)
        ? activeDuplicate
        : null;
  const duplicateContact =
    survivorId === String(selected?.id)
      ? activeDuplicate
      : survivorId === String(activeDuplicate?.id)
        ? selected
        : null;
  const finalName =
    nameChoice === "survivor"
      ? survivorContact?.company || ""
      : nameChoice === "duplicate"
        ? duplicateContact?.company || ""
        : customFinalName;
  const canPreview = Boolean(
    selected &&
    activeDuplicate &&
    survivorId &&
    finalName.trim() &&
    mergeReason.trim(),
  );
  const tutorialCanAdvance =
    tutorialStep === 2 ||
    (tutorialStep === 3 && Boolean(survivorId)) ||
    (tutorialStep === 4 && Boolean(survivorId && finalName.trim())) ||
    (tutorialStep === 5 && Boolean(mergeReason.trim())) ||
    (tutorialStep === 6 && Boolean(preview)) ||
    (tutorialStep === 7 && Boolean(preview?.executable)) ||
    (tutorialStep === 8 && confirmation === "MERGE CUSTOMER RECORDS");

  const resetMerge = () => {
    setActiveDuplicateId("");
    setPreview(null);
    setSurvivorId("");
    setNameChoice("");
    setCustomFinalName("");
    setMergeReason("");
    setFieldDecisions({});
    setConfirmation("");
    setMergeKey("");
  };

  const runDetection = async (sourceContact?: Contact) => {
    const source = sourceContact || selected;
    if (!source) return;
    const sequence = ++detectionSequence.current;
    setShowMatchesModal(true);
    setLoadingMatches(true);
    setError("");
    setHasRunDetection(false);
    setMatches([]);
    setMatchDetails([]);
    resetMerge();
    try {
      const result = await findPotentialDuplicates(source);
      if (sequence !== detectionSequence.current) return;
      setMatches(result);
      const details = await Promise.all(
        result.map((match) => fetchContactById(match.session_id)),
      );
      if (sequence !== detectionSequence.current) return;
      setMatchDetails(
        details.filter((contact): contact is Contact => Boolean(contact)),
      );
      setHasRunDetection(true);
      if (result.length === 0) {
        addToast({
          type: "success",
          title: "No potential duplicates found",
          description:
            "The selected customer did not match another live customer.",
          durationMs: 4000,
        });
      }
    } catch (err) {
      if (sequence !== detectionSequence.current) return;
      if (!shouldSuppressAuthError(err))
        setError(
          err instanceof Error
            ? err.message
            : "Unable to check for duplicates.",
        );
    } finally {
      if (sequence === detectionSequence.current) setLoadingMatches(false);
    }
  };

  const chooseMatch = (match: PotentialDuplicateMatch) => {
    setActiveDuplicateId(String(match.session_id));
    setPreview(null);
    setSurvivorId("");
    setNameChoice("");
    setCustomFinalName("");
    setFieldDecisions({});
    setConfirmation("");
    setMergeKey(newMergeKey());
  };

  const requestPreview = async () => {
    if (!selected || !activeDuplicate || !canPreview) return;
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
      setPreview(result);
      if (showTutorial && tutorialStep === 6) setTutorialStep(7);
    } catch (err) {
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
      setMatches((previous) =>
        previous.filter(
          (match) => String(match.session_id) !== activeDuplicateId,
        ),
      );
      setMatchDetails((previous) =>
        previous.filter((contact) => String(contact.id) !== activeDuplicateId),
      );
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
              Investigate possible duplicate records, review a complete merge
              preview, and confirm the controlled operation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMatchesModal(false);
                resetMerge();
                setSearch("");
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
                  {tutorialStep === 0 && loadingContacts
                    ? "The customer directory is still loading. The customer cards will be highlighted when they appear."
                    : tutorialStep === 1 && loadingMatches
                    ? "Checking this customer for possible matches… the review button will be highlighted if a pair is found."
                    : tutorialStep === 1 && hasRunDetection && matches.length === 0
                      ? "No pair was found for this customer, so there is no review button. Choose another customer to continue."
                      : tutorialStep === 1 && hasRunDetection && !hasReviewableMatch
                        ? "A possible pair was found, but its full customer details could not be loaded. Retry the check or choose a different customer."
                      : tutorialStep === 1 && error
                        ? "The duplicate check did not finish. Retry it from the results window, or close the walkthrough."
                        : tutorialStep === 0 && !loadingContacts && contacts.length === 0
                          ? "There are no customer records to select yet. Refresh the directory or add customers, then restart the walkthrough."
                          : "This control is not available yet. Complete the action described above; the highlight will move here when it appears."}
                </p>
              ) : null}
              {tutorialStep === 1 && hasRunDetection && matches.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowMatchesModal(false);
                    resetMerge();
                    setTutorialStep(0);
                  }}
                  className="mt-3 rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800"
                >
                  Choose another customer
                </button>
              ) : null}
              {tutorialStep === 1 && error && !loadingMatches ? (
                <button
                  type="button"
                  onClick={() => void runDetection()}
                  className="mt-3 rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800"
                >
                  Retry duplicate check
                </button>
              ) : null}
              {tutorialStep === 1 && hasRunDetection && matches.length > 0 && !hasReviewableMatch ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runDetection()}
                    className="rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800"
                  >
                    Retry loading match details
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMatchesModal(false);
                      resetMerge();
                      setTutorialStep(0);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Choose another customer
                  </button>
                </div>
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
                  {tutorialStep === 4 && nameChoice === "survivor"
                    ? "The survivor name is already selected; click Next or choose another name."
                    : tutorialCanAdvance
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
                      if (tutorialStep === 1) {
                        setShowMatchesModal(false);
                        resetMerge();
                      } else if (tutorialStep === 2) {
                        setActiveDuplicateId("");
                      }
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-700" />
                <h2 className="text-lg font-black">Customer directory</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Select a customer card to compare it with possible duplicates.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selected ? (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                  Selected: {selected.company || "Unnamed customer"}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void runDetection()}
                disabled={!selected || loadingMatches}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMatches
                  ? "Checking..."
                  : hasRunDetection
                    ? "Check again"
                    : "Check duplicates"}
              </button>
            </div>
          </div>
          <div className="relative mt-4 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              aria-label="Search customers for duplicate review"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company, phone, or contact"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {loadingContacts ? (
            <p role="status" className="mt-4 text-sm text-slate-500">
              Loading customers...
            </p>
          ) : filteredContacts.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No customers found.
            </p>
          ) : (
            <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {filteredContacts.map((contact) => {
                const isSelected = selected?.id === contact.id;
                return (
                  <button
                    type="button"
                    key={contact.id}
                    data-tutorial="customer-card"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelected(contact);
                      setMatches([]);
                      setMatchDetails([]);
                      setHasRunDetection(false);
                      setShowMatchesModal(true);
                      resetMerge();
                      if (showTutorial && tutorialStep === 0) setTutorialStep(1);
                      void runDetection(contact);
                    }}
                    className={`group rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md ${isSelected ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200 bg-slate-50/40"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">
                          {contact.company || "Unnamed customer"}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {primaryContactPerson(contact)}
                        </p>
                      </div>
                      {isSelected ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-700 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                          <CheckCircle2 className="h-3 w-3" /> Selected
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-2 text-xs text-slate-600">
                      <p className="truncate">
                        <span className="font-bold text-slate-500">Phone:</span>{" "}
                        {contactPhone(contact)}
                      </p>
                      <p className="truncate">
                        <span className="font-bold text-slate-500">
                          Address:
                        </span>{" "}
                        {contactLocation(contact)}
                      </p>
                    </div>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Customer ID: {contact.id}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
        {showMatchesModal ? (
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-40 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="possible-duplicates-dialog-title"
          >
            <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                    Customer duplicate check
                  </p>
                  <h2
                    id="possible-duplicates-dialog-title"
                    className="mt-1 text-xl font-black text-slate-900"
                  >
                    Possible matches for{" "}
                    {selected?.company || "selected customer"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review a pair to compare all customer details and configure
                    its merge.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowMatchesModal(false);
                    resetMerge();
                  }}
                  aria-label="Close possible duplicates"
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <main className="max-h-[calc(100vh-13rem)] overflow-y-auto p-4 sm:p-6">
                {!selected ? (
                  <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                    <div>
                      <AlertTriangle className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 font-semibold">
                        Select a customer to begin an investigation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="h-4 w-4 text-slate-500" />
                          <h2 className="text-lg font-black">
                            Possible duplicate pairs
                          </h2>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Each comparison below shows the two records field by
                          field. Select one pair to configure the merge.
                        </p>
                      </div>
                      {hasRunDetection ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                          {matches.length}{" "}
                          {matches.length === 1 ? "pair" : "pairs"} found
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                          Not checked yet
                        </span>
                      )}
                    </div>
                    {matches.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2 font-bold text-slate-700">
                          {hasRunDetection
                            ? "No possible duplicate pairs found"
                            : "Duplicate results will appear here"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {hasRunDetection
                            ? "This selected source customer has no matching pair based on the current detection rules."
                            : "Run detection to check this source customer against the live customer directory."}
                        </p>
                      </div>
                    ) : (
                      matches.map((match) => {
                        const detail = detailById.get(String(match.session_id));
                        const isActive =
                          activeDuplicateId === String(match.session_id);
                        return (
                          <article
                            key={match.session_id}
                            className={`rounded-xl border p-4 shadow-sm transition ${isActive ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-200" : "border-amber-200 bg-amber-50/40"}`}
                          >
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p
                                    className={`text-xs font-black uppercase tracking-wide ${isActive ? "text-blue-800" : "text-amber-800"}`}
                                  >
                                    {isActive
                                      ? "Active merge pair"
                                      : "Possible duplicate pair"}
                                  </p>
                                  {isActive ? (
                                    <span className="rounded-full bg-blue-700 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                                      Selected for review
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-sm font-bold text-slate-800">
                                  {match.company || "Unnamed customer"}
                                </p>
                                {match.is_blacklisted ? (
                                  <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-red-800">
                                    Blacklisted
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {match.matched_fields.map((field) => (
                                  <span
                                    key={field}
                                    className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800"
                                  >
                                    {MATCH_LABELS[field] || field}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {detail ? (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">
                                    Customer A · Selected source
                                  </p>
                                  <p className="mt-1 font-bold text-slate-900">
                                    {selected.company || "Unnamed customer"}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {primaryContactPerson(selected)} ·{" "}
                                    {contactPhone(selected)}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-wide text-violet-700">
                                    Customer B · Possible match
                                  </p>
                                  <p className="mt-1 font-bold text-slate-900">
                                    {detail.company || "Unnamed customer"}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {primaryContactPerson(detail)} ·{" "}
                                    {contactPhone(detail)}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-600">
                                Match ID: {match.session_id}. Full customer
                                details could not be loaded.
                              </p>
                            )}
                            <button
                              type="button"
                              data-tutorial="match-review"
                              onClick={() => {
                                chooseMatch(match);
                                if (showTutorial && tutorialStep === 1) setTutorialStep(2);
                              }}
                              disabled={!detail}
                              className={`mt-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold disabled:opacity-50 ${isActive ? "bg-blue-700 text-white" : "border border-slate-400 bg-white text-slate-700 hover:bg-slate-50"}`}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                              Review disparities
                            </button>
                            {isActive && detail ? (
                              <div
                                className="fixed inset-x-0 bottom-0 top-16 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="duplicate-review-dialog-title"
                              >
                                <div className="flex h-full w-full max-w-[98vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                                  <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
                                    <div>
                                      <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                                        Duplicate customer review
                                      </p>
                                      <h2
                                        id="duplicate-review-dialog-title"
                                        className="mt-1 text-lg font-black text-slate-900 sm:text-xl"
                                      >
                                        Review all disparities before merging
                                      </h2>
                                      <p className="mt-1 text-sm text-slate-500">
                                        Compare the complete records, then
                                        choose the surviving customer and final
                                        company name.
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={resetMerge}
                                      aria-label="Close duplicate customer review"
                                      className="rounded-full p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                                    >
                                      <X className="h-5 w-5" />
                                    </button>
                                  </div>
                                  <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                                    <div className="min-h-0 overflow-hidden">
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                                          <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                                            Customer A · Selected source
                                          </p>
                                          <p className="mt-1 font-black text-slate-900">
                                            {selected.company ||
                                              "Unnamed customer"}
                                          </p>
                                          <p className="mt-1 text-xs text-slate-600">
                                            ID: {selected.id} · Status:{" "}
                                            {selected.status || "—"}
                                          </p>
                                        </div>
                                        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm">
                                          <p className="text-xs font-black uppercase tracking-wide text-violet-700">
                                            Customer B · Possible match
                                          </p>
                                          <p className="mt-1 font-black text-slate-900">
                                            {detail.company ||
                                              "Unnamed customer"}
                                          </p>
                                          <p className="mt-1 text-xs text-slate-600">
                                            ID: {detail.id} · Status:{" "}
                                            {detail.status || "—"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                                        <span className="text-xs font-black uppercase tracking-wide text-amber-900">
                                          Matched because:
                                        </span>
                                        {match.matched_fields.map((field) => (
                                          <span
                                            key={field}
                                            className="rounded-full bg-white px-2 py-1 text-xs font-bold text-amber-900"
                                          >
                                            {MATCH_LABELS[field] || field}
                                          </span>
                                        ))}
                                      </div>
                                      <DiffComparison
                                        left={selected}
                                        right={detail}
                                        leftLabel="Customer A · Selected source"
                                        rightLabel="Customer B · Possible match"
                                        compact
                                        data-tutorial="customer-diff"
                                      />
                                    </div>
                                    <div className="min-h-0 overflow-y-auto rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                                      <p className="text-xs font-black uppercase tracking-wide text-blue-800">
                                        Step 2 · Confirm the pair and choose the
                                        final name
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
                                              setNameChoice(
                                                event.target.value
                                                  ? "survivor"
                                                  : "",
                                              );
                                              setCustomFinalName("");
                                              setPreview(null);
                                              if (event.target.value && showTutorial && tutorialStep === 3) setTutorialStep(4);
                                            }}
                                          >
                                            <option value="">
                                              Choose the customer whose history
                                              will remain
                                            </option>
                                            <option value={String(selected.id)}>
                                              {selected.company || selected.id}
                                            </option>
                                            <option value={String(detail.id)}>
                                              {detail.company || detail.id}
                                            </option>
                                          </select>
                                        </label>
                                        <div className="text-xs font-bold text-slate-600">
                                          <span>
                                            2. Company name to keep{" "}
                                            <span className="font-normal text-slate-500">
                                              (defaults to the survivor)
                                            </span>
                                          </span>
                                          <div className="mt-1 flex flex-wrap gap-2">
                                            <button
                                              type="button"
                                              data-tutorial="name-choice"
                                              disabled={!survivorId}
                                              onClick={() => {
                                                setNameChoice("survivor");
                                                setCustomFinalName("");
                                                setPreview(null);
                                                if (showTutorial && tutorialStep === 4) setTutorialStep(5);
                                              }}
                                              className={`rounded border px-2 py-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50 ${nameChoice === "survivor" ? "border-blue-600 bg-blue-50" : "border-slate-300"}`}
                                            >
                                              Keep survivor name
                                              {survivorContact
                                                ? `: ${survivorContact.company || "Unnamed"}`
                                                : ""}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={!survivorId}
                                              onClick={() => {
                                                setNameChoice("duplicate");
                                                setCustomFinalName("");
                                                setPreview(null);
                                                if (showTutorial && tutorialStep === 4) setTutorialStep(5);
                                              }}
                                              className={`rounded border px-2 py-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50 ${nameChoice === "duplicate" ? "border-blue-600 bg-blue-50" : "border-slate-300"}`}
                                            >
                                              Use other customer name
                                              {duplicateContact
                                                ? `: ${duplicateContact.company || "Unnamed"}`
                                                : ""}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={!survivorId}
                                              onClick={() => {
                                                setNameChoice("custom");
                                                setCustomFinalName("");
                                                setPreview(null);
                                              }}
                                              className={`rounded border px-2 py-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50 ${nameChoice === "custom" ? "border-blue-600 bg-blue-50" : "border-slate-300"}`}
                                            >
                                              Enter a different name
                                            </button>
                                          </div>
                                          {nameChoice === "custom" ? (
                                            <input
                                              data-tutorial="custom-name"
                                              className="mt-2 h-10 w-full rounded-md border border-slate-300 px-2 text-sm"
                                              value={customFinalName}
                                              onChange={(event) => {
                                                setCustomFinalName(
                                                  event.target.value,
                                                );
                                                setPreview(null);
                                                if (event.target.value.trim() && showTutorial && tutorialStep === 4) setTutorialStep(5);
                                              }}
                                              placeholder="Exact final company name"
                                            />
                                          ) : null}
                                          <p
                                            className={`mt-2 text-xs font-semibold ${finalName ? "text-blue-700" : "text-slate-500"}`}
                                          >
                                            {finalName
                                              ? `Final company name: ${finalName}`
                                              : "Select the surviving customer first. Its company name will be used automatically."}
                                          </p>
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
                                                setPreview(null);
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
                                      {preview ? (
                                        <div data-tutorial="merge-preview" className="space-y-3 rounded-md border border-slate-300 bg-slate-50 p-3 text-sm">
                                          <p className="font-black">
                                            Preview:{" "}
                                            {preview.executable
                                              ? "ready for confirmation"
                                              : "blocked"}
                                          </p>
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
                                                .join(", ") ||
                                                "No related records found."}
                                            </p>
                                          </details>
                                          {Object.keys(preview.conflicts)
                                            .length > 0 ? (
                                            <div className="rounded border border-amber-200 bg-amber-50 p-3">
                                              <p className="font-bold text-amber-900">
                                                One decision is needed before
                                                merging
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
                                                const survivorPreview =
                                                  preview.customers.find(
                                                    (customer) =>
                                                      String(customer.id) ===
                                                      preview.survivor_session_id,
                                                  );
                                                const duplicatePreview =
                                                  preview.customers.find(
                                                    (customer) =>
                                                      String(customer.id) ===
                                                      preview.duplicate_session_id,
                                                  );
                                                return (
                                                  <div
                                                    key={field}
                                                    className="mt-3 rounded border border-amber-200 bg-white p-3"
                                                  >
                                                    <p className="text-sm font-bold text-slate-800">
                                                      {label}
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
                                                          onClick={() => {
                                                            setFieldDecisions(
                                                              (previous) => ({
                                                                ...previous,
                                                                [field]:
                                                                  "survivor",
                                                              }),
                                                            );
                                                            setPreview(null);
                                                            if (showTutorial && tutorialStep === 7) setTutorialStep(6);
                                                          }}
                                                          className={`rounded border px-3 py-2 text-left text-xs ${fieldDecisions[field] === "survivor" ? "border-blue-600 bg-blue-100 ring-2 ring-blue-200" : "border-slate-300 hover:bg-slate-50"}`}
                                                        >
                                                          <span className="block font-bold text-slate-700">
                                                            Keep Customer A
                                                          </span>
                                                          <span className="mt-1 block text-slate-600">
                                                            {mergeFieldValue(
                                                              survivorPreview,
                                                              field,
                                                            )}
                                                          </span>
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setFieldDecisions(
                                                              (previous) => ({
                                                                ...previous,
                                                                [field]:
                                                                  "duplicate",
                                                              }),
                                                            );
                                                            setPreview(null);
                                                            if (showTutorial && tutorialStep === 7) setTutorialStep(6);
                                                          }}
                                                          className={`rounded border px-3 py-2 text-left text-xs ${fieldDecisions[field] === "duplicate" ? "border-blue-600 bg-blue-100 ring-2 ring-blue-200" : "border-slate-300 hover:bg-slate-50"}`}
                                                        >
                                                          <span className="block font-bold text-slate-700">
                                                            Keep Customer B
                                                          </span>
                                                          <span className="mt-1 block text-slate-600">
                                                            {mergeFieldValue(
                                                              duplicatePreview,
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
                                          {preview.blocking_warnings.length >
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
                          </article>
                        );
                      })
                    )}
                  </div>
                )}
              </main>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
