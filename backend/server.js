// backend/server.js — ФИНАЛЬНАЯ ВЕРСИЯ С ФИКСОМ АНОМАЛИИ (revenue и quantity ТОЛЬКО от items)

import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

import { pool, createUser, testDB } from './db.js';

// ROUTES (если они есть — оставляем, иначе закомментируйте)
import kpiRouter from './routes/kpi.js';
import dashboardRouter from './routes/dashboard.js';
import recordsRouter from './routes/records.js';
import catalogsRouter from './routes/catalogs.js';

// ------------------------------------------------------------------
// INIT
// ------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------------------------------------------------
// MIDDLEWARE
// ------------------------------------------------------------------
app.use(cors({ origin: '*' }));
app.use(express.json());

// CSP
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https:; " +
    "font-src 'self' https://fonts.gstatic.com https://r2cdn.perplexity.ai data:; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com; " +
    "img-src 'self' https: data: blob:; " +
    "connect-src 'self' https: ws:;"
  );
  next();
});

// ------------------------------------------------------------------
// STATIC FILES (для modules и dashboard.html)
// ------------------------------------------------------------------
const frontendPath = path.resolve(__dirname, '../frontend');

app.use('/src/modules', express.static(path.join(frontendPath, 'src/modules')));  // Для module scripts
app.use(express.static(frontendPath));  // Остальные

app.get('/dashboard.html', (req, res) => {
  const dashboardFile = path.join(frontendPath, 'dashboard.html');
  if (fs.existsSync(dashboardFile)) {
    res.sendFile(dashboardFile);
  } else {
    res.status(404).send('Dashboard page not found');
  }
});

app.get('/favicon.ico', (req, res) => res.sendStatus(204));

// ------------------------------------------------------------------
// DB TEST
// ------------------------------------------------------------------
testDB();

// ==================================================================
// AUTH
// ==================================================================
app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await createUser(email, hash, name);
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Регистрация не удалась' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Неверные данные' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Неверные данные' });
    }

    res.json({
      userId: user.id,
      name: user.name,
      email: user.email
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

// ==================================================================
// PROFILE
// ==================================================================
app.get('/api/profile/data', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(401).json({ error: 'Не авторизован' });

  try {
    const [[user]] = await pool.query(
      'SELECT id, email, name FROM users WHERE id = ?',
      [userId]
    );
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const [[seller]] = await pool.query(
      `
      SELECT 
        first_name,
        last_name,
        department,
        bonus,
        total_revenue,
        total_profit,
        plan_revenue
      FROM sellers
      WHERE seller_id = ?
      `,
      [userId]
    );

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      first_name: seller?.first_name || '',
      last_name: seller?.last_name || '',
      department: seller?.department || '',
      bonus: seller?.bonus || 0,
      total_revenue: seller?.total_revenue || 0,
      total_profit: seller?.total_profit || 0,
      plan_revenue: seller?.plan_revenue ?? 50000.0
    });
  } catch (err) {
    console.error('Profile data error:', err);
    res.status(500).json({ error: 'Не удалось загрузить профиль' });
  }
});

