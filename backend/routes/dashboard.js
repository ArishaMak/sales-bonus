// backend/routes/dashboard.js
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

/**
 * GET /api/dashboard
 * Общая аналитика дашборда
 * Query:
 *   period_start (YYYYMM, default 202501)
 *   period_end   (YYYYMM, default 202512)
 */
router.get("/", async (req, res) => {
  try {
    const period_start = req.query.period_start || "202501";
    const period_end = req.query.period_end || "202512";

    //
    // 1. TOTAL REVENUE & PROFIT
    //
    const [[totals]] = await pool.query(
      `
      SELECT
        SUM(pi.quantity * pi.price) AS total_revenue,
        SUM(pi.quantity * (pi.price - COALESCE(p.purchase_price, 0))) AS total_profit
      FROM purchase_items pi
      JOIN purchase_records pr ON pr.purchase_id = pi.purchase_id
      JOIN products p ON p.sku = pi.sku
      WHERE DATE_FORMAT(pr.purchase_date, '%Y%m')
            BETWEEN ? AND ?
      `,
      [period_start, period_end]
    );

    const total_revenue = Number(totals?.total_revenue || 0);
    const total_profit = Number(totals?.total_profit || 0);

    //
    // 2. BASIC STATS
    //
    const [[productCount]] = await pool.query(
      `SELECT COUNT(*) AS total_products FROM products`
    );
    const [[recordCount]] = await pool.query(
      `SELECT COUNT(*) AS total_records FROM purchase_records`
    );
    const [[customerCount]] = await pool.query(
      `SELECT COUNT(*) AS total_customers FROM customers`
    );

    const stats = {
      total_products: productCount.total_products,
      total_records: recordCount.total_records,
      total_customers: customerCount.total_customers
    };

    //
    // 3. TOP SELLERS (ПО ПЕРИОДУ)
    //
    const [topSellers] = await pool.query(
      `
      SELECT
        s.seller_id,
        s.first_name,
        s.last_name,
        SUM(pi.quantity * pi.price) AS total_revenue,
        SUM(pi.quantity * (pi.price - COALESCE(p.purchase_price, 0))) AS total_profit
      FROM purchase_records pr
      JOIN purchase_items pi ON pi.purchase_id = pr.purchase_id
      JOIN products p ON p.sku = pi.sku
      JOIN sellers s ON s.seller_id = pr.seller_id
      WHERE DATE_FORMAT(pr.purchase_date, '%Y%m')
            BETWEEN ? AND ?
      GROUP BY s.seller_id, s.first_name, s.last_name
      ORDER BY total_revenue DESC
      LIMIT 5
      `,
      [period_start, period_end]
    );

    //
    // 4. CATEGORY PIE
    //
    const [categories] = await pool.query(
      `
      SELECT
        c.name AS category,
        SUM(pi.quantity * pi.price) AS category_revenue
      FROM purchase_items pi
      JOIN purchase_records pr ON pr.purchase_id = pi.purchase_id
      JOIN products p ON p.sku = pi.sku
      LEFT JOIN categories c ON c.category_id = p.category_id
      WHERE DATE_FORMAT(pr.purchase_date, '%Y%m')
            BETWEEN ? AND ?
      GROUP BY c.name
      ORDER BY category_revenue DESC
      LIMIT 10
      `,
      [period_start, period_end]
    );

    //
    // 5. TRENDS (ПО МЕСЯЦАМ)
    //
    const [trends] = await pool.query(
      `
      SELECT
        DATE_FORMAT(pr.purchase_date, '%Y%m') AS month,
        SUM(pi.quantity * pi.price) AS revenue,
        SUM(pi.quantity * (pi.price - COALESCE(p.purchase_price, 0))) AS profit
      FROM purchase_records pr
      JOIN purchase_items pi ON pi.purchase_id = pr.purchase_id
      JOIN products p ON p.sku = pi.sku
      WHERE DATE_FORMAT(pr.purchase_date, '%Y%m')
            BETWEEN ? AND ?
      GROUP BY month
      ORDER BY month ASC
      `,
      [period_start, period_end]
    );

    //
    // 6. TOP PRODUCTS (ПО ПЕРИОДУ)
    //
    const [topProducts] = await pool.query(
      `
      SELECT
        p.sku AS id_artikul,
        p.name,
        SUM(pi.quantity * pi.price) AS revenue,
        SUM(pi.quantity) AS total_qty
      FROM purchase_items pi
      JOIN purchase_records pr ON pr.purchase_id = pi.purchase_id
      JOIN products p ON p.sku = pi.sku
      WHERE DATE_FORMAT(pr.purchase_date, '%Y%m')
            BETWEEN ? AND ?
      GROUP BY p.sku, p.name
      ORDER BY revenue DESC
      LIMIT 10
      `,
      [period_start, period_end]
    );

    //
    // RESPONSE
    //
    res.json({
      stats,
      total_revenue: Math.round(total_revenue),
      total_profit: Math.round(total_profit),
      top_sellers: topSellers,
      categories,
      months: trends,
      top_products: topProducts
    });

  } catch (err) {
    console.error("Ошибка /api/dashboard:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
