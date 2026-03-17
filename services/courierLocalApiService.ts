const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export interface CourierRecord {
    id: number;
    name: string;
}

export interface CourierListResponse {
    items: CourierRecord[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
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

export const fetchCouriers = async (search = ''): Promise<CourierListResponse> => {
    const query = new URLSearchParams({
        main_id: String(API_MAIN_ID),
        search,
        page: '1',
        per_page: '500',
    });
    const payload = await requestJson(`${API_BASE_URL}/couriers?${query.toString()}`);
    return payload?.data || { items: [], meta: { page: 1, per_page: 500, total: 0, total_pages: 0 } };
};

export const createCourier = async (name: string): Promise<CourierRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/couriers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, name }),
    });
    return payload?.data;
};

export const updateCourier = async (courierId: number, name: string): Promise<CourierRecord> => {
    const payload = await requestJson(`${API_BASE_URL}/couriers/${courierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_id: API_MAIN_ID, name }),
    });
    return payload?.data;
};

export const deleteCourier = async (courierId: number): Promise<void> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    await requestJson(`${API_BASE_URL}/couriers/${courierId}?${query.toString()}`, {
        method: 'DELETE',
    });
};
