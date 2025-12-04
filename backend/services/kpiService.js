// backend/services/kpiService.js
import { pool as db } from "../db.js";  // Fix: named import pool as db

export async function getSellerKPI(sellerId) {
  try {
    // Сначала получи plan из sellers (fallback 10000)
    const [sellerRows] = await db.query('SELECT plan_revenue FROM sellers WHERE seller_id = ?', [sellerId]);
    const plan = Number(sellerRows[0]?.plan_revenue || 10000);

    // 1) Summary per purchase
    const [kpiRows] = await db.query(
      `SELECT 
        pr.purchase_id,
        DATE(pr.purchase_date) AS day,
        SUM(pi.quantity * pi.price) AS gross_revenue,
        SUM(pi.quantity * pi.discount) AS total_discount,
        SUM(pi.quantity * (pi.price - pi.cost)) AS total_profit
      FROM purchase_records pr
      JOIN purchase_items pi ON pi.purchase_id = pr.purchase_id
      WHERE pr.seller_id = ?
      GROUP BY pr.purchase_id, day
      ORDER BY day ASC
      `,
      [sellerId]
    );

    if (kpiRows.length === 0) {
      return {  // Fallback: 0, но с plan
        seller: sellerId,
        revenue: 0, profit: 0, avgCheck: 0, avgProfit: 0, salesCount: 0, bonus: 0, kpi: 0,
        topProducts: [], salesOverTime: { labels: [], values: [] },
        categoryBreakdown: { labels: [], values: [] }, salesRows: []
      };
    }

    // Totals
    let totalRevenue = 0;
    let totalProfit = 0;
    const salesRows = [];
    for (const r of kpiRows) {
      const revenue = Number(r.gross_revenue) - Number(r.total_discount || 0);
      const profit = Number(r.total_profit || 0);
      totalRevenue += revenue;
      totalProfit += profit;
      salesRows.push({ purchase_id: r.purchase_id, day: r.day, revenue, profit });
    }

    const salesCount = kpiRows.length;
    const kpi = ((totalRevenue / plan) * 100).toFixed(2);  // Добавь KPI
    const bonus = Number((totalProfit * 0.05).toFixed(2));  // Или по KPI: if(kpi>100) *0.05

    // Top products (topRows)
    const [topRows] = await db.query(
      `SELECT 
        pi.sku, p.name, SUM(pi.quantity) AS totalQuantity,
        SUM(pi.quantity * pi.price) AS totalRevenue,
        SUM(pi.quantity * (pi.price - pi.cost)) AS totalProfit
      FROM purchase_items pi
      JOIN products p ON p.sku = pi.sku
      JOIN purchase_records pr ON pr.purchase_id = pi.purchase_id
      WHERE pr.seller_id = ?
      GROUP BY pi.sku, p.name
      ORDER BY totalRevenue DESC
      LIMIT 10
      `,
      [sellerId]
    );

    // Sales over time (timeRows)
    const salesByDay = {};
    kpiRows.forEach(r => {
      const d = r.day;
      salesByDay[d] = (salesByDay[d] || 0) + (Number(r.gross_revenue) - Number(r.total_discount || 0));
    });
    const salesOverTime = {
      labels: Object.keys(salesByDay).sort(),
      values: Object.keys(salesByDay).sort().map(d => salesByDay[d])
    };

    // Category breakdown (catRows)
    const [catRows] = await db.query(
      `SELECT 
        c.name AS category,
        SUM(pi.quantity * pi.price) AS totalRevenue
      FROM purchase_items pi
      JOIN products p ON p.sku = pi.sku
      LEFT JOIN categories c ON c.category_id = p.category_id
      JOIN purchase_records pr ON pr.purchase_id = pi.purchase_id
      WHERE pr.seller_id = ?
      GROUP BY c.name
      ORDER BY totalRevenue DESC
      `,
      [sellerId]
    );
    const categoryBreakdown = {
      labels: catRows.map(row => row.category).filter(Boolean),
      values: catRows.map(row => Number(row.totalRevenue))
    };

    return {
      seller: sellerId,
      revenue: Number(totalRevenue.toFixed(2)),
      profit: Number(totalProfit.toFixed(2)),
      avgCheck: salesCount ? Number((totalRevenue / salesCount).toFixed(2)) : 0,
      avgProfit: salesCount ? Number((totalProfit / salesCount).toFixed(2)) : 0,
      salesCount,
      bonus,
      kpi,  // Добавь
      topProducts: topRows,
      salesOverTime,
      categoryBreakdown,
      salesRows
    };
  } catch (err) {
    console.error('kpiService error:', err);
    return { seller: sellerId, revenue: 0, profit: 0, kpi: 0, /* ... 0 */ };  // Fallback
  }
}