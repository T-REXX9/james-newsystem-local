import { getLocalAuthSession, getLocalAuthToken } from './localAuthService';
import { parseApiErrorMessage } from './localApiAuth';
const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const getMainId = (): number => {
    const session = getLocalAuthSession();
    const mainId = Number(
        session?.context?.main_userid
        || session?.context?.user?.main_userid
        || API_MAIN_ID
        || 1
    );
    return Number.isFinite(mainId) && mainId > 0 ? mainId : 1;
};

export interface RemarkTemplateRecord {
    id: number;
    name: string;
}

export interface RemarkTemplateListResponse {
    items: RemarkTemplateRecord[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}

const requestJson = async (url: string, init?: RequestInit): Promise<any> => {
    const headers = new Headers(init?.headers);
    const token = getLocalAuthToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { ...init, headers });
    if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
    }

    return response.json();
};

export const fetchRemarkTemplates = async (search = ''): Promise<RemarkTemplateListResponse> => {
    const query = new URLSearchParams({
        main_id: String(getMainId()),
        search,
        page: '1',
        per_page: '500',
    });
    const payload = await requestJson(`${API_BASE_URL}/remark-templates?${query.toString()}`);
    return payload?.data || { items: [], meta: { page: 1, per_page: 500, total: 0, total_pages: 0 } };
};

export const createRemarkTemplate = async (name: string): Promise<RemarkTemplateRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/remark-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: getMainId(), name }),
    });
    return payload?.data;
};

export const updateRemarkTemplate = async (
    remarkTemplateId: number,
    name: string
): Promise<RemarkTemplateRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/remark-templates/${remarkTemplateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: getMainId(), name }),
    });
    return payload?.data;
};

export const deleteRemarkTemplate = async (remarkTemplateId: number): Promise<void> => {
    const query = new URLSearchParams({ main_id: String(getMainId()) });
    await requestJson(`${API_BASE_URL}/remark-templates/${remarkTemplateId}?${query.toString()}`, {
        method: 'DELETE',
    });
};
