import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  ExternalLink,
  FileOutput,
  Info,
  MessageSquare,
  Package2,
  Plus,
  Printer,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type {
  Contact,
  Product,
  PurchaseRequestItem,
  PurchaseRequestWithItems,
  PRStatus,
} from "../../purchaseRequest.types";
import ConfirmModal from "../ConfirmModal";
import RecoveryReasonModal from "../RecoveryReasonModal";
import ProductAutocomplete from "../ProductAutocomplete";
import ModuleRecordLink from "../ModuleRecordLink";
import type { Product as SearchProduct } from "../../types";

interface PurchaseRequestViewProps {
  request: PurchaseRequestWithItems;
  onBack: () => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onUpdateItem: (
    itemId: string,
    updates: Record<string, unknown>,
  ) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onAddItem: (item: Record<string, unknown>) => Promise<void>;
  onConvert: (itemIds?: string[]) => void | Promise<void>;
  onPrint: () => void;
  onUnpost?: (reason: string) => Promise<void>;
  onDelete?: (reason: string) => Promise<void>;
  products: Product[];
  suppliers: Contact[];
  isApprover?: boolean;
}

type EnrichedItem = PurchaseRequestItem & {
  original_part_no?: string;
  brand?: string;
  unit?: string;
  sr_cases?: number;
  ir_cases?: number;
  preferred_supplier_name?: string;
  preferred_supplier_price?: number;
  recommendation?: string;
};

const getLastTwelveMonthsRange = () => {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setFullYear(dateFrom.getFullYear() - 1);
  return {
    dateFrom: dateFrom.toISOString().slice(0, 10),
    dateTo: dateTo.toISOString().slice(0, 10),
  };
};

const openItemReturnHistory = (
  item: EnrichedItem,
  kind: "sales" | "supplier",
) => {
  const search = item.item_code || item.part_number || item.description || "";
  const { dateFrom, dateTo } = getLastTwelveMonthsRange();
  const params = new URLSearchParams({
    search,
    dateFrom,
    dateTo,
    itemRefno: String(item.item_id || ""),
    itemCode: String(item.item_code || ""),
    status: "Posted",
  });
  const route =
    kind === "sales"
      ? "accounting-reports-sales-return-report"
      : "warehouse-purchasing-return-to-supplier";
  const url = new URL(window.location.href);
  url.hash = `#/${route}?${params.toString()}`;
  window.open(url.toString(), "_blank", "noopener,noreferrer");
};

type ProductWithMetadata = SearchProduct & {
  original_pn?: string;
  original_part_no?: string;
  brand?: string;
};

