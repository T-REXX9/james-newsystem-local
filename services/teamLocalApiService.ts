// @ts-nocheck
import { parseApiErrorMessage } from './localApiAuth';
import { getLocalAuthToken } from './localAuthService';
const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export interface TeamRecord {
    id: number;
    name: string;
    status: number;
    member_count: number;
}

export interface TeamListResponse {
    items: TeamRecord[];
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

export const fetchTeams = async (search = ''): Promise<TeamListResponse> => {
    const query = new URLSearchParams({
        main_id: String(API_MAIN_ID),
        search,
        page: '1',
        per_page: '500',
    });
    const payload = await requestJson(`${API_BASE_URL}/teams?${query.toString()}`);
    return payload?.data || { items: [], meta: { page: 1, per_page: 500, total: 0, total_pages: 0 } };
};

export const fetchTeamById = async (teamId: number): Promise<TeamRecord> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    const payload = await requestJson(`${API_BASE_URL}/teams/${teamId}?${query.toString()}`);
    return payload?.data;
};

export const createTeam = async (name: string): Promise<TeamRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, name }),
    });
    return payload?.data;
};

export const updateTeam = async (teamId: number, name: string): Promise<TeamRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, name }),
    });
    return payload?.data;
};

export const deleteTeam = async (teamId: number): Promise<void> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    await requestJson(`${API_BASE_URL}/teams/${teamId}?${query.toString()}`, {
        method: 'DELETE',
    });
};
