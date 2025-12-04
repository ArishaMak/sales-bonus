// backend/routes/stats.js
import express from 'express';
import { pool } from '../db.js';
const router = express.Router();

// POST /api/update-seller-stats
router.post('/update-seller-stats', async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.period_id || !Array.isArray(payload.stats)) {
    return res.status(400).json({ error: 'Неверный формат. Ожидается { period_id, stats[] }' });
  }

  const period_id = payload.period_id;
  const stats = payload.stats;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let updated = 0;

    for (const s of stats) {
      if (!s || !s.seller_id) continue;
      const seller_id = String(s.seller_id);

      // UPSERT в seller_stats (seller_id — PK VARCHAR)
      const kpi_trend = JSON.stringify(s.kpi_trend || []);
      const monthly_comparison = JSON.stringify(s.monthly_comparison || {});

      await conn.execute(
        `INSERT INTO seller_stats (
           seller_id, period_id, total_quantity, total_revenue, total_profit, bonus,
           average_check, average_profit, average_discount_percent, kpi_trend, monthly_comparison, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           period_id = VALUES(period_id),
           total_quantity = VALUES(total_quantity),
           total_revenue = VALUES(total_revenue),
           total_profit = VALUES(total_profit),
           bonus = VALUES(bonus),
           average_check = VALUES(average_check),
           average_profit = VALUES(average_profit),
           average_discount_percent = VALUES(average_discount_percent),
           kpi_trend = VALUES(kpi_trend),
           monthly_comparison = VALUES(monthly_comparison),
           updated_at = NOW()
        `,
        [
          seller_id,
          period_id,
          Number(s.total_quantity || 0),
          Number(s.total_revenue || 0),
          Number(s.total_profit || 0),
          Number(s.bonus || 0),
          Number(s.average_check || 0),
          Number(s.average_profit || 0),
          Number(s.average_discount || 0),
          kpi_trend,
          monthly_comparison
        ]
      );
      updated++;
    }

    await conn.commit();
    res.json({ ok: true, updated, message: `Обновлено ${updated}` });
  } catch (err) {
    await conn.rollback();
    console.error('Ошибка /api/update-seller-stats:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    conn.release();
  }
});

export default router;
