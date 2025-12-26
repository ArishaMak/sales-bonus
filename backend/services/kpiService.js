import { pool } from '../db.js';

function getPeriodStart(period = 'currentMonth') {
  const now = new Date();
  if (period === 'currentMonth') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(0);
}

function formatDateToSQL(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function getSellerKPI(sellerId, period = 'currentMonth') {
  const startDate = getPeriodStart(period);
  const sqlStartDate = formatDateToSQL(startDate);

  try {
    const [planRow] = await pool.query(`
      SELECT 
        COALESCE(0, 0) AS plan_revenue,
        COALESCE(0, 0) AS plan_profit,
        COALESCE(0, 0) AS plan_bonus
      FROM sellers 
      WHERE seller_id = ?
    `, [sellerId]);

    const [kpiRows] = await pool.query(`
      SELECT
        SUM(pi.quantity * pi.sale_price) AS revenue,
        SUM(pi.quantity * (pi.sale_price - p.purchase_price)) AS profit,
        COUNT(DISTINCT pr.purchase_id) AS total_sales,
        SUM(pi.quantity) AS total_items_sold
      FROM purchase_records pr
      JOIN purchase_items pi ON pr.purchase_id = pi.purchase_id
      JOIN products p ON pi.sku = p.sku
      WHERE pr.seller_id = ? AND pr.purchase_date >= ?
    `, [sellerId, sqlStartDate]);

    const actual = kpiRows[0];
    const plan = planRow[0];

    let kpiPercent = 0;
    let bonus = 0;

    if (plan.plan_revenue > 0 && actual.revenue > 0) {
      kpiPercent = (actual.revenue / plan.plan_revenue) * 100;
      if (kpiPercent >= 100) {
        bonus = actual.profit * 0.01;
      }
    }

    const averageCheck = actual.total_sales > 0 ? actual.revenue / actual.total_sales : 0;
    const averageProfit = actual.total_sales > 0 ? actual.profit / actual.total_sales : 0;

    return {
      sellerId: sellerId,
      revenue: parseFloat(actual.revenue || 0).toFixed(2),
      profit: parseFloat(actual.profit || 0).toFixed(2),
      sales: actual.total_sales || 0,
      kpiPercent: parseFloat(kpiPercent).toFixed(0) + '%',
      bonus: parseFloat(bonus).toFixed(2),
      averageCheck: parseFloat(averageCheck).toFixed(2),
      averageProfit: parseFloat(averageProfit).toFixed(2),
      totalItemsSold: actual.total_items_sold || 0,
      lastUpdate: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
    };

  } catch (error) {
    console.error('kpiService error:', error.message);
    return {
      sellerId: sellerId,
      revenue: '0.00',
      profit: '0.00',
      sales: 0,
      kpiPercent: '0%',
      bonus: '0.00',
      averageCheck: '0.00',
      averageProfit: '0.00',
      totalItemsSold: 0,
      lastUpdate: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
      error: error.message
    };
  }
}