const money = (value: number) =>
  `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const recommendationClass = (item: EnrichedItem) =>
  Number(item.sr_cases || 0) + Number(item.ir_cases || 0) === 0
    ? "text-emerald-700"
    : "text-amber-600";
const isItemOnPurchaseOrder = (item: EnrichedItem) =>
  String(item.po_refno || item.po_number || "").trim() !== "";
const itemSupplierKey = (item: EnrichedItem) =>
  String(item.supplier_id || item.supplier_name || item.preferred_supplier_name || "NO_SUPPLIER").trim();

const PurchaseRequestView: React.FC<PurchaseRequestViewProps> = ({
  request,
  onBack,
  onUpdate,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onConvert,
  onPrint,
  onUnpost,
  onDelete,
  products,
  suppliers,
  isApprover = true,
}) => {
  const [showAddItem, setShowAddItem] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "warning" | "info" | "success";
    onConfirm: (() => Promise<void>) | null;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    variant: "warning",
    onConfirm: null,
  });
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithMetadata | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [etaDate, setEtaDate] = useState("");
  const [recoveryAction, setRecoveryAction] = useState<"unpost" | "delete" | null>(null);
  const [historyItem, setHistoryItem] = useState<EnrichedItem | null>(null);
  const [selectedPOItemIds, setSelectedPOItemIds] = useState<string[]>([]);

  const items = (request.items || []) as EnrichedItem[];
  const convertibleItems = useMemo(
    () => items.filter((item) => item.id && !isItemOnPurchaseOrder(item)),
    [items],
  );
  const convertibleItemIds = useMemo(
    () => convertibleItems.map((item) => String(item.id)),
    [convertibleItems],
  );
  const totalQuantity = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );
  const totalAmount = items.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity || 0) *
        Number(item.unit_cost || item.preferred_supplier_price || 0),
    0,
  );
  const selectedPOItemIdSet = useMemo(() => new Set(selectedPOItemIds), [selectedPOItemIds]);
  const convertibleItemCount = convertibleItems.length;
  const itemsOnPOCount = items.length - convertibleItemCount;
  const selectedPOItems = useMemo(
    () => convertibleItems.filter((item) => selectedPOItemIdSet.has(String(item.id || ""))),
    [convertibleItems, selectedPOItemIdSet],
  );
  const selectedSupplierGroupCount = useMemo(
    () => new Set(selectedPOItems.map(itemSupplierKey)).size,
    [selectedPOItems],
  );

  useEffect(() => {
    setSelectedPOItemIds((current) =>
      current.filter((id) => convertibleItemIds.includes(id)),
    );
  }, [request.id, convertibleItemIds.join("|")]);

  const closeConfirm = () =>
    setConfirmModal((previous) => ({
      ...previous,
      isOpen: false,
      onConfirm: null,
    }));
  const handleStatusChange = (newStatus: PRStatus) =>
    setConfirmModal({
      isOpen: true,
      title: `${request.status === "Unposted" && newStatus === "Approved" ? "Post" : newStatus} Purchase Request`,
      message: `Are you sure you want to ${request.status === "Unposted" && newStatus === "Approved" ? "post" : "change the status of"} ${request.pr_number}${request.status === "Unposted" && newStatus === "Approved" ? " again" : ` to ${newStatus}`}?`,
      confirmLabel: request.status === "Unposted" && newStatus === "Approved" ? "Post" : newStatus === "Approved" ? "Approve" : "Confirm",
      variant: newStatus === "Cancelled" ? "danger" : "warning",
      onConfirm: async () => onUpdate(request.id, { status: newStatus }),
    });
  const handleDeleteItemRequest = (itemId: string, partNumber?: string) =>
    setConfirmModal({
      isOpen: true,
      title: "Delete Item",
      message: `Are you sure you want to delete ${partNumber || "this item"} from ${request.pr_number}?`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => onDeleteItem(itemId),
    });
  const handleConvertRequest = () =>
    setConfirmModal({
      isOpen: true,
      title: "Generate Purchase Order",
      message: `Create Purchase Order(s) from ${request.pr_number} using ${selectedPOItemIds.length} selected item${selectedPOItemIds.length === 1 ? "" : "s"}? The system will create ${selectedSupplierGroupCount || 1} PO${(selectedSupplierGroupCount || 1) === 1 ? "" : "s"}, one per supplier.`,
      confirmLabel: "Generate PO",
      variant: "info",
      onConfirm: async () => onConvert(selectedPOItemIds),
    });
  const handleRecovery = (kind: "unpost" | "delete", reason: string) => {
    setConfirmModal({
      isOpen: true,
      title: `${kind === "unpost" ? "Unpost" : "Delete"} Purchase Request`,
      message:
        kind === "unpost"
          ? "Return this request to Unposted status?"
          : "Mark this request as Deleted?",
      confirmLabel: kind === "unpost" ? "Unpost" : "Delete",
      variant: kind === "unpost" ? "warning" : "danger",
      onConfirm: async () => {
        if (kind === "unpost") await onUnpost?.(reason);
        else await onDelete?.(reason);
      },
    });
  };
  const resetAddItem = () => {
    setShowAddItem(false);
    setSelectedProductId("");
    setSelectedProduct(null);
    setQuantity(1);
    setSelectedSupplierId("");
    setEtaDate("");
  };

  const handleAddItem = async () => {
    if (!selectedProductId || quantity <= 0) return;
    const product =
      selectedProduct || products.find((item) => item.id === selectedProductId);
    const supplier = suppliers.find((item) => item.id === selectedSupplierId);
    await onAddItem({
      item_id: selectedProductId,
      item_code: product?.item_code,
      part_number: product?.part_no,
      original_part_no:
        (product as ProductWithMetadata | undefined)?.original_part_no ||
        (product as ProductWithMetadata | undefined)?.original_pn,
      brand: (product as ProductWithMetadata | undefined)?.brand,
      description: product?.description,
      quantity,
      unit: "PCS",
      unit_cost: Number(product?.cost || 0),
      supplier_id: selectedSupplierId || null,
      supplier_name: supplier?.company || null,
      eta_date: etaDate || null,
    });
    resetAddItem();
  };

  const handleItemSupplierChange = async (
    item: EnrichedItem,
    supplierId: string,
  ) => {
    const supplier = suppliers.find((candidate) => candidate.id === supplierId);
    await onUpdateItem(item.id, {
      supplier_id: supplierId || null,
      supplier_name: supplier?.company || null,
    });
  };

  const generatedPOs = Array.from(
    items.reduce((orders, item: any) => {
      const number = String(item.po_number || "").trim();
      if (number && !orders.has(number)) {
        orders.set(number, {
          number,
          refno: String(item.po_refno || "").trim(),
        });
      }
      return orders;
    }, new Map<string, { number: string; refno: string }>()).values(),
  );
  const togglePOItemSelection = (itemId: string, checked: boolean) => {
    setSelectedPOItemIds((current) => {
      const item = convertibleItems.find((candidate) => String(candidate.id || "") === itemId);
      if (!item) return current;
      const selected = new Set(current);
      if (checked) {
        selected.add(itemId);
      }
      else selected.delete(itemId);
      return convertibleItemIds.filter((id) => selected.has(id));
    });
  };

  return (
    <div className="min-h-full overflow-y-auto bg-[#f7f9fc] text-slate-900">
      <div className="w-full space-y-5 p-4 lg:p-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="h-4 w-4" /> Back to List
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#173c83]">
                  Purchase Request{" "}
                  <span className="text-base font-semibold normal-case">
                    PR No. {request.pr_number}
                  </span>
                </h1>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {request.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Created {request.request_date || "-"}{" "}
                {request.created_by_name ? `by ${request.created_by_name}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                onClick={onPrint}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              {["Pending", "Submitted", "Unposted"].includes(request.status || "") && isApprover && (generatedPOs.length === 0 || request.status === "Unposted") && (
                <button
                  onClick={() => handleStatusChange("Approved")}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  <CheckCircle className="h-4 w-4" /> {request.status === "Unposted" ? "Post" : "Approve"}
                </button>
              )}
              {request.status === "Approved" && convertibleItemCount > 0 && (
                <button
                  onClick={handleConvertRequest}
                  disabled={selectedPOItemIds.length === 0}
                  className="inline-flex items-center gap-2 rounded-md bg-[#175fd3] px-3 py-2 text-sm font-bold text-white hover:bg-[#0e4fb7] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileOutput className="h-4 w-4" /> Generate Purchase Order
                </button>
              )}
              {["Pending", "Approved", "Unposted"].includes(request.status || "") && (
                <button
                  onClick={() => handleStatusChange("Cancelled")}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50"
                >
                  <XCircle className="h-4 w-4" /> Cancel
                </button>
              )}
              {onUnpost &&
                ["Approved", "Submitted"].includes(request.status || "") && (
                  <button
                    onClick={() => setRecoveryAction("unpost")}
                    className="rounded-md bg-amber-500 px-3 py-2 text-sm font-bold text-white"
                  >
                    Unpost
                  </button>
                )}
              {onDelete &&
                ["Draft", "Pending", "Unposted"].includes(
                  request.status || "",
                ) && (
                  <button
                    onClick={() => setRecoveryAction("delete")}
                    className="rounded-md bg-rose-600 px-3 py-2 text-sm font-bold text-white"
                  >
                    Delete
                  </button>
                )}
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-bold text-indigo-800">Purchasing cycle: {request.cycle_status || (itemsOnPOCount ? 'PO Created' : 'Pending')}</span>
              <span className="text-slate-700">Ordered <b>{Number(request.ordered_qty ?? totalQuantity)}</b> · Received <b>{Number(request.received_qty ?? 0)}</b> · Remaining <b>{Number(request.remaining_qty ?? Math.max(0, totalQuantity - Number(request.received_qty ?? 0)))}</b></span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span className="font-bold text-slate-500">Related PO:</span>
              {generatedPOs.map((po) => (
                <ModuleRecordLink
                  key={po.refno || po.number}
                  tab="purchases-transaction-purchase-order"
                  payload={{ poId: po.refno || undefined }}
                  className="font-bold text-[#175fd3] hover:underline"
                >
                  {po.number}
                </ModuleRecordLink>
              ))}
              {generatedPOs.length === 0 ? <span className="text-slate-500">Not created</span> : null}
            </div>
            {request.incomplete_delivery_reason ? <p className="mt-2 text-xs text-amber-800"><b>Reason for incomplete delivery:</b> {request.incomplete_delivery_reason}</p> : null}
          </div>
          <div className="mt-5 grid gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Request Details
              </p>
              <p className="mt-2">Reference: {request.reference_no || "-"}</p>
              <p>Items: {items.length}</p>
              {items.length > 0 ? (
                <div
                  className="mt-2 flex flex-wrap gap-1.5"
                  role="status"
                  aria-label={`PO status: ${itemsOnPOCount} on PO, ${convertibleItemCount} not on PO`}
                >
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {itemsOnPOCount} on PO
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    {convertibleItemCount} not on PO
                  </span>
                </div>
              ) : null}
              <p className="mt-1">Total Quantity: {totalQuantity} PCS</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Notes
              </p>
              <p className="mt-2 text-slate-600">
                {request.notes || "No notes provided."}
              </p>
            </div>
            <div className="rounded-md border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-center gap-3">
                <Package2 className="h-5 w-5 text-[#175fd3]" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Estimated Amount
                  </p>
                  <p className="text-xl font-extrabold text-[#173c83]">
                    {money(totalAmount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-wide text-[#173c83]">
                Items for Purchase Request
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Supplier prices and case history are calculated from existing
                procurement records.
              </p>
            </div>
            {request.status === "Approved" && convertibleItemCount > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500">
                  {selectedPOItemIds.length} of {convertibleItemCount} open selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPOItemIds(convertibleItemIds)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-[#175fd3] hover:bg-blue-100"
                >
                  <CheckCircle2 className="h-4 w-4" /> Select all open items
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPOItemIds([])}
                  disabled={selectedPOItemIds.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" /> Clear
                </button>
              </div>
            )}
            {["Pending", "Unposted"].includes(request.status || "") && (
              <button
                onClick={() => setShowAddItem(true)}
                className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
              >
                <Plus className="h-4 w-4" /> Add Item
              </button>
            )}
          </div>
          {showAddItem && (
            <div className="border-b border-blue-100 bg-blue-50/50 p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(260px,2fr)_110px_minmax(180px,1fr)_150px_auto_auto] lg:items-end">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600">
                    Product
                  </label>
                  <ProductAutocomplete
                    reorderOnly
                    onSelect={(product) => {
                      setSelectedProduct(product as ProductWithMetadata);
                      setSelectedProductId(product.id);
                    }}
                    placeholder="Low-stock part no. or item code"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {selectedProduct
                      ? `${selectedProduct.part_no} • ${selectedProduct.description}`
                      : "Select a low-stock item to add."}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600">
                    Qty
                  </label>
                  <input
                    aria-label="Add item quantity"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(Number(event.target.value))
                    }
                    className="h-10 w-full rounded border border-slate-300 px-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600">
                    Supplier
                  </label>
                  <select
                    aria-label="Add item supplier"
                    value={selectedSupplierId}
                    onChange={(event) =>
                      setSelectedSupplierId(event.target.value)
                    }
                    className="h-10 w-full rounded border border-slate-300 bg-white px-2"
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.company}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600">
                    Expected ETA
                  </label>
                  <input
                    aria-label="Add item ETA"
                    type="date"
                    value={etaDate}
                    onChange={(event) => setEtaDate(event.target.value)}
                    className="h-10 w-full rounded border border-slate-300 px-2"
                  />
                </div>
                <button
                  onClick={handleAddItem}
                  aria-label="Confirm add item"
                  className="inline-flex h-10 items-center justify-center rounded bg-[#175fd3] px-3 text-white hover:bg-[#0e4fb7]"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  onClick={resetAddItem}
                  aria-label="Close add item"
                  className="inline-flex h-10 items-center justify-center rounded border border-slate-300 bg-white px-3 text-slate-500 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className="mx-5 my-4 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              SR and IR cases show distinct posted return documents during the
              previous 12 months. “Review Supplier” flags items with return
              history.
            </span>
          </div>
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-xs leading-tight">
              <colgroup>
                <col className="w-[3%]" />
                <col className="w-[5%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[13%]" />
                <col className="w-[7%]" />
                <col className="w-[4%]" />
                <col className="w-[14%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[9%]" />
                <col className="w-[5%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#102f76] text-left text-[9px] font-bold uppercase tracking-wide text-white">
                  <th className="px-1.5 py-2.5 text-center">#</th>
                  <th className="px-1.5 py-2.5 text-center">PO</th>
                  <th className="px-1.5 py-2.5">
                    Item Code
                    <br />
                    <span className="font-normal normal-case opacity-80">
                      (Auto)
                    </span>
                  </th>
                  <th className="px-1.5 py-2.5">Part No.</th>
                  <th className="px-1.5 py-2.5">Description</th>
                  <th className="px-1.5 py-2.5 text-center">
                    Required Qty
                    <br />
                    (PCS)
                  </th>
                  <th className="px-1.5 py-2.5">Unit</th>
                  <th className="px-1.5 py-2.5">
                    Preferred Supplier
                    <br />
                    (Lowest Price)
                  </th>
                  <th className="px-1.5 py-2.5 text-right">
                    Unit Price
                    <br />
                    (PHP)
                  </th>
                  <th className="px-1.5 py-2.5 text-right">
                    Amount
                    <br />
                    (PHP)
                  </th>
                  <th className="px-1.5 py-2.5 text-center">
                    SR Cases
                    <br />
                    (12 Months)
                  </th>
                  <th className="px-1.5 py-2.5 text-center">
                    IR Cases
                    <br />
                    (12 Months)
                  </th>
                  <th className="px-1.5 py-2.5">Recommendation</th>
                  <th className="px-1.5 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No items have been added to this request.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const supplierName =
                      item.supplier_name || item.preferred_supplier_name || "-";
                    const unitPrice = Number(
                      item.unit_cost || item.preferred_supplier_price || 0,
                    );
                    const review =
                      Number(item.sr_cases || 0) + Number(item.ir_cases || 0) >
                      0;
                    const itemId = String(item.id || "");
                    const itemOnPO = isItemOnPurchaseOrder(item);
                    const poLabel = String(item.po_number || item.po_refno || "").trim();
                    return (
                      <tr
                        key={item.id || `${item.item_code}-${index}`}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-1.5 py-2.5 text-center text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-1.5 py-2.5 text-center">
                          {itemOnPO ? (
                            <div className="flex flex-col items-center gap-1">
                              <input
                                type="checkbox"
                                checked
                                disabled
                                aria-label={`${item.part_number || item.item_code || "Item"} already on PO ${poLabel}`}
                                title={`Already on ${poLabel || "PO"}`}
                                className="h-4 w-4 rounded border-slate-300 text-[#175fd3] disabled:cursor-not-allowed disabled:opacity-60"
                              />
                              <ModuleRecordLink
                                openInNewTab
                                tab="warehouse-purchasing-purchase-order"
                                payload={{
                                  poId: String(item.po_refno || "").trim() || undefined,
                                  poRefNo: poLabel || undefined,
                                }}
                                aria-label={`Open line purchase order ${poLabel || "record"}`}
                                className="max-w-full truncate text-[9px] font-extrabold text-[#175fd3] underline underline-offset-2 hover:text-[#0e4fb7] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                              >
                                {poLabel || "Open PO"}
                              </ModuleRecordLink>
                            </div>
                          ) : (
                              <input
                                type="checkbox"
                                checked={selectedPOItemIdSet.has(itemId)}
                              disabled={!itemId || request.status !== "Approved"}
                              onChange={(event) => togglePOItemSelection(itemId, event.target.checked)}
                              aria-label={`Select ${item.part_number || item.item_code || "item"} for PO`}
                              title="Select for next PO"
                              className="h-4 w-4 rounded border-slate-300 text-[#175fd3] disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          )}
                        </td>
                        <td
                          className="truncate px-1.5 py-2.5 text-[13px] font-bold text-slate-700"
                          title={item.item_code || ""}
                        >
                          {item.item_code || "-"}
                        </td>
                        <td
                          className="truncate px-1.5 py-2.5 text-[13px] font-bold text-[#173c83]"
                          title={item.part_number || ""}
                        >
                          {item.part_number || "-"}
                        </td>
                        <td
                          className="truncate px-1.5 py-2.5 font-semibold"
                          title={item.description || ""}
                        >
                          {item.description || "-"}
                        </td>
                        <td className="px-1.5 py-2.5 text-center">
                          {["Pending", "Unposted"].includes(request.status || "") ? (
                            <input
                              aria-label={`Quantity ${item.part_number || index + 1}`}
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(event) =>
                                onUpdateItem(item.id, {
                                  quantity: Number(event.target.value),
                                })
                              }
                              className="h-7 w-full rounded border border-slate-300 px-1 text-center"
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="px-1.5 py-2.5">{item.unit || "PCS"}</td>
                        <td className="px-1.5 py-2.5">
                          {["Pending", "Unposted"].includes(request.status || "") ? (
                            <>
                              <select
                                aria-label={`Supplier ${item.part_number || index + 1}`}
                                value={item.supplier_id || ""}
                                onChange={(event) => {
                                  void handleItemSupplierChange(
                                    item,
                                    event.target.value,
                                  );
                                }}
                                className="h-7 w-full rounded border border-slate-300 bg-white px-1 text-[10px] font-semibold"
                              >
                                <option value="">Select supplier</option>
                                {suppliers.map((supplier) => (
                                  <option key={supplier.id} value={supplier.id}>
                                    {supplier.company}
                                  </option>
                                ))}
                              </select>
                              {!item.supplier_id &&
                              item.preferred_supplier_name ? (
                                <span
                                  className="mt-1 block truncate text-[9px] text-slate-500"
                                  title={`Suggested: ${item.preferred_supplier_name}`}
                                >
                                  Suggested: {item.preferred_supplier_name}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span
                              className="block truncate font-semibold"
                              title={supplierName}
                            >
                              {supplierName}
                            </span>
                          )}
                        </td>
                        <td className="px-1.5 py-2.5 text-right">
                          {money(unitPrice)}
                        </td>
                        <td className="px-1.5 py-2.5 text-right font-semibold">
                          {money(Number(item.quantity || 0) * unitPrice)}
                        </td>
                        <td
                          className={`px-1.5 py-2.5 text-center font-semibold ${review ? "text-amber-600" : "text-emerald-700"}`}
                        >
                          {item.sr_cases || 0}
                        </td>
                        <td
                          className={`px-1.5 py-2.5 text-center font-semibold ${review ? "text-amber-600" : "text-emerald-700"}`}
                        >
                          {item.ir_cases || 0}
                        </td>
                        <td
                          className={`px-1.5 py-2.5 font-bold ${recommendationClass(item)}`}
                        >
                          {review ? (
                            <button
                              type="button"
                              onClick={() => setHistoryItem(item)}
                              aria-label={`Review return history for ${item.part_number || item.item_code || "item"}`}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 hover:bg-amber-50 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            >
                              <Info className="h-4 w-4" />
                              Review
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap px-1 py-0.5">
                              <CheckCircle2 className="h-4 w-4" />
                              Good
                            </span>
                          )}
                        </td>
                        <td className="px-1.5 py-2.5 text-center">
                          {item.notes ? (
                            <button
                              type="button"
                              title={item.notes}
                              aria-label={`View note for ${item.part_number || "item"}`}
                              className="mr-2 text-slate-500 hover:text-[#175fd3]"
                            >
                              <MessageSquare className="inline h-4 w-4" />
                            </button>
                          ) : null}
                          {["Pending", "Unposted"].includes(request.status || "") && (
                            <button
                              type="button"
                              aria-label={`Delete ${item.part_number || "item"}`}
                              onClick={() =>
                                handleDeleteItemRequest(
                                  item.id,
                                  item.part_number,
                                )
                              }
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="inline h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-[#173c83]">
                  <td colSpan={5} className="px-3 py-4 text-right uppercase">
                    Total
                  </td>
                  <td className="px-3 py-4 text-center">{totalQuantity} PCS</td>
                  <td colSpan={3}></td>
                  <td className="px-3 py-4 text-right text-sm">
                    {money(totalAmount)}
                  </td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={async () => {
          if (confirmModal.onConfirm) await confirmModal.onConfirm();
          closeConfirm();
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
      />
      <RecoveryReasonModal
        isOpen={recoveryAction !== null}
        action={recoveryAction || "unpost"}
        recordLabel={request.pr_number}
        description={recoveryAction === "unpost" ? "This returns the purchase request to Unposted once related purchase orders have also been unposted, cancelled, or deleted." : "This keeps an audit trail and removes this draft request from active work."}
        onClose={() => setRecoveryAction(null)}
        onConfirm={(reason) => handleRecovery(recoveryAction || "unpost", reason)}
      />
      {historyItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="return-history-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHistoryItem(null);
          }}
        >
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 id="return-history-title" className="text-lg font-bold text-slate-900">
                  Return history
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {historyItem.part_number || historyItem.item_code || historyItem.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryItem(null)}
                aria-label="Close return history"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-600">
                These counts are distinct posted return documents from the previous 12 months. Open the matching records below.
              </p>
              <button
                type="button"
                disabled={Number(historyItem.sr_cases || 0) === 0}
                onClick={() => openItemReturnHistory(historyItem, "sales")}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  <span className="block font-bold text-slate-800">Sales returns (SR)</span>
                  <span className="text-xs text-slate-500">Customer sales-return documents</span>
                </span>
                <span className="inline-flex items-center gap-2 font-bold text-blue-700">
                  {Number(historyItem.sr_cases || 0)} <ExternalLink className="h-4 w-4" />
                </span>
              </button>
              <button
                type="button"
                disabled={Number(historyItem.ir_cases || 0) === 0}
                onClick={() => openItemReturnHistory(historyItem, "supplier")}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  <span className="block font-bold text-slate-800">Supplier returns (IR)</span>
                  <span className="text-xs text-slate-500">Inventory returned to suppliers</span>
                </span>
                <span className="inline-flex items-center gap-2 font-bold text-blue-700">
                  {Number(historyItem.ir_cases || 0)} <ExternalLink className="h-4 w-4" />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseRequestView;
