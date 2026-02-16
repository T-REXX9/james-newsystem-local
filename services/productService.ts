import { supabase } from '../lib/supabaseClient';
import { Product } from '../types';
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
 * Get product price based on customer price group
 * @param product The product object
 * @param priceGroup The customer's price group (AA, BB, CC, DD, VIP1, VIP2)
 * @returns The calculate price
 */
export const getProductPrice = (product: Product, priceGroup?: string): number => {
    if (!product) return 0;

    // Default to price_aa if no group specified
    if (!priceGroup) return product.price_aa || 0;

    const group = priceGroup.toUpperCase();

    switch (group) {
        case 'AA': return product.price_aa || 0;
        case 'BB': return product.price_bb || 0;
        case 'CC': return product.price_cc || 0;
        case 'DD': return product.price_dd || 0;
        case 'VIP1': return product.price_vip1 || 0;
        case 'VIP2': return product.price_vip2 || 0;
        default: return product.price_aa || 0;
    }
};

export {
    createProduct,
    updateProduct,
    deleteProduct
};
