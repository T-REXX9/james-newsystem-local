import React, { useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { queueCallRequest } from '../services/callingSystemService';

interface CallCustomerButtonProps {
  phoneNumber?: string | null;
  customerId?: string | number;
  label?: string;
  className?: string;
  onQueued?: () => void;
}

const CallCustomerButton: React.FC<CallCustomerButtonProps> = ({
  phoneNumber,
  customerId,
  label = 'Call customer',
  className = '',
  onQueued,
}) => {
  const [isQueueing, setIsQueueing] = useState(false);
  const phone = String(phoneNumber || '').trim();
  const disabled = isQueueing || !phone;

  const handleQueue = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!phone || isQueueing) return;

    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Open the phone dialer for ${phone}? The registered staff phone will open its dialer automatically.`);
    if (!confirmed) return;

    setIsQueueing(true);
    try {
      const result = await queueCallRequest(phone, customerId);
      if (!result.queued) throw new Error('The call request was not queued.');
      toast.success('Call request sent to the staff phone', {
        description: 'The registered staff phone will open the default dialer automatically.',
      });
      onQueued?.();
    } catch (error) {
      toast.error('Unable to request call', {
        description: error instanceof Error ? error.message : 'Please check the staff login and phone connection.',
      });
    } finally {
      setIsQueueing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleQueue}
      disabled={disabled}
      title={phone ? `Request call to ${phone}` : 'No phone number available'}
      aria-label={phone ? `${label}: ${phone}` : 'No phone number available'}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50 ${className}`}
    >
      {isQueueing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
      {isQueueing ? 'Queuing…' : label}
    </button>
  );
};

export default CallCustomerButton;
