// backend/routes/profile.js (создайте и экспортируйте default router)
import express from "express";
import { pool } from "../db.js"; // Предполагаем, что sellers связаны с users по user_id
const router = express.Router();

/**
 * GET /api/profile/:id — Получает профиль + статистику для userId.
 */
router.get("/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        // 1. Данные профиля из sellers (fallback на users, если нет)
        const [sellers] = await pool.query(
            `SELECT * FROM sellers WHERE user_id = ?`,
            [userId]
        );
        const seller = sellers[0] || {}; // { first_name, last_name, department, bonus, ... }

        // 2. Личная статистика (выручка/прибыль для этого seller)
        const [stats] = await pool.query(
            `
            SELECT 
                COALESCE(SUM(total_revenue), 0) AS total_revenue,
                COALESCE(SUM(total_profit), 0) AS total_profit
            FROM seller_month_sales 
            WHERE seller_id = (SELECT id FROM sellers WHERE user_id = ?)
            `,
            [userId]
        );
        const { total_revenue, total_profit } = stats[0] || { total_revenue: 0, total_profit: 0 };

        // 3. Данные пользователя (email, name) из users
        const [users] = await pool.query(`SELECT email, name FROM users WHERE id = ?`, [userId]);
        const user = users[0] || {};

        res.json({
            id: userId,
            ...user,
            ...seller,
            total_revenue,
            total_profit
        });
    } catch (err) {
        console.error("Ошибка /api/profile:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * PUT /api/profile/:id — Сохраняет профиль (активация/обновление).
 */
router.put("/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        const { first_name, last_name, department, bonus } = req.body;
        
        // Вставка/обновление в sellers
        await pool.query(
            `INSERT INTO sellers (user_id, first_name, last_name, department, bonus) 
             VALUES (?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             first_name = VALUES(first_name), 
             last_name = VALUES(last_name), 
             department = VALUES(department), 
             bonus = VALUES(bonus)`,
            [userId, first_name, last_name, department, bonus]
        );
        
        res.json({ message: "Профиль обновлён успешно" });
    } catch (err) {
        console.error("Ошибка PUT /api/profile:", err);
        res.status(500).json({ error: "Server error" });
    }
});

export default router;