// @ts-nocheck
import { UserProfile } from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export interface StaffRecord {
    id: string;
    full_name: string;
    email: string;
    role: string;
    group_id?: string | null;
    mobile: string;
    team_id: string;
    team_name?: string;
    status: number;
    birthday?: string;
    avatar_url?: string;
    monthly_quota?: number;
    commission?: number;
    created_at: string;
}

export interface StaffDetailRecord extends StaffRecord {
    first_name: string;
    middle_name: string;
    last_name: string;
    role_id: number;
    contact: string;
    gender: string;
    branch_id: number;
    sales_quota: number;
    prospect_quota: number;
}

export interface StaffListResponse {
    items: StaffRecord[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}

export interface StaffUpdateInput {
    full_name?: string;
    role?: string;
    group_id?: string | null;
    mobile?: string;
    team_id?: string;
    birthday?: string;
    gender?: string;
    contact?: string;
    avatar_url?: string;
    sales_quota?: number;
    prospect_quota?: number;
    commission?: number;
    branch_id?: number;
}

export interface StaffCreateInput {
    full_name: string;
    email: string;
    password: string;
    role: string;
    group_id?: string;
    mobile?: string;
    birthday?: string;
    access_rights?: string[];
}

const parseApiErrorMessage = async (response: Response): Promise<string> => {
    try {
        const payload = await response.json();
        if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
        if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
    } catch {
        // ignore parse errors
    }
    return `API request failed (${response.status})`;
};

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

export const fetchStaff = async (search = '', page = 1, perPage = 100): Promise<StaffListResponse> => {
    const query = new URLSearchParams({
        main_id: String(API_MAIN_ID),
        search,
        page: String(page),
        per_page: String(perPage),
    });
    const payload = await requestJson(`${API_BASE_URL}/staff?${query.toString()}`);
    return payload?.data || { items: [], meta: { page: 1, per_page: perPage, total: 0, total_pages: 0 } };
};

/** The single source for active staff assignment options across the app. */
export const fetchAssignableStaff = async (): Promise<UserProfile[]> => {
    const result = await fetchStaff('', 1, 500);

    return result.items
        .map((staff) => ({
            id: String(staff.id || '').trim(),
            email: String(staff.email || '').trim(),
            full_name: String(staff.full_name || '').trim(),
            role: String(staff.role || '').trim(),
        }))
        .filter((staff) => staff.id && staff.full_name && staff.full_name !== '0')
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
};

export const fetchStaffById = async (staffId: string | number): Promise<StaffDetailRecord> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    const payload = await requestJson(`${API_BASE_URL}/staff/${staffId}?${query.toString()}`);
    return payload?.data;
};

export const createStaff = async (data: StaffCreateInput): Promise<StaffRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, ...data }),
    });
    return payload?.data;
};

export const updateStaff = async (staffId: string | number, data: StaffUpdateInput): Promise<StaffDetailRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, ...data }),
    });
    return payload?.data;
};

export const changeStaffPassword = async (staffId: string | number, newPassword: string): Promise<void> => {
    await requestJson(`${API_BASE_URL}/staff/${staffId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, new_password: newPassword }),
    });
};

export const deleteStaff = async (staffId: string | number): Promise<void> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    await requestJson(`${API_BASE_URL}/staff/${staffId}?${query.toString()}`, {
        method: 'DELETE',
    });
};
