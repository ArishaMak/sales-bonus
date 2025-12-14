import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

router.get('/:sellerId', async (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);
    if (!Number.isInteger(sellerId)) {
      return res.status(400).json({ error: 'Invalid sellerId' });
    }

    // --------------------------------------------------
    // SELLER
    // --------------------------------------------------
    const [[seller]] = await pool.query(
      `SELECT seller_id, first_name, last_name 
       FROM sellers 
       WHERE seller_id = ?`,
      [sellerId]
    );

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // --------------------------------------------------
    // PURCHASES
    // --------------------------------------------------
    const [purchases] = await pool.query(
      `SELECT purchase_id, purchase_date
       FROM purchase_records
       WHERE seller_id = ?`,
      [sellerId]
    );

    if (!purchases.length) {
      return res.json({
        seller: sellerId,
        revenue: 0,
        profit: 0,
        avgCheck: 0,
        avgProfit: 0,
        salesCount: 0,
        bonus: 0,
        kpi: 0,
        topProducts: [],
        salesRows: [],
        salesOverTime: { labels: [], values: [] },
        categoryBreakdown: { labels: [], values: [] }
      });
    }

    const purchaseIds = purchases.map(p => p.purchase_id);

    // --------------------------------------------------
    // ITEMS
    // --------------------------------------------------
    const [items] = await pool.query(
      `
      SELECT 
        pi.purchase_id,
        pi.sku,
        pi.quantity,
        pi.price,
        p.name,
        COALESCE(p.purchase_price, 0) AS purchase_price,
        c.name AS category
      FROM purchase_items pi
      JOIN products p ON p.sku = pi.sku
      LEFT JOIN categories c ON c.category_id = p.category_id
      WHERE pi.purchase_id IN (?)
      `,
      [purchaseIds]
    );

    let revenue = 0;
    let profit = 0;

    const productMap = {};
    const categoryMap = {};
    const purchaseAggregates = {};

    // --------------------------------------------------
    // AGGREGATION
    // --------------------------------------------------
    items.forEach(i => {
      const itemRevenue = i.price * i.quantity;
      const itemProfit = itemRevenue - (i.purchase_price * i.quantity);

      revenue += itemRevenue;
      profit += itemProfit;

      // purchase aggregates
      purchaseAggregates[i.purchase_id] ??= { revenue: 0, profit: 0 };
      purchaseAggregates[i.purchase_id].revenue += itemRevenue;
      purchaseAggregates[i.purchase_id].profit += itemProfit;

      // products
      productMap[i.sku] ??= {
        sku: i.sku,
        name: i.name,
        totalQuantity: 0,
        totalRevenue: 0,
        totalProfit: 0
      };

      productMap[i.sku].totalQuantity += i.quantity;
      productMap[i.sku].totalRevenue += itemRevenue;
      productMap[i.sku].totalProfit += itemProfit;

      // categories
      if (i.category) {
        categoryMap[i.category] = (categoryMap[i.category] || 0) + itemRevenue;
      }
    });

    // --------------------------------------------------
    // SALES ROWS
    // --------------------------------------------------
    const salesRows = purchases.map(p => {
      const agg = purchaseAggregates[p.purchase_id] || { revenue: 0, profit: 0 };
      const day =
        p.purchase_date instanceof Date
          ? p.purchase_date.toISOString().slice(0, 10)
          : String(p.purchase_date).slice(0, 10);

      return {
        purchase_id: p.purchase_id,
        day,
        revenue: agg.revenue,
        profit: agg.profit
      };
    });

    // --------------------------------------------------
    // SALES OVER TIME
    // --------------------------------------------------
    const salesByDay = {};
    salesRows.forEach(r => {
      salesByDay[r.day] = (salesByDay[r.day] || 0) + r.revenue;
    });

    const labels = Object.keys(salesByDay).sort();
    const salesOverTime = {
      labels,
      values: labels.map(d => salesByDay[d])
    };

    const categoryBreakdown = {
      labels: Object.keys(categoryMap),
      values: Object.values(categoryMap)
    };

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // --------------------------------------------------
    // KPI
    // --------------------------------------------------
    const salesCount = purchases.length;
    const avgCheck = salesCount ? revenue / salesCount : 0;
    const avgProfit = salesCount ? profit / salesCount : 0;

    const bonus = Math.round(profit * 0.1);
    const kpi =
      avgCheck >= 3000 ? 120 :
      avgCheck >= 1500 ? 100 :
      70;

    // --------------------------------------------------
    res.json({
      seller: seller.seller_id,
      avgCheck: Math.round(avgCheck),
      avgProfit: Math.round(avgProfit),
      revenue: Math.round(revenue),
      profit: Math.round(profit),
      salesCount,
      bonus,
      kpi,
      topProducts,
      salesRows,
      salesOverTime,
      categoryBreakdown
    });

  } catch (err) {
    console.error('KPI error:', err);
    res.status(500).json({ error: 'KPI error' });
  }
});

export default router;
