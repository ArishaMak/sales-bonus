import { getPool } from './db.js';
import { getSellerKPI } from './kpiService.js';

const pool = getPool();

/**
 * Топ товаров по выручке
 */
export async function getTopProducts(limit = 10) {
  const [rows] = await pool.query(`
    SELECT
      p.sku AS id_artikul,
      p.name,
      SUM((pi.price - pi.discount) * pi.quantity) AS revenue,
      SUM(pi.quantity) AS total_qty,
      GROUP_CONCAT(DISTINCT pr.seller_id) AS sellers
    FROM products p
    JOIN purchase_items pi ON p.sku = pi.sku
    JOIN purchase_records pr ON pi.purchase_id = pr.purchase_id
    GROUP BY p.sku, p.name
    HAVING revenue > 0
    ORDER BY revenue DESC
    LIMIT ?
  `, [limit]);

  return rows;
}

/**
 * Статистика всех продавцов (живые данные из БД)
 */
export async function getAllSellerStats() {

  const [sellers] = await pool.query(`
    SELECT seller_id, first_name, last_name, department, plan_revenue
    FROM sellers
  `);

  const statsPromises = sellers.map(async seller => {
    try {
      const stats = await getSellerKPI(seller.seller_id);

      return {
        seller_id: seller.seller_id,
        name: `${seller.first_name || ''} ${seller.last_name || ''}`.trim(),
        department: seller.department,

        revenue: stats.total_revenue,
        profit: stats.total_profit,
        sales_count: stats.sales_count,
        kpi: stats.kpi,

        bonus: 0
      };

    } catch (err) {
      console.error(`Seller KPI failed [${seller.seller_id}]`, err.message);
      return {
        seller_id: seller.seller_id,
        name: `${seller.first_name || ''} ${seller.last_name || ''}`.trim(),
        department: seller.department,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        kpi: 0,
        bonus: 0
      };
    }
  });

  return Promise.all(statsPromises);
}
