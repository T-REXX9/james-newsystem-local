import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import {
  fetchSalesReportConversation,
  markSalesReportConversationRead,
  resolveSalesReportAttachmentDisplayUrl,
  sendSalesReportMessage,
  uploadSalesReportAttachment,
} from '../services/dailyCallMonitoringService';
import { SalesReportConversationMessage, UserProfile } from '../types';
import { useToast } from './ToastProvider';
import { formatDateTime } from '../utils/formatUtils';
import { optimizeRecordImage, RECORD_IMAGE_ACCEPT, validateRecordImageFile } from '../utils/recordImage';

interface CustomerSalesReportChatProps {
  contactId: string;
  currentUser: UserProfile | null;
  viewOnly?: boolean;
  compact?: boolean;
  className?: string;
  onConversationRead?: (contactId: string) => void;
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

const formatTimestamp = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDateTime(date);
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
}) => {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<SalesReportConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (!compact && typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [compact, messages.length]);

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
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to send message.',
      });
    } finally {
      setSubmitting(false);
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
    <div className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${className}`}>
      <header className="border-b border-slate-200 bg-white px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Agent Sales Report</p>
        <p className="text-[10px] text-slate-500">Chronological chat with the assigned sales agent and management</p>
      </header>

      <div className={`space-y-3 overflow-y-auto p-3 ${compact ? 'max-h-[18rem]' : 'max-h-[28rem] min-h-[14rem]'}`}>
        {visibleMessages.length === 0 ? (
          <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-slate-200 bg-white px-4 text-center text-xs text-slate-500">
            No Agent Sales Report messages yet for this customer.
          </div>
        ) : (
          visibleMessages.map((message) => {
            const isMine = message.is_from_current_user;
            const showBody = message.body && message.body !== '[Picture]';
            return (
              <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    isMine
                      ? 'bg-brand-blue text-white'
                      : message.is_from_master || message.kind === 'management_instruction'
                        ? 'border border-violet-200 bg-violet-50 text-slate-900'
                        : 'border border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  <p className={`mb-1 text-[10px] font-semibold ${isMine ? 'text-blue-100' : 'text-slate-500'}`}>
                    {isMine ? 'You' : message.sender_name} · {kindLabel(message.kind)}
                  </p>
                  {showBody && <p className="whitespace-pre-wrap leading-6">{message.body}</p>}
                  {message.attachment_url && (
                    <AuthenticatedAttachmentImage attachmentUrl={message.attachment_url} />
                  )}
                  <p className={`mt-2 text-[10px] ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>
                    {formatTimestamp(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {!viewOnly && !compact && (
        <div className="border-t border-slate-200 bg-white p-3">
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
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div>
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <ImagePlus className="h-4 w-4" />
                Picture
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
    </div>
  );
};

export default CustomerSalesReportChat;
