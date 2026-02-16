import { supabase } from '../lib/supabaseClient';
import {
    AIStandardAnswer,
    CreateAIStandardAnswerInput,
    UpdateAIStandardAnswerInput,
} from '../types';

/**
 * Fetch all standard answers, optionally filtered by category or active status
 */
export async function fetchStandardAnswers(filters?: {
    category?: string;
    is_active?: boolean;
}): Promise<AIStandardAnswer[]> {
    let query = supabase
        .from('ai_standard_answers')
        .select('*')
        .order('priority', { ascending: false })
        .order('category', { ascending: true });

    if (filters?.category) {
        query = query.eq('category', filters.category);
    }
    if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching standard answers:', error);
        throw error;
    }

    return (data || []) as unknown as AIStandardAnswer[];
}

/**
 * Fetch a single standard answer by ID
 */
export async function fetchStandardAnswer(id: string): Promise<AIStandardAnswer | null> {
    const { data, error } = await supabase
        .from('ai_standard_answers')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching standard answer:', error);
        throw error;
    }

    return data as unknown as AIStandardAnswer;
}

/**
 * Create a new standard answer
 */
export async function createStandardAnswer(
    input: CreateAIStandardAnswerInput,
    userId: string
): Promise<AIStandardAnswer> {
    const { data, error } = await supabase
        .from('ai_standard_answers')
        .insert([{
            ...input,
            created_by: userId,
            is_active: true,
            priority: input.priority ?? 0,
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating standard answer:', error);
        throw error;
    }

    return data as unknown as AIStandardAnswer;
}

/**
 * Update an existing standard answer
 */
export async function updateStandardAnswer(
    id: string,
    updates: UpdateAIStandardAnswerInput
): Promise<AIStandardAnswer> {
    const { data, error } = await supabase
        .from('ai_standard_answers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating standard answer:', error);
        throw error;
    }

    return data as unknown as AIStandardAnswer;
}

/**
 * Delete a standard answer
 */
export async function deleteStandardAnswer(id: string): Promise<void> {
    const { error } = await supabase
        .from('ai_standard_answers')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting standard answer:', error);
        throw error;
    }
}

/**
 * Search standard answers by keywords
 */
export async function searchStandardAnswers(
    keywords: string[]
): Promise<AIStandardAnswer[]> {
    // Search for answers where any trigger keyword overlaps with the search keywords
    const { data, error } = await supabase
        .from('ai_standard_answers')
        .select('*')
        .eq('is_active', true)
        .overlaps('trigger_keywords', keywords)
        .order('priority', { ascending: false });

    if (error) {
        console.error('Error searching standard answers:', error);
        throw error;
    }

    return (data || []) as unknown as AIStandardAnswer[];
}

/**
 * Get all unique categories
 */
export async function fetchStandardAnswerCategories(): Promise<string[]> {
    const { data, error } = await supabase
        .from('ai_standard_answers')
        .select('category');

    if (error) {
        console.error('Error fetching categories:', error);
        throw error;
    }

    const categories = [...new Set((data || []).map(d => d.category))];
    return categories.sort();
}

/**
 * Toggle active status of a standard answer
 */
export async function toggleStandardAnswerActive(
    id: string,
    isActive: boolean
): Promise<AIStandardAnswer> {
    return updateStandardAnswer(id, { is_active: isActive });
}
