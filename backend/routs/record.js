// backend/routes/records.js
import express from 'express';
import { pool } from '../db.js';
const router = express.Router();

function safeTrim(q){ return q === undefined || q === null ? '' : String(q).trim(); }

router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 10, search = '', sortBy = 'purchase_id', sortDir = 'asc', sellerId, sku } = req.query;
    page = Math.max(1, parseInt(page,10) || 1);
    limit = Math.max(1, parseInt(limit,10) || 10);
    sortDir = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const ALLOWED_SORT = ['purchase_id','purchase_date','total_amount','seller_id'];
    if (!ALLOWED_SORT.includes(String(sortBy))) sortBy = 'purchase_id';

    const where = [];
    const params = [];

    const q = safeTrim(search);
    if (q) {
      const like = `%${q}%`;
      where.push(`(
        pr.purchase_id LIKE ? OR pr.total_amount LIKE ? OR CONCAT(c.first_name,' ',c.last_name) LIKE ? OR CONCAT(s.first_name,' ',s.last_name) LIKE ? OR pr.seller_id LIKE ?
      )`);
      params.push(like, like, like, like, like);
    }

    if (sellerId) { where.push('pr.seller_id = ?'); params.push(sellerId); }
    if (sku) {
      where.push(`EXISTS(SELECT 1 FROM purchase_item pi WHERE pi.purchase_id = pr.purchase_id AND pi.sku = ?)`);
      params.push(sku);
    }

    const whereSQL = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM purchase_records pr
       LEFT JOIN customers c ON pr.customer_id = c.customer_id
       LEFT JOIN sellers s ON pr.seller_id = s.seller_id
       ${whereSQL}`, params
    );
    const total = countRows[0]?.cnt || 0;
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT pr.*,
         s.first_name AS seller_first, s.last_name AS seller_last,
         c.first_name AS customer_first, c.last_name AS customer_last
       FROM purchase_records pr
       LEFT JOIN sellers s ON pr.seller_id = s.seller_id
       LEFT JOIN customers c ON pr.customer_id = c.customer_id
       ${whereSQL}
       ORDER BY pr.${sortBy} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

// загрузка позиций заказа
const recordIds = rows.map(r => r.purchase_id);
const itemsMap = {};

if (recordIds.length) {
  const [items] = await pool.query(
    `SELECT 
        purchase_id, 
        sku, 
        quantity, 
        discount AS discount, 
        price AS sale_price,
        cost
     FROM purchase_items 
     WHERE purchase_id IN (?)`,
    [recordIds]
  );

  items.forEach(it => {
    itemsMap[it.purchase_id] = itemsMap[it.purchase_id] || [];
    itemsMap[it.purchase_id].push({
      sku: it.sku,
      quantity: it.quantity,
      discount: it.discount || 0,
      price: it.sale_price,
      cost: it.cost
    });
  });
}

    const data = rows.map(r => ({
      id: r.purchase_id,
      purchase_id: r.purchase_id,
      seller_id: r.seller_id,
      customer_id: r.customer_id,
      payment_id: r.payment_id || null,
      total_amount: r.total_amount,
      total_discount: r.total_discount,
      purchase_date: r.purchase_date,
      seller_name: `${r.seller_first||''} ${r.seller_last||''}`.trim(),
      customer_name: `${r.customer_first||''} ${r.customer_last||''}`.trim(),
      items: itemsMap[r.purchase_id] || []
    }));

    res.json({ total, page, limit, items: data });

  } catch (err) {
    console.error('Ошибка /api/records:', err);
    res.status(500).json({ error: 'Ошибка сервера при получении записей' });
  }
});

export default router;
