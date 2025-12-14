// backend/routes/auth.js
import express from "express";
import { pool } from "../db.js"; // Импорт пула БД из вашего db.js
import bcrypt from "bcrypt"; // Опционально: npm install bcrypt для хэширования (если нужно)

const router = express.Router();

// Таблица users, если нет: CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) UNIQUE, password VARCHAR(255), name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

// POST /api/auth/register — Регистрация
router.post("/register", async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Валидация (простая)
        if (!email || !password || !name) {
            return res.status(400).json({ error: "Email, пароль и имя обязательны" });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Пароль должен быть не короче 6 символов" });
        }

        // Проверка на существующий email
        const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: "Email уже зарегистрирован" });
        }

        // Хэширование пароля (простое, в проде используйте bcrypt.hash(password, 10))
        const hashedPassword = password; // Замените на bcrypt.hashSync(password, 10);

        // Вставка пользователя
        const [result] = await pool.query(
            "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
            [email, hashedPassword, name]
        );

        // Возврат userId (без пароля!)
        res.status(201).json({ 
            user: { id: result.insertId, email, name },
            message: "Регистрация успешна"
        });
    } catch (err) {
        console.error("Ошибка регистрации:", err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/auth/login — Логин
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Валидация
        if (!email || !password) {
            return res.status(400).json({ error: "Email и пароль обязательны" });
        }

        // Поиск пользователя
        const [users] = await pool.query("SELECT id, email, name, password FROM users WHERE email = ?", [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: "Неверный email или пароль" });
        }

        const user = users[0];

        // Проверка пароля (простая, в проде: bcrypt.compareSync(password, user.password))
        if (user.password !== password) { // Замените на bcrypt.compareSync(password, user.password)
            return res.status(401).json({ error: "Неверный email или пароль" });
        }

        // Успех: возвращаем userId и имя (без пароля)
        res.json({ 
            userId: user.id, 
            name: user.name,
            message: "Вход успешен"
        });
    } catch (err) {
        console.error("Ошибка логина:", err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;