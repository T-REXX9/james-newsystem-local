import React from 'react';
import { GenericMaintenanceTable } from '../GenericMaintenanceTable';

export default function SpecialPrice() {
    return (
        <GenericMaintenanceTable
            tableName="price_groups"
            title="Special Price (Price Groups)"
            columns={[
                { key: 'name', label: 'Group Name' },
                { key: 'code', label: 'Code' },
                { key: 'description', label: 'Description' }
            ]}
        />
    );
}
