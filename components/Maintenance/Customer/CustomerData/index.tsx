import React from 'react';
import CustomerDatabase from '../../../CustomerDatabase';

export function CustomerData({ initialContactId }: { initialContactId?: string }) {
    return (
        <div className="h-full w-full">
            <CustomerDatabase initialContactId={initialContactId} />
        </div>
    );
}
