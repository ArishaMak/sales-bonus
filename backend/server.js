// ========================== Импорты ==========================
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
/*import fs from 'fs';*/
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// ========================== Настройки путей ==========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ========================== Конфигурация ==========================
const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());           // Разрешаем запросы с фронтенда
app.use(express.json());   // Позволяет читать JSON в теле запросов

// Путь к фронтенду
const frontendPath = path.join(__dirname, '../frontend');

// Раздача статики
app.use(express.static(frontendPath));

/* Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});*/

// ========================== Подключение к БД ==========================
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sales_bonus',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Тест подключения при старте
async function testDB() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ DB connected successfully');
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
  }
}
testDB();

// ========================== Вспомогательные функции ==========================
function getQueryString(q) {
  return q === undefined || q === null ? '' : String(q).trim();
}

// ========================== API ==========================

// --- Получение записей (purchase_records)
app.get('/api/records', async (req, res) => {
  try {
    let { page = 1, limit = 10, search = '', sortBy = 'purchase_id', sortDir = 'asc', sellerId, sku } = req.query;

    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.max(1, parseInt(limit, 10) || 10);
    sortDir = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const ALLOWED_SORT = ['purchase_id', 'purchase_date', 'total_amount', 'seller_id'];
    if (!ALLOWED_SORT.includes(String(sortBy))) sortBy = 'id';

    const where = [];
    const params = [];

    const q = getQueryString(search);
    if (q) {
      where.push('(pr.id LIKE ? OR pr.total_amount LIKE ? OR CONCAT(c.first_name, " ", c.last_name) LIKE ? OR CONCAT(s.first_name, " ", s.last_name) LIKE ? OR pr.seller_id LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    if (sellerId) {
      where.push('pr.seller_id = ?');
      params.push(sellerId);
    }

    if (sku) {
      where.push('EXISTS(SELECT 1 FROM purchase_items pi WHERE pi.purchase_id = pr.purchase_id AND pi.sku = ?)');
      params.push(sku);
    }

    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Подсчёт общего количества записей
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM purchase_records pr
       LEFT JOIN customers c ON pr.customer_id = c.customer_id
       LEFT JOIN sellers s ON pr.seller_id = s.seller_id
       ${whereSQL}`,
      params
    );
    const total = countRows[0]?.cnt || 0;

    // Получение данных с пагинацией
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

    // Подгружаем позиции покупок
    const recordIds = rows.map(r => r.purchase_id);
    const itemsMap = {};
    if (recordIds.length > 0) {
      const [items] = await pool.query(
        `SELECT purchase_id, sku, quantity, discount_id, sale_price
         FROM purchase_item
         WHERE purchase_id IN (?)`,
        [recordIds]
      );
      items.forEach(it => {
        if (!itemsMap[it.purchase_id]) itemsMap[it.purchase_id] = [];
        itemsMap[it.purchase_id].push({
          ...it,
          discount: it.discount_id || 0
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
      seller_name: `${r.seller_first || ''} ${r.seller_last || ''}`.trim(),
      customer_name: `${r.customer_first || ''} ${r.customer_last || ''}`.trim(),
      items: itemsMap[r.purchase_id] || []
    }));

    res.json({ total, page, limit, items: data });
  } catch (err) {
    console.error('Ошибка /api/records:', err);
    res.status(500).json({ error: 'Ошибка сервера при получении записей' });
  }
});

// --- Получение справочников
app.get('/api/catalogs', async (req, res) => {
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

// --- Проверка соединения с БД
app.post('/api/reload-data', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, message: 'DB connection ok' });
  } catch (err) {
    console.error('Ошибка проверки БД:', err);
    res.status(500).json({ ok: false, message: 'DB error' });
  }
});

// ========================== Обработка фронтенда ==========================

/* Главная страница (корень сайта)
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});*/

// Для всех остальных путей (например, /dashboard или /stats) отдаём index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Глобальный обработчик ошибок (фикс: для логов 500)
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Server error' });
});

// ========================== Запуск сервера ==========================
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
