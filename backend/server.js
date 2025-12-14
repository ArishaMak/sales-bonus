import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

import { pool, createUser, testDB } from './db.js';

// ROUTES
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
    "font-src 'self' https://fonts.gstatic.com https://r2cdn.perplexity.ai data:; " +  // ← добавлено https://r2cdn.perplexity.ai
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com; " +
    "img-src 'self' https: data: blob:; " +
    "connect-src 'self' https: ws:;"
  );
  next();
});

// ------------------------------------------------------------------
// STATIC
// ------------------------------------------------------------------
const frontendPath = path.resolve(__dirname, '../frontend');
app.use(express.static(frontendPath));

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

  const [rows] = await pool.query(
    `
    SELECT 
      u.email, u.name,
      COALESCE(s.first_name,'') AS first_name,
      COALESCE(s.last_name,'') AS last_name,
      COALESCE(s.department,'') AS department,
      COALESCE(s.bonus,0) AS bonus
    FROM users u
    LEFT JOIN sellers s ON u.id = s.seller_id
    WHERE u.id = ?
    `,
    [userId]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  res.json(rows[0]);
});

app.post('/api/profile/save', async (req, res) => {
  const { userId, first_name, last_name, department, bonus } = req.body;
  if (!userId) return res.status(401).json({ error: 'Не авторизован' });

  const [exists] = await pool.query(
    'SELECT id FROM sellers WHERE seller_id = ?',
    [userId]
  );

  if (exists.length) {
    await pool.execute(
      `
      UPDATE sellers
      SET first_name=?, last_name=?, department=?, bonus=?, updated_at=NOW()
      WHERE seller_id=?
      `,
      [first_name, last_name, department, bonus, userId]
    );
  } else {
    await pool.execute(
      `
      INSERT INTO sellers
      (seller_id, first_name, last_name, department, bonus, total_revenue, total_profit, total_quantity)
      VALUES (?, ?, ?, ?, ?, 0, 0, 0)
      `,
      [userId, first_name, last_name, department, bonus]
    );
  }

  res.json({ success: true });
});

// ==================================================================
// API ROUTES (КРИТИЧНО ДЛЯ ФРОНТА)
// ==================================================================
app.use('/api/kpi', kpiRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/records', recordsRouter);
app.use('/api/catalogs', catalogsRouter);

// Заглушка — фронт ждёт этот эндпоинт
app.post('/api/update-seller-stats', (req, res) => {
  res.json({ success: true });
});

// ==================================================================
// FALLBACK
// ==================================================================
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API not found' });
  }

  const indexFile = path.join(frontendPath, 'index.html');
  if (!fs.existsSync(indexFile)) {
    return res.status(404).send('Frontend not found');
  }

  res.sendFile(indexFile);
});

// ------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
