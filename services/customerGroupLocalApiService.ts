import { getLocalAuthSession } from './localAuthService';

import { parseApiErrorMessage } from './localApiAuth';
const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export interface CustomerGroupRecord {
    id: number;
    name: string;
    contact_count: number;
}

export interface CustomerGroupListResponse {
    items: CustomerGroupRecord[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}

const requestJson = async (url: string, init?: RequestInit): Promise<any> => {
    const headers = new Headers(init?.headers);
    const token = getLocalAuthSession()?.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { ...init, headers });
    if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
    }

    return response.json();
};

export const fetchCustomerGroups = async (search = ''): Promise<CustomerGroupListResponse> => {
    const query = new URLSearchParams({
        main_id: String(API_MAIN_ID),
        search,
        page: '1',
        per_page: '500',
    });
    const payload = await requestJson(`${API_BASE_URL}/customer-groups?${query.toString()}`);
    return payload?.data || { items: [], meta: { page: 1, per_page: 500, total: 0, total_pages: 0 } };
};

export const createCustomerGroup = async (name: string): Promise<CustomerGroupRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/customer-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, name }),
    });
    return payload?.data;
};

export const updateCustomerGroup = async (
    groupId: number,
    name: string
): Promise<CustomerGroupRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/customer-groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, name }),
    });
    return payload?.data;
};

export const deleteCustomerGroup = async (groupId: number): Promise<void> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    await requestJson(`${API_BASE_URL}/customer-groups/${groupId}?${query.toString()}`, {
        method: 'DELETE',
    });
};
