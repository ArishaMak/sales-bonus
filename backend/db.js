// backend/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

export const pool = mysql.createPool(dbConfig);

export default pool;

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

// Создание таблицы sellers (фикс: seller_id INT, FOREIGN KEY на users.id, удалены дубли email/password)
async function createSellersTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sellers (
        seller_id INT PRIMARY KEY, -- Фикс: INT, FK на users.id
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        department VARCHAR(50),
        bonus DECIMAL(10,2) DEFAULT 0.00,
        total_revenue DECIMAL(14,2) DEFAULT 0.00,
        total_profit DECIMAL(14,2) DEFAULT 0.00,
        total_quantity INT DEFAULT 0,
        plan_revenue DECIMAL(14,2) DEFAULT 10000.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Sellers table created or exists');
  } catch (err) {
    console.error('❌ Sellers table creation failed:', err);
  }
}

// Тест подключения + создание таблиц
export async function testDB() {
  try {
    const [result] = await pool.query('SELECT COUNT(*) as cnt FROM sellers');
    console.log('✅ DB connected, sellers count:', result[0].cnt);

    await createUsersTable();
    await createSellersTable(); // Добавлено

  } catch (err) {
    console.error('❌ DB failed:', err.message);
  }
}

// createUser (обновлённый: авто-INSERT в sellers после users)
export async function createUser(email, passwordHash, name) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || 'Новый';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Продавец';

    // 1. INSERT in users
    const [userResult] = await connection.execute(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [email, passwordHash, name]
    );
    const newUserId = userResult.insertId;

    // 2. Авто-INSERT in sellers (fallback профиль)
    await connection.execute(
      `INSERT INTO sellers (seller_id, first_name, last_name, department, bonus) 
       VALUES (?, ?, ?, 'Не назначен', 0.00)`,
      [newUserId, firstName, lastName]
    );

    await connection.commit();

    console.log(`👤 User created ID: ${newUserId}`);
    console.log(`🧑 Seller record created ID: ${newUserId}`);

    return { id: newUserId, email, name };

  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Email уже используется');
    }
    throw error;
  } finally {
    connection.release();
  }
}

// activateSellerProfile (обновлённый: использовать INT seller_id)
export async function activateSellerProfile(userId, data) {
  const { first_name, last_name, department, bonus } = data;

  const [existing] = await pool.query('SELECT seller_id FROM sellers WHERE seller_id = ?', [userId]);

  if (existing.length > 0) {
    await pool.execute(
      `UPDATE sellers SET first_name = ?, last_name = ?, department = ?, bonus = ?, updated_at = NOW() 
       WHERE seller_id = ?`,
      [first_name, last_name, department, bonus, userId]
    );
    return { message: 'Профиль обновлён' };
  } else {
    await pool.execute(
      `INSERT INTO sellers (seller_id, first_name, last_name, department, bonus, total_revenue, total_profit, total_quantity)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0)`,
      [userId, first_name, last_name, department, bonus]
    );
    return { message: 'Профиль создан' };
  }
}

// Авто-тест при запуске
testDB();