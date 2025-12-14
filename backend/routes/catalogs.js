// backend/routes/catalogs.js
import express from 'express';
import { pool } from '../db.js';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products ORDER BY sku');
    const [sellers] = await pool.query('SELECT * FROM sellers ORDER BY seller_id');
    const [customers] = await pool.query('SELECT * FROM customers ORDER BY customer_id');
    res.json({ products, sellers, customers });
  } catch (err) {
    console.error('Ошибка /api/catalogs:', err);
    res.status(500).json({ error: 'Ошибка сервера при получении каталогов' });
  }
});

export default router;