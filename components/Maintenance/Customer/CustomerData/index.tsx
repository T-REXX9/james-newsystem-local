import React from 'react';
import CustomerDatabase from '../../../CustomerDatabase';

export function CustomerData({ initialContactId, initialConversationType, initialActivityRef }: { initialContactId?: string; initialConversationType?: string; initialActivityRef?: string }) {
    return (
        <div className="h-full w-full">
            <CustomerDatabase initialContactId={initialContactId} initialConversationType={initialConversationType} initialActivityRef={initialActivityRef} />
        </div>
    );
}
