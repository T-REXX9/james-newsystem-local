// @ts-nocheck
const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export interface ApproverRecord {
    id: string;
    user_id: string;
    staff_id: string;
    module: string;
    level: number;
    staff_name?: string;
    staff_email?: string;
    created_at?: string;
}

export interface ApproverListResponse {
    items: ApproverRecord[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}

export interface StaffOption {
    id: string;
    full_name: string;
    email: string;
}

export interface ApproverCreateInput {
    user_id: string;
    module: string;
    level: number;
}

export interface ApproverUpdateInput {
    user_id?: string;
    module?: string;
    level?: number;
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

export const fetchApprovers = async (search = '', module = '', page = 1, perPage = 100): Promise<ApproverListResponse> => {
    const query = new URLSearchParams({
        main_id: String(API_MAIN_ID),
        search,
        module,
        page: String(page),
        per_page: String(perPage),
    });
    const payload = await requestJson(`${API_BASE_URL}/approvers?${query.toString()}`);
    return payload?.data || { items: [], meta: { page: 1, per_page: perPage, total: 0, total_pages: 0 } };
};

export const fetchApproverById = async (approverId: string | number): Promise<ApproverRecord> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    const payload = await requestJson(`${API_BASE_URL}/approvers/${approverId}?${query.toString()}`);
    return payload?.data;
};

export const createApprover = async (data: ApproverCreateInput): Promise<ApproverRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/approvers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, ...data }),
    });
    return payload?.data;
};

export const updateApprover = async (approverId: string | number, data: ApproverUpdateInput): Promise<ApproverRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/approvers/${approverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, ...data }),
    });
    return payload?.data;
};

export const deleteApprover = async (approverId: string | number): Promise<void> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    await requestJson(`${API_BASE_URL}/approvers/${approverId}?${query.toString()}`, {
        method: 'DELETE',
    });
};

export const fetchAvailableStaff = async (): Promise<StaffOption[]> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    const payload = await requestJson(`${API_BASE_URL}/approvers/staff?${query.toString()}`);
    return payload?.data || [];
};
