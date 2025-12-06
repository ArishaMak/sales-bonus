import { pool } from './db.js';

/**
 * Получает основные агрегированные данные по всем продавцам (выручка, прибыль, количество продаж)
 * для отображения на дашборде.
 * * ВАЖНО: Включено умножение sale_price и purchase_price на quantity для корректных итогов.
 */
export async function fetchSellerStats() {
    const query = `
        SELECT
            s.seller_id,
            s.name,
            s.plan,
            -- Выручка: SUM(Цена продажи * Количество)
            COALESCE(SUM(r.sale_price * r.quantity), 0) AS revenue,
            -- Прибыль: SUM((Цена продажи - Цена покупки) * Количество)
            COALESCE(SUM((r.sale_price - r.purchase_price) * r.quantity), 0) AS profit,
            -- Количество продаж (количество записей, не общее количество единиц товара)
            COALESCE(COUNT(r.record_id), 0) AS sales_count,
            MAX(r.created_at) AS last_activity_at
        FROM 
            sellers s
        LEFT JOIN 
            records r ON s.seller_id = r.seller_id
        GROUP BY 
            s.seller_id, s.name, s.plan
        ORDER BY 
            revenue DESC;
    `;
    
    try {
        const [rows] = await pool.query(query);
        return rows;
    } catch (error) {
        console.error("Seller Stats Query Failed:", error);
        return [];
    }
}

/**
 * Получает топ-продукты по общему количеству продаж.
 */
export async function fetchTopProducts(limit = 10) {
    const query = `
        SELECT
            p.sku AS artikul,
            p.name AS product_name,
            -- Общее количество проданных единиц
            COALESCE(SUM(r.quantity), 0) AS total_quantity_sold,
            -- Общая выручка по этому продукту
            COALESCE(SUM(r.sale_price * r.quantity), 0) AS total_revenue
        FROM
            records r
        JOIN
            products p ON r.product_id = p.product_id
        GROUP BY
            p.product_id, p.sku, p.name
        ORDER BY
            total_quantity_sold DESC
        LIMIT ?;
    `;
    
    try {
        const [rows] = await pool.query(query, [limit]);
        return rows;
    } catch (error) {
        console.error("Top Products Query Failed:", error);
        return [];
    }
}