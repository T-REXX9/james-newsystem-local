// @ts-nocheck
import {
    CreateStaffAccountInput,
    CreateStaffAccountResult,
    StaffAccountValidationError,
    UserProfile,
} from '../types';
import { DEFAULT_STAFF_ACCESS_RIGHTS, DEFAULT_STAFF_ROLE, STAFF_ROLES } from '../constants';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

interface StaffRecord {
    id: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url?: string;
    access_rights?: string[] | string | null;
    birthday?: string;
    mobile?: string;
    monthly_quota?: number;
}

export interface StaffListResponse {
    items: UserProfile[];
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

const parseAccessRights = (value: StaffRecord['access_rights']): string[] => {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
    }

    if (typeof value !== 'string' || !value.trim()) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
};

const mapStaffToProfile = (staff: StaffRecord): UserProfile => ({
    id: String(staff.id),
    full_name: staff.full_name,
    email: staff.email,
    role: staff.role,
    avatar_url: staff.avatar_url || undefined,
    access_rights: parseAccessRights(staff.access_rights),
    birthday: staff.birthday || undefined,
    mobile: staff.mobile || undefined,
    monthly_quota: staff.monthly_quota,
});

const toPositiveNumber = (value: unknown, fallback: number): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const validateStaffAccountInput = (input: CreateStaffAccountInput): StaffAccountValidationError => {
    const errors: StaffAccountValidationError = {};

    if (!input.fullName?.trim()) {
        errors.fullName = 'Full name is required';
    }

    if (!input.email?.trim()) {
        errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
        errors.email = 'Please provide a valid email address';
    }

    if (!input.password) {
        errors.password = 'Password is required';
    } else {
        const hasLength = input.password.length >= 8;
        const hasLetter = /[a-zA-Z]/.test(input.password);
        const hasNumber = /\d/.test(input.password);
        if (!hasLength || !hasLetter || !hasNumber) {
            errors.password = 'Password must be at least 8 characters and include letters and numbers';
        }
    }

    if (input.role && !STAFF_ROLES.includes(input.role)) {
        errors.role = 'Invalid role';
    }

    if (input.accessRights && !input.accessRights.length) {
        errors.accessRights = 'At least one access right is required';
    }

    return errors;
};

const normalizeAccessRights = (accessRights?: string[]) => {
    if (!accessRights || !accessRights.length) {
        return DEFAULT_STAFF_ACCESS_RIGHTS;
    }

    return Array.from(new Set(accessRights));
};

const mapCreateStaffError = (message?: string) => {
    if (!message) return 'Unable to create account right now. Please try again.';

    const normalized = message.toLowerCase();
    if (normalized.includes('duplicate') || normalized.includes('already exists')) {
        return 'An account with this email already exists.';
    }

    if (normalized.includes('password')) {
        return 'Password does not meet security requirements.';
    }

    return message;
};

export const fetchProfilesLocal = async (
    params?: { page?: number; perPage?: number }
): Promise<StaffListResponse> => {
    const page = toPositiveNumber(params?.page, 1);
    const perPage = toPositiveNumber(params?.perPage, 50);
    const query = new URLSearchParams({
        main_id: String(API_MAIN_ID),
        page: String(page),
        per_page: String(perPage),
    });
    const payload = await requestJson(`${API_BASE_URL}/staff?${query.toString()}`);
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    return {
        items: items.map(mapStaffToProfile),
        meta: {
            page: toPositiveNumber(payload?.data?.meta?.page, page),
            per_page: toPositiveNumber(payload?.data?.meta?.per_page, perPage),
            total: Math.max(0, Number(payload?.data?.meta?.total) || items.length),
            total_pages: Math.max(1, Number(payload?.data?.meta?.total_pages) || 1),
        },
    };
};

export const updateProfileLocal = async (
    staffId: string | number,
    data: { access_rights?: string[] }
): Promise<UserProfile> => {
    const payload = await requestJson(`${API_BASE_URL}/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            main_id: API_MAIN_ID,
            access_rights: data.access_rights ?? [],
        }),
    });

    return mapStaffToProfile(payload?.data || {});
};

export const createStaffAccountLocal = async (
    input: CreateStaffAccountInput
): Promise<CreateStaffAccountResult> => {
    const validationErrors = validateStaffAccountInput(input);
    if (Object.keys(validationErrors).length) {
        return { success: false, error: 'Validation failed', validationErrors };
    }

    const role = input.role && STAFF_ROLES.includes(input.role) ? input.role : DEFAULT_STAFF_ROLE;
    const accessRights = normalizeAccessRights(input.accessRights);

    try {
        const payload = await requestJson(`${API_BASE_URL}/staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                main_id: API_MAIN_ID,
                full_name: input.fullName.trim(),
                email: input.email.trim(),
                password: input.password,
                role,
                birthday: input.birthday || null,
                mobile: input.mobile || null,
                access_rights: accessRights,
            }),
        });

        const profile = payload?.data ? mapStaffToProfile(payload.data) : undefined;
        return {
            success: true,
            userId: profile?.id,
            profile,
        };
    } catch (err: any) {
        return {
            success: false,
            error: mapCreateStaffError(err?.message),
        };
    }
};
