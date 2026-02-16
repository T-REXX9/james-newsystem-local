import React, { useState } from 'react';
import { Plus, Trash2, User } from 'lucide-react';
import { ContactPerson } from '../../../../maintenance.types';

interface ContactPersonsProps {
    contacts: ContactPerson[];
    onChange: (contacts: ContactPerson[]) => void;
}

export const ContactPersons: React.FC<ContactPersonsProps> = ({ contacts, onChange }) => {
    const handleAdd = () => {
        const newContact: ContactPerson = {
            id: `temp-${Date.now()}`, // Temp ID for UI
            contact_id: '',
            name: '',
            position: '',
            mobile_number: '',
            email: '',
            is_primary: contacts.length === 0,
        };
        onChange([...contacts, newContact]);
    };

    const handleUpdate = (index: number, field: keyof ContactPerson, value: any) => {
        const updated = [...contacts];
        updated[index] = { ...updated[index], [field]: value };
        onChange(updated);
    };

    const handleDelete = (index: number) => {
        const updated = [...contacts];
        updated.splice(index, 1);
        onChange(updated);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Contact Persons</h3>
                <button
                    type="button"
                    onClick={handleAdd}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                    <Plus size={16} /> Add Contact
                </button>
            </div>

            <div className="space-y-3">
                {contacts.map((contact, index) => (
                    <div key={contact.id || index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Name"
                                    className="w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2"
                                    value={contact.name}
                                    onChange={(e) => handleUpdate(index, 'name', e.target.value)}
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    placeholder="Position"
                                    className="w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2"
                                    value={contact.position || ''}
                                    onChange={(e) => handleUpdate(index, 'position', e.target.value)}
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    placeholder="Mobile Number"
                                    className="w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2"
                                    value={contact.mobile_number || ''}
                                    onChange={(e) => handleUpdate(index, 'mobile_number', e.target.value)}
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    placeholder="Email"
                                    className="w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2"
                                    value={contact.email || ''}
                                    onChange={(e) => handleUpdate(index, 'email', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <label className="flex items-center gap-2 text-xs text-gray-500">
                                <input
                                    type="radio"
                                    name="primary_contact"
                                    checked={contact.is_primary}
                                    onChange={() => {
                                        const updated = contacts.map((c, i) => ({ ...c, is_primary: i === index }));
                                        onChange(updated);
                                    }}
                                    className="text-blue-600"
                                />
                                Primary Contact
                            </label>
                            <button
                                type="button"
                                onClick={() => handleDelete(index)}
                                className="text-red-500 hover:text-red-700 p-1"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
                {contacts.length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                        No contact persons added
                    </div>
                )}
            </div>
        </div>
    );
};
