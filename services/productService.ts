import { supabase } from '../lib/supabaseClient';
import { Product } from '../types';
import { normalizePriceGroup } from '../constants/pricingGroups';
import { createProduct, updateProduct, deleteProduct } from './supabaseService';

/**
 * Search products by description, part_no, or item_code
 * @param query The search query string
 * @returns List of matching products
 */
export const searchProducts = async (query: string): Promise<Product[]> => {
    try {
        let supabaseQuery = supabase
            .from('products')
            .select('*')
            .eq('is_deleted', false)
            .limit(50);

        if (query && query.length > 0) {
            // Search across multiple columns using OR condition
            supabaseQuery = supabaseQuery.or(`description.ilike.%${query}%,part_no.ilike.%${query}%,item_code.ilike.%${query}%`);
        } else {
            // If no query, maybe order by part_no or recently added
            supabaseQuery = supabaseQuery.order('part_no', { ascending: true });
        }

        const { data, error } = await supabaseQuery;

        if (error) throw error;

        return (data || []) as Product[];
    } catch (err) {
        console.error('Error searching products:', err);
        return [];
    }
};

/**
 * Get product price based on customer price group.
 * Accepts new names (`regular`, `silver`, `gold`, `platinum`) and
 * legacy-compatible names (`AA`, `BB`, `CC`, `DD`, `VIP1`, `VIP2`).
 * `platinum` currently reuses the gold pricing column because there is no
 * dedicated database column.
 * @param product The product object
 * @param priceGroup The customer's price group
 * @returns The calculated price
 */
export const getProductPrice = (product: Product, priceGroup?: string): number => {
    if (!product) return 0;
    if (!priceGroup?.trim()) return product.price_aa || 0;

    const normalizedGroup = normalizePriceGroup(priceGroup);
    const directGroup = priceGroup.trim();
    const candidates = [
        normalizedGroup,
        directGroup,
        directGroup.toLowerCase(),
        directGroup.toUpperCase(),
    ];

    if (candidates.includes('Regular') || candidates.includes('regular') || candidates.includes('AA')) {
        return product.price_aa || 0;
    }

    if (candidates.includes('Silver') || candidates.includes('silver') || candidates.includes('VIP1')) {
        return product.price_vip1 || 0;
    }

    if (candidates.includes('Gold') || candidates.includes('gold') || candidates.includes('VIP2')) {
        return product.price_vip2 || 0;
    }

    if (candidates.includes('Platinum') || candidates.includes('platinum')) {
        return product.price_vip2 || 0;
    }

    if (candidates.includes('BB') || candidates.includes('bbb') || candidates.includes('BBB')) {
        return product.price_bb || 0;
    }

    if (candidates.includes('CC') || candidates.includes('ccc') || candidates.includes('CCC')) {
        return product.price_cc || 0;
    }

    if (candidates.includes('DD') || candidates.includes('ddd') || candidates.includes('DDD')) {
        return product.price_dd || 0;
    }

    return product.price_aa || 0;
};

export {
    createProduct,
    updateProduct,
    deleteProduct
};
