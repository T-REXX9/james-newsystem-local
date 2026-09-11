import React from 'react';
import { ArrowRight, Calendar } from 'lucide-react';
import ModuleRecordLink from './ModuleRecordLink';

type ProcurementDocument = {
  number?: string | null;
  date?: string | null;
  id?: string | null;
};

interface ProcurementDocumentBannerProps {
  pr?: ProcurementDocument | null;
  po?: ProcurementDocument | ProcurementDocument[] | null;
  rr?: ProcurementDocument | ProcurementDocument[] | null;
  etaDate?: string | null;
}

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: '2-digit' }).replace(/ /g, '\u2011').replace(',', '').toUpperCase();
};

const normalizeDocuments = (value?: ProcurementDocument | ProcurementDocument[] | null) =>
  (Array.isArray(value) ? value : value ? [value] : []).filter((document) => String(document?.number || document?.id || '').trim());

const documentDate = (documents: ProcurementDocument[]) => {
  const firstDate = documents.find((document) => String(document.date || '').trim())?.date;
  return formatDate(firstDate);
};

const DocumentNumbers: React.FC<{
  documents: ProcurementDocument[];
  fallback: string;
  colorClass: string;
  tab: string;
  payloadKey: string;
  payloadNumberKey?: string;
}> = ({ documents, fallback, colorClass, tab, payloadKey, payloadNumberKey }) => {
  if (documents.length === 0) {
    return <span className={`text-2xl font-bold ${colorClass}`}>{fallback}</span>;
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {documents.map((document, index) => {
        const number = String(document.number || document.id || fallback).trim();
        const id = String(document.id || '').trim();
        const canLink = Boolean(id || (payloadNumberKey && number));
        const key = `${id || number}-${index}`;
        const className = `text-2xl font-bold ${colorClass} underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`;
        const payload = {
          [payloadKey]: id || undefined,
          ...(payloadNumberKey ? { [payloadNumberKey]: number || undefined } : {}),
        };

        return (
          <React.Fragment key={key}>
            {canLink ? (
              <ModuleRecordLink tab={tab} payload={payload} className={className}>
                {number}
              </ModuleRecordLink>
            ) : (
              <span className={`text-2xl font-bold ${colorClass}`}>{number}</span>
            )}
            {index < documents.length - 1 ? <span className="text-xl font-bold text-slate-300">/</span> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const ProcurementDocumentBanner: React.FC<ProcurementDocumentBannerProps> = ({ pr, po, rr, etaDate }) => {
  const prDocuments = normalizeDocuments(pr);
  const poDocuments = normalizeDocuments(po);
  const rrDocuments = normalizeDocuments(rr);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-[160px] flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-orange-500">PR No.</span>
        <DocumentNumbers
          documents={prDocuments}
          fallback="PR-UNKNOWN"
          colorClass="text-orange-500"
          tab="warehouse-purchasing-purchase-request"
          payloadKey="prId"
        />
        <span className="mt-2 text-xs font-semibold text-slate-500">PR Date</span>
        <span className="text-sm font-semibold text-slate-700">{documentDate(prDocuments)}</span>
      </div>

      <ArrowRight className="hidden h-6 w-6 text-slate-300 xl:block" />

      <div className="flex min-w-[160px] flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-[#175fd3]">PO No.</span>
        <DocumentNumbers
          documents={poDocuments}
          fallback="-"
          colorClass="text-[#175fd3]"
          tab="warehouse-purchasing-purchase-order"
          payloadKey="poId"
          payloadNumberKey="poRefNo"
        />
        <span className="mt-2 text-xs font-semibold text-slate-500">PO Date</span>
        <span className="text-sm font-semibold text-slate-700">{documentDate(poDocuments)}</span>
      </div>

      <ArrowRight className="hidden h-6 w-6 text-slate-300 xl:block" />

      <div className="flex min-w-[160px] flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-emerald-600">RR No.</span>
        <DocumentNumbers
          documents={rrDocuments}
          fallback="-"
          colorClass="text-emerald-600"
          tab="warehouse-purchasing-receiving-stock"
          payloadKey="rrId"
          payloadNumberKey="rrRefNo"
        />
        <span className="mt-2 text-xs font-semibold text-slate-500">RR Date</span>
        <span className="text-sm font-semibold text-slate-700">{documentDate(rrDocuments)}</span>
      </div>

      <div className="hidden h-24 w-px bg-slate-200 xl:block"></div>

      <div className="flex min-w-[180px] flex-col justify-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">ETA Date</span>
        </div>
        <span className="mt-1 text-lg font-bold text-slate-800">{formatDate(etaDate)}</span>
        <span className="text-xs font-semibold text-slate-500">(Estimated Arrival)</span>
      </div>
    </div>
  );
};

export default ProcurementDocumentBanner;
