import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

router.get('/:sellerId', async (req, res) => {
  try {
    const sellerId = String(req.params.sellerId).trim();

    // Получаем продавца
    const [[seller]] = await pool.query(
      `SELECT seller_id, first_name, last_name FROM sellers WHERE seller_id = ?`,
      [sellerId]
    );

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Все покупки этого продавца
    const [purchases] = await pool.query(
      `SELECT purchase_id, purchase_date, total_amount
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

    // Товары
    const [items] = await pool.query(
      `SELECT pi.purchase_id, pi.sku, pi.quantity, pi.price,
              p.name, p.purchase_price, c.name AS category
       FROM purchase_items pi
       JOIN products p ON p.sku = pi.sku
       LEFT JOIN categories c ON c.category_id = p.category_id
       WHERE pi.purchase_id IN (?)`,
      [purchaseIds]
    );

    let revenue = 0;
    let profit = 0;
    let totalQty = 0;

    const productMap = {};
    const categoryMap = {};
    const salesByDay = {};

    items.forEach(i => {
      const itemRevenue = i.price * i.quantity;
      const itemProfit = itemRevenue - (i.purchase_price * i.quantity);

      revenue += itemRevenue;
      profit += itemProfit;
      totalQty += i.quantity;

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

      if (i.category) {
        categoryMap[i.category] = (categoryMap[i.category] || 0) + itemRevenue;
      }
    });

    // Продажи по датам
    purchases.forEach(p => {
      const d = p.purchase_date.toISOString().slice(0, 10);
      salesByDay[d] = (salesByDay[d] || 0) + Number(p.total_amount);
    });

    const salesRows = purchases.map(p => ({
      purchase_id: p.purchase_id,
      day: p.purchase_date.toISOString().slice(0, 10),
      revenue: p.total_amount,
      profit: Math.round((p.total_amount / revenue) * profit || 0)
    }));

    const salesOverTime = {
      labels: Object.keys(salesByDay),
      values: Object.values(salesByDay)
    };

    const categoryBreakdown = {
      labels: Object.keys(categoryMap),
      values: Object.values(categoryMap)
    };

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    const avgCheck = revenue / purchases.length;
    const avgProfit = profit / purchases.length;

    const bonus = profit * 0.1;
    const kpi = avgCheck >= 3000 ? 120 : avgCheck >= 1500 ? 100 : 70;

    res.json({
      seller: seller.seller_id,
      avgCheck,
      avgProfit,
      revenue,
      profit,
      salesCount: purchases.length,
      bonus,
      kpi,
      topProducts,
      salesRows,
      salesOverTime,
      categoryBreakdown
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'KPI error' });
  }
});

export default router;