app.post('/api/profile/save', async (req, res) => {
  const { userId, first_name, last_name, department, bonus } = req.body;
  if (!userId) return res.status(401).json({ error: 'Не авторизован' });

  try {
    const [exists] = await pool.query(
      'SELECT seller_id FROM sellers WHERE seller_id = ?',
      [userId]
    );

    if (exists.length) {
      await pool.execute(
        `
        UPDATE sellers
        SET first_name = ?, last_name = ?, department = ?, bonus = ?, updated_at = NOW()
        WHERE seller_id = ?
        `,
        [first_name, last_name, department, bonus, userId]
      );
    } else {
      await pool.execute(
        `
        INSERT INTO sellers
        (seller_id, first_name, last_name, department, bonus, total_revenue, total_profit, total_quantity, plan_revenue)
        VALUES (?, ?, ?, ?, ?, 0, 0, 0, 50000.00)
        `,
        [userId, first_name, last_name, department, bonus]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Profile save error:', err);
    res.status(500).json({ error: 'Не удалось сохранить профиль' });
  }
});

// ==================================================================
// KPI И SELLER-FULL (revenue и quantity ТОЛЬКО от items — фикс аномалии)
// ==================================================================
app.get('/api/seller-full', async (req, res) => {
  try {
    const { seller_id } = req.query;
    const [rows] = await pool.query(
      `
      SELECT 
        s.seller_id,
        s.first_name,
        s.last_name,
        s.department,
        s.bonus,
        s.updated_at,
        COALESCE(s.plan_revenue, 50000.00) AS plan_revenue,
        COALESCE(SUM(pi.quantity * pi.price), 0) AS calculated_revenue,
        COALESCE(SUM(pi.quantity * (pi.price - COALESCE(p.purchase_price, 0))), 0) AS calculated_profit,
        COALESCE(SUM(pi.quantity), 0) AS calculated_quantity
      FROM sellers s
      LEFT JOIN purchase_records pr ON s.seller_id = pr.seller_id
      LEFT JOIN purchase_items pi ON pr.purchase_id = pi.purchase_id
      LEFT JOIN products p ON pi.sku = p.sku
      WHERE s.seller_id = ?
      GROUP BY s.seller_id
      `,
      [seller_id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const s = rows[0];
    const revenue = Number(s.calculated_revenue || 0);  // Только от items
    const profit = Number(s.calculated_profit || 0);
    const qty = Number(s.calculated_quantity || 0);
    const plan = Number(s.plan_revenue || 50000);
    const kpi = plan > 0 ? Math.round((revenue / plan) * 100) : 0;

    res.json({
      seller_id: s.seller_id,
      first_name: s.first_name || 'Не указано',
      last_name: s.last_name || 'Не указано',
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Неизвестно',
      department: s.department || 'Не назначен',
      total_revenue: revenue,
      total_profit: profit,
      total_quantity: qty,
      bonus: Number(s.bonus || 0),
      average_check: qty > 0 ? revenue / qty : 0,
      average_profit: qty > 0 ? profit / qty : 0,
      average_discount: 0,
      kpi,
      kpi_trend: [],
      monthly_comparison: {},
      updated_at: s.updated_at || 'Не указано'
    });
  } catch (err) {
    console.error('Seller-full error:', err);
    res.status(500).json({ error: 'Failed to load seller data' });
  }
});

app.get('/api/sellers-stats', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.seller_id,
        MAX(s.first_name) AS first_name,
        MAX(s.last_name) AS last_name,
        MAX(s.department) AS department,
        MAX(s.bonus) AS bonus,
        MAX(s.updated_at) AS updated_at,
        COALESCE(MAX(s.plan_revenue), 50000.00) AS plan_revenue,
        COALESCE(sales.calculated_revenue, 0) AS calculated_revenue,
        COALESCE(sales.calculated_profit, 0) AS calculated_profit,
        COALESCE(sales.calculated_quantity, 0) AS calculated_quantity
      FROM sellers s
      LEFT JOIN (
        SELECT
          pr.seller_id,
          SUM(pi.quantity * pi.price) AS calculated_revenue,  // Только от items
          SUM(pi.quantity * (pi.price - COALESCE(p.purchase_price, 0))) AS calculated_profit,
          SUM(pi.quantity) AS calculated_quantity
        FROM purchase_records pr
        JOIN purchase_items pi ON pr.purchase_id = pi.purchase_id
        JOIN products p ON pi.sku = p.sku
        GROUP BY pr.seller_id
      ) AS sales ON s.seller_id = sales.seller_id
      GROUP BY s.seller_id
      ORDER BY calculated_profit DESC
    `);

    const items = rows.map(s => {
      const revenue = Number(s.calculated_revenue || 0);
      const plan = Number(s.plan_revenue || 50000);
      const kpi = plan > 0 ? Math.round((revenue / plan) * 100) : 0;

      return {
        seller_id: s.seller_id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Неизвестно',
        department: s.department || 'Не назначен',
        total_revenue: revenue,
        total_profit: Number(s.calculated_profit || 0),
        total_quantity: Number(s.calculated_quantity || 0),
        bonus: Number(s.bonus || 0),
        kpi,
        updated_at: s.updated_at || 'Не указано'
      };
    });

    res.json({ items });
  } catch (err) {
    console.error('sellers-stats error:', err);
    res.status(500).json({ error: 'Failed to load seller stats' });
  }
});

// ==================================================================
// ДРУГИЕ API ROUTES
// ==================================================================
app.use('/api/kpi', kpiRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/records', recordsRouter);
app.use('/api/catalogs', catalogsRouter);

// Заглушка update-seller-stats
app.post('/api/update-seller-stats', (req, res) => {
  console.log('Update stats payload:', req.body);
  res.json({ success: true });
});

// Добавление продажи из личного кабинета
app.post('/api/add-sale', async (req, res) => {
  const { userId, purchase_date, sku, quantity, price, discount = 0 } = req.body;
  if (!userId || !purchase_date || !sku || !quantity || !price) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    // Создать запись покупки (если нет на дату)
    const [prRows] = await connection.query(
      'SELECT purchase_id FROM purchase_records WHERE seller_id = ? AND DATE(purchase_date) = DATE(?)',
      [userId, purchase_date]
    );

    let purchase_id;
    if (prRows.length > 0) {
      purchase_id = prRows[0].purchase_id;
    } else {
      const [insertPr] = await connection.query(
        'INSERT INTO purchase_records (seller_id, purchase_date, total_amount, total_discount) VALUES (?, ?, 0, 0)',
        [userId, purchase_date]
      );
      purchase_id = insertPr.insertId;
    }

    // Добавить товар в покупку
    await connection.query(
      'INSERT INTO purchase_items (purchase_id, sku, quantity, price) VALUES (?, ?, ?, ?)',
      [purchase_id, sku, quantity, price]
    );

    // Пересчитать total_amount
    await connection.query(
      `UPDATE purchase_records 
       SET total_amount = (SELECT SUM(quantity * price) FROM purchase_items WHERE purchase_id = ?)
       WHERE purchase_id = ?`,
      [purchase_id, purchase_id]
    );

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'Продажа добавлена' });
  } catch (err) {
    console.error('Add sale error:', err);
    if (connection) await connection.rollback();
    res.status(500).json({ error: 'Не удалось добавить продажу' });
  }
});

// KPI данные для модалки продавца (графики динамики и категорий)
app.get('/api/kpi/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [[row]] = await pool.query(
      'SELECT kpi_trend FROM seller_stats WHERE seller_id = ?',
      [id]
    );

    if (!row || !row.kpi_trend) {
      // Если нет данных — возвращаем пустые графики (чтобы фронт не падал)
      return res.json({
        salesOverTime: [],
        categoryBreakdown: []
      });
    }

    let trend = row.kpi_trend;
    if (typeof trend === 'string') {
      trend = JSON.parse(trend);  // Если хранится как строка
    }

    res.json(trend);
  } catch (err) {
    console.error('KPI route error for seller', id, err);
    res.status(500).json({
      salesOverTime: [],
      categoryBreakdown: []
    });
  }
});

// ==================================================================
// FALLBACK
// ==================================================================
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API not found' });
  }

  const indexFile = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send('Frontend not found');
  }
});

// ------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});