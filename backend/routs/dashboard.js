// backend/routes/dashboard.js
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

/**
 * GET /api/dashboard
 */
router.get("/", async (req, res) => {
  try {
    const { period_start = "202501", period_end = "202512" } = req.query;

    //
    // 1. TOTAL REVENUE & PROFIT
    //
    let total_revenue = 0;
    let total_profit = 0;

    try {
      const [totals] = await pool.query(
        `
        SELECT 
          SUM(total_revenue) AS total_revenue, 
          SUM(total_profit) AS total_profit
        FROM seller_month_sales
        WHERE period_id BETWEEN ? AND ?
        `,
        [period_start, period_end]
      );

      total_revenue = Number(totals[0]?.total_revenue || 0);
      total_profit = Number(totals[0]?.total_profit || 0);
    } catch {
      const [fallback] = await pool.query(`
        SELECT 
          SUM(total_revenue) AS total_revenue, 
          SUM(total_profit) AS total_profit 
        FROM seller_stats
      `);
      total_revenue = Number(fallback[0]?.total_revenue || 0);
      total_profit = Number(fallback[0]?.total_profit || 0);
    }

    //
    // 2. BASIC STATS (что ждёт dashboard.js)
    //
    const [[productCount]] = await pool.query(`SELECT COUNT(*) AS total_products FROM products`);
    const [[recordCount]] = await pool.query(`SELECT COUNT(*) AS total_records FROM purchase_records`);
    const [[customerCount]] = await pool.query(`SELECT COUNT(*) AS total_customers FROM customers`);

    const stats = {
      total_products: productCount.total_products,
      total_records: recordCount.total_records,
      total_customers: customerCount.total_customers,
    };

    //
    // 3. TOP SELLERS
    //
    const [topSellers] = await pool.query(`
      SELECT 
        seller_id,
        first_name,
        last_name,
        COALESCE(total_revenue, 0) AS total_revenue,
        COALESCE(total_profit, 0) AS total_profit
      FROM sellers
      ORDER BY total_revenue DESC
      LIMIT 5
    `);

    //
    // 4. CATEGORY PIE
    //
    const [categories] = await pool.query(`
      SELECT 
        p.category,
        SUM(pi.quantity * COALESCE(pi.price, p.sale_price)) AS category_revenue
      FROM products p
      LEFT JOIN purchase_items pi ON p.sku = pi.sku
      GROUP BY p.category
      ORDER BY category_revenue DESC
      LIMIT 10
    `);

    //
    // 5. TRENDS
    //
    const [trends] = await pool.query(
      `
      SELECT 
        period_id AS month, 
        SUM(total_revenue) AS revenue, 
        SUM(total_profit) AS profit
      FROM seller_month_sales
      WHERE period_id BETWEEN ? AND ?
      GROUP BY period_id
      ORDER BY period_id ASC
      `,
      [period_start, period_end]
    );

    //
    // 6. TOP PRODUCTS
    //
    const [topProducts] = await pool.query(`
      SELECT 
        p.sku AS id_artikul,
        p.name,
        SUM(pi.quantity * pi.price) AS revenue,
        SUM(pi.quantity) AS total_qty
      FROM products p
      JOIN purchase_items pi ON p.sku = pi.sku
      GROUP BY p.sku, p.name
      ORDER BY revenue DESC
      LIMIT 10
    `);

    //
    // RESPONSE
    //
    res.json({
      stats,
      total_revenue,
      total_profit,
      top_sellers: topSellers,
      categories,
      months: trends,
      top_products: topProducts,
    });
  } catch (err) {
    console.error("Ошибка /api/dashboard:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
