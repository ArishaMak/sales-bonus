// backend/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env корректным путём (минимальное изменение)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Минимальное улучшение: выносим конфиг в объект
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sales_bonus',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Создаём пул (как было)
export const pool = mysql.createPool(dbConfig);

export default pool;  // нужно для default-импорта в сервисах

// ------------------ ДОБАВЛЕНО МИНИМАЛЬНО ------------------

// Создание таблицы users
async function createUsersTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created or exists');
  } catch (err) {
    console.error('❌ Users table creation failed:', err);
  }
}

// Тест подключения
async function testDB() {
  try {
    const [result] = await pool.query('SELECT COUNT(*) as cnt FROM sellers');
    console.log('✅ DB connected, sellers count:', result[0].cnt);

    // добавлено по рекомендации: проверяем и создаём users
    await createUsersTable();

  } catch (err) {
    console.error('❌ DB failed:', err.message);
  }
}

// --- Добавляем обратно функцию createUser --- //

export async function createUser(email, passwordHash, name) {
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [email, passwordHash, name]
    );

    console.log(`👤 User created ID: ${result.insertId}`);
    return { id: result.insertId, email, name };

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Email уже используется');
    }
    throw error;
  }
}

// Автоматически вызываем тест при запуске
testDB();
