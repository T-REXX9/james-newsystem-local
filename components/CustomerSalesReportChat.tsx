import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, ImagePlus, Loader2, Send, Trash2, X } from 'lucide-react';
import {
  deleteSalesReportMessage,
  fetchSalesReportConversation,
  markSalesReportConversationRead,
  resolveSalesReportAttachmentDisplayUrl,
  sendSalesReportMessage,
  uploadSalesReportAttachment,
} from '../services/dailyCallMonitoringService';
import ConfirmModal from './ConfirmModal';
import { CustomerStatus, SalesReportConversationMessage, UserProfile } from '../types';
import { useToast } from './ToastProvider';
import { optimizeRecordImage, RECORD_IMAGE_ACCEPT, validateRecordImageFile } from '../utils/recordImage';

import { shouldSuppressAuthError } from '../services/localApiAuth';
import { requestCustomerUpdate } from '../services/customerWorkflowLocalApiService';
interface CustomerSalesReportChatProps {
  contactId: string;
  currentUser: UserProfile | null;
  viewOnly?: boolean;
  compact?: boolean;
  className?: string;
  onConversationRead?: (contactId: string) => void;
  initialActivityRef?: string;
  autoScroll?: boolean;
  animateMessages?: boolean;
}

const kindLabel = (kind: SalesReportConversationMessage['kind']): string => {
  switch (kind) {
    case 'agent_report':
      return 'Sales agent report';
    case 'management_instruction':
      return 'Management instruction';
    case 'staff_comment':
      return 'Staff comment';
    default:
      return 'Message';
  }
};

const roleLabel = (role: SalesReportConversationMessage['sender_role']): string =>
  role === 'master' ? 'Master User' : 'Sales Agent';

const senderLabel = (message: SalesReportConversationMessage): string => {
  const name = message.sender_name.trim();
  if (name) return name;
  if (message.sender_user_id.trim()) return `User #${message.sender_user_id.trim()}`;
  return roleLabel(message.sender_role);
};

