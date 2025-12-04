// backend/routes/sellers.js
import express from 'express';
import { pool } from '../db.js';
const router = express.Router();

// /api/sellers/top
router.get('/top', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT seller_id, first_name, last_name, total_revenue, total_profit 
       FROM sellers ORDER BY total_revenue DESC LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    console.error('Ошибка /api/sellers/top:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// /api/sellers/full?seller_id=...
router.get('/full', async (req, res) => {
  try {
    const seller_id = req.query.seller_id;
    if (!seller_id) return res.status(400).json({ error: 'seller_id required' });

    // Получаем продавца
    const [sellers] = await pool.query('SELECT * FROM sellers WHERE seller_id = ?', [seller_id]);
    if (!sellers.length) return res.status(404).json({ error: 'Seller not found' });

    const seller = sellers[0];

    // Пытаемся взять агрегаты из seller_stats (если есть)
    const [statsRows] = await pool.query('SELECT * FROM seller_stats WHERE seller_id = ?', [seller_id]);
    const stats = statsRows[0] || {};

    // Если в seller_stats нет полей, можно подсчитать минимально:
    // (но мы вернём то, что есть — frontend ожидает average_check, average_profit, kpi_trend, monthly_comparison)
    const payload = {
      seller_id: seller.seller_id,
      first_name: seller.first_name,
      last_name: seller.last_name,
      name: `${seller.first_name || ''} ${seller.last_name || ''}`.trim(),
      department: seller.department || null,
      total_revenue: stats.total_revenue ?? seller.total_revenue ?? 0,
      total_profit: stats.total_profit ?? seller.total_profit ?? 0,
      bonus: stats.bonus ?? seller.bonus ?? 0,
      average_check: stats.average_check ?? 0,
      average_profit: stats.average_profit ?? 0,
      average_discount: stats.average_discount_percent ?? stats.average_discount ?? 0,
      kpi_trend: stats.kpi_trend ? JSON.parse(JSON.stringify(stats.kpi_trend)) : [],
      monthly_comparison: stats.monthly_comparison ? JSON.parse(JSON.stringify(stats.monthly_comparison)) : {},
      updated_at: stats.updated_at || seller.updated_at || null
    };

    res.json(payload);
  } catch (err) {
    console.error('Ошибка /api/sellers/full:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;