import { pool } from './db.js';

export async function fetchSellerStats() {
  const query = `
    SELECT
      s.seller_id,
      s.name,
      s.plan,
      COALESCE(SUM(r.sale_price * r.quantity), 0) AS revenue,
      COALESCE(SUM((r.sale_price - r.purchase_price) * r.quantity), 0) AS profit,
      COALESCE(COUNT(r.record_id), 0) AS sales_count,
      MAX(r.created_at) AS last_activity_at
    FROM sellers s
    LEFT JOIN records r ON s.seller_id = r.seller_id
    GROUP BY s.seller_id, s.name, s.plan
    ORDER BY revenue DESC;
  `;

  try {
    const [rows] = await pool.query(query);
    return rows;
  } catch (error) {
    console.error("Seller Stats Query Failed:", error);
    return [];
  }
}

export async function fetchTopProducts(limit = 10) {
  const query = `
    SELECT
      p.sku AS artikul,
      p.name AS product_name,
      COALESCE(SUM(r.quantity), 0) AS total_quantity_sold,
      COALESCE(SUM(r.sale_price * r.quantity), 0) AS total_revenue
    FROM records r
    JOIN products p ON r.product_id = p.product_id
    GROUP BY p.product_id, p.sku, p.name
    ORDER BY total_quantity_sold DESC
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