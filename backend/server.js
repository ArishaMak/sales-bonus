// backend/server.js — ФИНАЛЬНАЯ ВЕРСИЯ С МИНИМАЛЬНЫМИ ИСПРАВЛЕНИЯМИ

import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import fs from "fs";
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';

// ИМПОРТ pool (как было)
import { pool } from './db.js';

// ИМПОРТ createUser — ДОБАВЛЕНО ПО РЕКОМЕНДАЦИИ
import { createUser } from './db.js';

// 1. Настройка путей и переменных окружения
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// 2. MIDDLEWARE
app.use(cors({ origin: "*" }));
app.use(express.json());

const frontendPath = path.resolve(__dirname, '../frontend');

// ======================================================================
// 🔥 НОВЫЙ МАРШРУТ /api/register — МИНИМАЛЬНАЯ ИНТЕГРАЦИЯ, КАК СОВЕТОВАЛА ИИ
// ======================================================================
app.post('/api/register', async (req, res) => {
    const { email, password, name } = req.body;

    // Простая валидация
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Все поля должны быть заполнены.' });
    }

    try {
        // вызываем createUser из db.js (как рекомендовала нейросеть)
        const newUser = await createUser(email, password, name);

        res.status(201).json({
            message: 'Пользователь успешно зарегистрирован.',
            user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name
            }
        });

    } catch (err) {
        console.error('Server registration error:', err);

        if (err.message.includes('Email уже зарегистрирован')) {
            return res.status(409).json({ error: err.message });
        }

        return res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
    }
});

// ======================================================================
// CSP
// ======================================================================
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy',
        "default-src 'self' https:; " +
        "font-src 'self' https://fonts.gstatic.com data:; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "img-src 'self' https: data: blob:; " +
        "connect-src 'self' https: ws:;"
    );
    next();
});

// 3. СТАТИЧЕСКИЕ ФАЙЛЫ
app.use(express.static(frontendPath));

// 4. ТЕСТ БАЗЫ
async function testDB() {
    try {
        const [result] = await pool.query('SELECT COUNT(*) as cnt FROM sellers');
        console.log('✅ DB connected, sellers count:', result[0].cnt);
    } catch (err) {
        console.error('❌ DB failed. Ensure database is running and schema exists:', err.message);
    }
}
testDB();

function getQueryString(q) {
    return q === undefined || q === null ? '' : String(q).trim();
}

// ======================================================================
// 📌 ВСЕ ОСТАЛЬНЫЕ API-МАРШРУТЫ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ
// ======================================================================

// KPI
app.get('/api/kpi/:sellerId', async (req, res) => {
    try {
        const sellerId = req.params.sellerId;
        const [rows] = await pool.query(
            `
            SELECT 
                COALESCE(SUM(pi.quantity * pi.price), 0) AS calculated_revenue, 
                COALESCE(SUM(pi.quantity * (pi.price - COALESCE(p.purchase_price, 0))), 0) AS calculated_profit
            FROM sellers s
            LEFT JOIN purchase_records pr ON s.seller_id = pr.seller_id
            LEFT JOIN purchase_items pi ON pr.purchase_id = pi.purchase_id
            LEFT JOIN products p ON pi.sku = p.sku
            WHERE s.seller_id = ?
            `,
            [sellerId]
        );

        const stats = rows[0] || {};

        res.json({
            revenue: Number(stats.calculated_revenue || 0),
            profit: Number(stats.calculated_profit || 0),
            kpi_trend: [1000, 1500, 1200, 1800, 2500, 3000, 3200]
        });

    } catch (err) {
        console.error('KPI error:', err);
        res.status(500).json({ error: 'KPI failed' });
    }
});

// seller-full
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
        const revenue = Number(s.calculated_revenue || 0);
        const profit = Number(s.calculated_profit || 0);
        const qty = Number(s.calculated_quantity || 0);

        res.json({
            seller_id: s.seller_id,
            first_name: s.first_name,
            last_name: s.last_name,
            name: `${s.first_name} ${s.last_name}`,
            department: s.department,
            total_revenue: revenue,
            total_profit: profit,
            total_quantity: qty,
            bonus: Number(s.bonus || 0),
            average_check: qty > 0 ? revenue / qty : 0,
            average_profit: qty > 0 ? profit / qty : 0,
            average_discount: 0,
            kpi: 0,
            kpi_trend: [],
            monthly_comparison: {},
            updated_at: s.updated_at
        });

    } catch (err) {
        console.error('Seller-full error:', err);
        res.status(500).json({ error: 'Seller failed' });
    }
});

