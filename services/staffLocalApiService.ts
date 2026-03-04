// @ts-nocheck
const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export interface StaffRecord {
    id: string;
    full_name: string;
    email: string;
    role: string;
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

export interface RoleRecord {
    id: number;
    name: string;
}

export interface StaffUpdateInput {
    full_name?: string;
    role?: string;
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
    const response = await fetch(url, init);
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

export const fetchStaffById = async (staffId: string | number): Promise<StaffDetailRecord> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    const payload = await requestJson(`${API_BASE_URL}/staff/${staffId}?${query.toString()}`);
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

export const deleteStaff = async (staffId: string | number): Promise<void> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    await requestJson(`${API_BASE_URL}/staff/${staffId}?${query.toString()}`, {
        method: 'DELETE',
    });
};

export const fetchRoles = async (): Promise<RoleRecord[]> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    const payload = await requestJson(`${API_BASE_URL}/staff/roles?${query.toString()}`);
    return payload?.data || [];
};
