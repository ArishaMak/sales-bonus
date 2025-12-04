// backend/routes/dashboard.js
import express from 'express';
import { pool } from '../db.js';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { period_start = '202501', period_end = '202512' } = req.query;

    // totals: из seller_month_sales если есть, иначе суммируем seller_stats.total_revenue
    let total_revenue = 0, total_profit = 0;

    try {
      const [totals] = await pool.query(
        `SELECT SUM(total_revenue) AS total_revenue, SUM(total_profit) AS total_profit
         FROM seller_month_sales
         WHERE period_id BETWEEN ? AND ?`,
        [period_start, period_end]
      );
      if (totals && totals[0]) {
        total_revenue = Number(totals[0].total_revenue || 0);
        total_profit = Number(totals[0].total_profit || 0);
      }
    } catch (e) {
      // table may not exist; fallback
      const [rows] = await pool.query('SELECT SUM(total_revenue) AS total_revenue, SUM(total_profit) AS total_profit FROM seller_stats');
      total_revenue = Number(rows[0]?.total_revenue || 0);
      total_profit = Number(rows[0]?.total_profit || 0);
    }

    // top sellers (from sellers table)
    const [topSellers] = await pool.query(`
      SELECT seller_id, first_name, last_name, total_revenue, total_profit
      FROM sellers
      ORDER BY total_revenue DESC
      LIMIT 5
    `);

    // categories pie: sum sale_price * quantity grouped by product category (join purchase_item->products)
    const [categories] = await pool.query(`
      SELECT p.category, SUM(pi.quantity * COALESCE(pi.price, p.sale_price)) AS category_revenue
      FROM products p
      LEFT JOIN purchase_items pi ON p.sku = pi.sku
      GROUP BY p.category
      ORDER BY category_revenue DESC
      LIMIT 10
    `);

    // trends: group by period_id in seller_month_sales (fallback: empty)
    const [trends] = await pool.query(`
      SELECT period_id AS month, SUM(total_revenue) AS revenue, SUM(total_profit) AS profit
      FROM seller_month_sales
      WHERE period_id BETWEEN ? AND ?
      GROUP BY period_id
      ORDER BY period_id ASC
    `, [period_start, period_end]);

    // topProducts: добавлено для фронта
    const [topProducts] = await pool.query(`
      SELECT p.sku AS id_artikul, p.name, SUM(pi.quantity * pi.price) AS revenue, SUM(pi.quantity) AS total_qty
      FROM products p 
      JOIN purchase_items pi ON p.sku = pi.sku 
      GROUP BY p.sku, p.name 
      ORDER BY revenue DESC 
      LIMIT 10
    `);

    res.json({
      total_revenue,
      total_profit,
      top_sellers: topSellers,
      categories,
      months: trends,
      top_products: topProducts
    });

  } catch (err) {
    console.error('Ошибка /api/dashboard:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;