// sellers-stats
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
                COALESCE(SUM(pi.quantity * pi.price), 0) AS calculated_revenue,
                COALESCE(SUM(pi.quantity * (pi.price - COALESCE(p.purchase_price, 0))), 0) AS calculated_profit,
                COALESCE(SUM(pi.quantity), 0) AS calculated_quantity
            FROM sellers s
            LEFT JOIN purchase_records pr ON s.seller_id = pr.seller_id
            LEFT JOIN purchase_items pi ON pr.purchase_id = pi.purchase_id
            LEFT JOIN products p ON pi.sku = p.sku
            GROUP BY s.seller_id
            ORDER BY calculated_profit DESC
        `);

        const items = rows.map(s => {
            const profit = Number(s.calculated_profit || 0);
            const kpi = Math.max(0, Math.round((profit / 10000) * 100));

            return {
                seller_id: s.seller_id,
                name: `${s.first_name} ${s.last_name}`,
                department: s.department,
                total_revenue: Number(s.calculated_revenue || 0),
                total_profit: profit,
                total_quantity: Number(s.calculated_quantity || 0),
                bonus: Number(s.bonus || 0),
                kpi,
                updated_at: s.updated_at
            };
        });

        res.json({ items });
    } catch (err) {
        console.error("sellers-stats error:", err);
        res.status(500).json({ error: "Failed to load seller stats" });
    }
});

// top-products
app.get('/api/top-products', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                p.sku AS id_artikul, 
                MAX(p.name) AS name, 
                COALESCE(SUM(pi.quantity * pi.price), 0) AS revenue,
                COALESCE(SUM(pi.quantity), 0) AS total_qty,
                'N/A' AS sellers 
            FROM products p 
            LEFT JOIN purchase_items pi ON p.sku = pi.sku
            GROUP BY p.sku
            ORDER BY revenue DESC 
            LIMIT 10
        `);

        res.json(rows);

    } catch (err) {
        console.error('Top-products error:', err);
        res.status(500).json({ error: 'Top products failed' });
    }
});

// catalogs
app.get('/api/catalogs', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT * FROM products ORDER BY sku');
        const [sellers] = await pool.query('SELECT * FROM sellers ORDER BY seller_id');
        const [customers] = await pool.query('SELECT * FROM customers ORDER BY customer_id');
        res.json({ products, sellers, customers });
    } catch (err) {
        res.status(500).json({ error: 'Catalogs failed' });
    }
});

// records
app.get('/api/records', async (req, res) => {
    try {
        let { page = 1, limit = 10, search = '' } = req.query;

        page = Math.max(1, parseInt(page));
        limit = Math.max(1, parseInt(limit));

        const where = [];
        const params = [];
        const q = getQueryString(search);

        if (q) {
            where.push('(pr.purchase_id LIKE ? OR pr.total_amount LIKE ? OR pr.seller_id LIKE ?)');
            const like = `%${q}%`;
            params.push(like, like, like);
        }

        const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS cnt FROM purchase_records pr ${whereSQL}`, params
        );

        const total = countRows[0].cnt || 0;
        const offset = (page - 1) * limit;

        const [rows] = await pool.query(
            `
            SELECT 
                pr.*, 
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'item_id', pi.item_id, 
                        'sku', pi.sku, 
                        'quantity', pi.quantity, 
                        'sale_price', pi.price,
                        'discount_id', pi.discount_id
                    )
                ) as items_json
            FROM purchase_records pr 
            LEFT JOIN purchase_items pi ON pr.purchase_id = pi.purchase_id
            ${whereSQL}
            GROUP BY pr.purchase_id
            ORDER BY pr.purchase_id DESC 
            LIMIT ? OFFSET ?
            `,
            [...params, limit, offset]
        );

        const items = rows.map(r => ({
            id: r.purchase_id,
            purchase_id: r.purchase_id,
            seller_id: r.seller_id,
            customer_id: r.customer_id,
            total_amount: r.total_amount,
            total_discount: r.total_discount,
            purchase_date: r.purchase_date,
            items: r.items_json ? JSON.parse(r.items_json) : []
        }));

        res.json({ total, page, limit, items });

    } catch (err) {
        console.error('Records error:', err);
        res.status(500).json({ error: 'Records failed' });
    }
});

// ======================================================================
// FALLBACK
// ======================================================================
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    const filePath = path.join(frontendPath, 'index.html');
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Frontend not found');
    }
    res.sendFile(filePath);
});

// ======================================================================
// START SERVER
// ======================================================================
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