const formatTimestamp = (value?: string) => {
  if (!value) return '—';
  const normalized = value.includes(' ') && !value.includes('T')
    ? value.replace(' ', 'T')
    : value;
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date)} PHT`;
};


const AuthenticatedAttachmentImage: React.FC<{ attachmentUrl: string; className?: string }> = ({
  attachmentUrl,
  className = '',
}) => {
  const [displayUrl, setDisplayUrl] = useState<string>('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setFailed(false);
    setDisplayUrl('');

    void resolveSalesReportAttachmentDisplayUrl(attachmentUrl)
      .then((url) => {
        if (cancelled) {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url.startsWith('blob:') ? url : null;
        setDisplayUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentUrl]);

  if (failed) {
    return <p className="mt-2 text-[10px] text-slate-400">Picture could not be loaded.</p>;
  }
  if (!displayUrl) {
    return (
      <div className="mt-2 flex h-24 items-center justify-center rounded-lg border border-dashed border-white/30 text-[10px] opacity-80">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <a href={displayUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg border border-white/30">
      <img src={displayUrl} alt="Attached picture" className={className || 'max-h-48 w-full object-cover'} />
    </a>
  );
};

const CustomerSalesReportChat: React.FC<CustomerSalesReportChatProps> = ({
  contactId,
  currentUser,
  viewOnly = false,
  compact = false,
  className = '',
  onConversationRead,
  initialActivityRef,
  autoScroll = true,
  animateMessages = true,
}) => {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [messages, setMessages] = useState<SalesReportConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showBlacklistRequest, setShowBlacklistRequest] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [messageToDelete, setMessageToDelete] = useState<SalesReportConversationMessage | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const isMasterUser = String(currentUser?.user_type || '') === '1' || currentUser?.role === 'Master User';

  const loadConversation = useCallback(async () => {
    setLoading(true);
    try {
      const conversation = await fetchSalesReportConversation(contactId);
      setMessages(conversation.messages);
      if (conversation.unread_count > 0) {
        await markSalesReportConversationRead(contactId).catch(() => undefined);
        onConversationRead?.(contactId);
      }
    } catch (error) {
      if (shouldSuppressAuthError(error)) return;
      console.error('Error loading Agent Sales Report conversation:', error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to load Agent Sales Report.',
      });
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, contactId, onConversationRead]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (autoScroll && !compact && typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [autoScroll, compact, messages.length]);

  useEffect(() => {
    if (!initialActivityRef || compact) return;
    activityRefs.current[initialActivityRef]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [compact, initialActivityRef, messages]);

  const handlePickImage = async (file: File | null) => {
    if (!file) return;
    const validationError = validateRecordImageFile(file);
    if (validationError) {
      addToast({ type: 'error', message: validationError });
      return;
    }
    try {
      const optimized = await optimizeRecordImage(file);
      setPendingImageDataUrl(optimized);
    } catch (error) {
      if (shouldSuppressAuthError(error)) return;
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to process that picture.',
      });
    }
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body && !pendingImageDataUrl) return;
    if (!currentUser) {
      addToast({ type: 'error', message: 'Sign in again before sending a message.' });
      return;
    }

    setSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentMime: string | null = null;
      if (pendingImageDataUrl) {
        const uploaded = await uploadSalesReportAttachment(contactId, pendingImageDataUrl);
        if (!uploaded.url) {
          throw new Error('Picture upload did not return a URL.');
        }
        attachmentUrl = uploaded.url;
        attachmentMime = uploaded.mime;
      }

      const message = await sendSalesReportMessage({
        contactId,
        body,
        senderName: currentUser.full_name || currentUser.email || 'Staff',
        attachmentUrl,
        attachmentMime,
      });
      setMessages((prev) => [...prev, message]);
      setDraft('');
      setPendingImageDataUrl(null);
      addToast({ type: 'success', message: 'Message sent.' });
    } catch (error) {
      if (shouldSuppressAuthError(error)) return;
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to send message.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlacklistRequest = async () => {
    const reason = blacklistReason.trim();
    if (!reason) { addToast({ type: 'error', message: 'Enter a reason.' }); return; }
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const message = await sendSalesReportMessage({ contactId, body: `Reject / blacklist request\nReason: ${reason}`, senderName: currentUser.full_name || currentUser.email || 'Staff' });
      setMessages((prev) => [...prev, message]);
      await requestCustomerUpdate(contactId, { status: CustomerStatus.BLACKLISTED, debtType: 'Bad', comment: reason });
      setBlacklistReason('');
      setShowBlacklistRequest(false);
      addToast({ type: 'success', message: 'Request sent for management approval.' });
    } catch (error) {
      if (shouldSuppressAuthError(error)) return;
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Unable to submit request.' });
    } finally { setSubmitting(false); }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;
    const reason = deleteReason.trim();
    if (!reason) return;
    try {
      await deleteSalesReportMessage(contactId, messageToDelete.id, reason);
      setMessages((previous) => previous.filter((message) => message.id !== messageToDelete.id));
      setMessageToDelete(null);
      setDeleteReason('');
      addToast({ type: 'success', message: 'Message deleted and recorded.' });
    } catch (error) {
      if (shouldSuppressAuthError(error)) return;
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Unable to delete message.' });
      throw error;
    }
  };

  const visibleMessages = compact ? messages.slice(-8) : messages;

  if (loading) {
    return (
      <div className={`grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500 ${className}`}>
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Agent Sales Report…
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-blue-100/80 bg-gradient-to-b from-slate-50 to-white shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 ${className}`}>
      <header className="relative overflow-hidden border-b border-blue-100/80 bg-gradient-to-r from-white via-blue-50/70 to-slate-50 px-4 py-3 dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-900">
        <div className="pointer-events-none absolute -right-6 -top-10 h-20 w-20 rounded-full bg-blue-400/15 blur-2xl" />
        <div className="relative flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-blue text-white shadow-sm shadow-blue-900/20">
            <Send className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-100">Agent Sales Report</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Chronological chat with the assigned sales agent and management</p>
          </div>
        </div>
      </header>

      <div className={`space-y-3 overflow-y-auto bg-blue-50/20 p-4 dark:bg-blue-950/10 ${compact ? 'max-h-[18rem]' : 'max-h-[28rem] min-h-[14rem]'}`}>
        {visibleMessages.length === 0 ? (
          <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
            No Agent Sales Report messages yet for this customer.
          </div>
        ) : (
          visibleMessages.map((message) => {
            const isMine = message.is_from_current_user;
            const showBody = message.body && message.body !== '[Picture]';
            const sender = senderLabel(message);
            return (
              <div key={message.id} ref={(node) => { activityRefs.current[message.id] = node; }} className={`flex ${animateMessages ? 'motion-safe:animate-[james-fade-up_300ms_ease-out_both]' : ''} ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    isMine
                      ? 'bg-brand-blue text-white'
                        : message.is_from_master || message.kind === 'management_instruction'
                        ? 'border border-violet-200 bg-violet-50 text-slate-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-slate-100'
                        : 'border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                  }`}
                >
                  <p className={`mb-1 text-[10px] font-semibold ${isMine ? 'text-blue-100' : 'text-slate-500'}`}>
                    {sender}{isMine ? ' (You)' : ''} · {roleLabel(message.sender_role)} · {kindLabel(message.kind)}
                  </p>
                  {showBody && <p className="whitespace-pre-wrap leading-6">{message.body}</p>}
                  {message.attachment_url && (
                    <AuthenticatedAttachmentImage attachmentUrl={message.attachment_url} />
                  )}
                  <p className={`mt-2 text-[10px] ${isMine ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
                    {formatTimestamp(message.created_at)}
                  </p>
                  {!viewOnly && isMasterUser && (message.id.startsWith('report:') || /^\d+$/.test(message.id)) && (
                    <button
                      type="button"
                      onClick={() => { setMessageToDelete(message); setDeleteReason(''); }}
                      className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold ${isMine ? 'text-blue-100 hover:text-white' : 'text-rose-600 hover:text-rose-700 dark:text-rose-300'}`}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {!viewOnly && !compact && (
        <div className="border-t border-blue-100/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/90">
          {showBlacklistRequest && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/20">
              <label htmlFor="sales-report-blacklist-reason" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Reason <span className="text-rose-600">*</span></label>
              <textarea id="sales-report-blacklist-reason" value={blacklistReason} onChange={(event) => setBlacklistReason(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setShowBlacklistRequest(false); setBlacklistReason(''); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Cancel</button>
                <button type="button" disabled={submitting || !blacklistReason.trim()} onClick={() => void handleBlacklistRequest()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Submit Request</button>
              </div>
            </div>
          )}
          {pendingImageDataUrl && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <img src={pendingImageDataUrl} alt="Pending attachment" className="h-16 w-16 rounded object-cover" />
              <button
                type="button"
                aria-label="Remove pending picture"
                onClick={() => setPendingImageDataUrl(null)}
                className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Write a message</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Reply in the Agent Sales Report conversation…"
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900"
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={RECORD_IMAGE_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  void handlePickImage(event.target.files?.[0] || null);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-brand-blue dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/40"
              >
                <ImagePlus className="h-4 w-4" />
                Picture
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowBlacklistRequest((visible) => !visible)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
              >
                <Ban className="h-4 w-4" />
                Reject / Blacklist
              </button>
            </div>
            <button
              type="button"
              disabled={submitting || (!draft.trim() && !pendingImageDataUrl)}
              onClick={() => void handleSend()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={messageToDelete !== null}
        onClose={() => { setMessageToDelete(null); setDeleteReason(''); }}
        onConfirm={handleDeleteMessage}
        title="Delete message"
        message="The message will be removed from this chat. Its original content and deletion details will remain in the audit history."
        confirmLabel="Delete"
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        reasonLabel="Reason"
        reasonRequired
      />
    </div>
  );
};

export default CustomerSalesReportChat;
