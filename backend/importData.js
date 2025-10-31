// ========================== Импорты ==========================
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// ========================== Пути ==========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Путь к файлу dataset.json
const DATA_PATH = path.join(__dirname, 'data', 'dataset.json');

// ========================== Импорт данных ==========================
async function importData() {
  try {
    console.log('📂 Загружаем данные из JSON...');
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const data = JSON.parse(raw);

    console.log('🔗 Подключаемся к MySQL...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sales_bonus',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
    });

    console.log('✅ Подключено к MySQL');

    console.log('📋 Создаём таблицы...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sku VARCHAR(50) UNIQUE,
        name VARCHAR(255),
        category VARCHAR(100),
        purchase_price DECIMAL(10,2),
        sale_price DECIMAL(10,2)
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sellers (
        seller_id INT PRIMARY KEY,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        department VARCHAR(100)
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(50),
        workplace VARCHAR(100),
        position VARCHAR(100)
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchase_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT,
        seller_id INT,
        total_amount DECIMAL(10,2),
        total_discount DECIMAL(10,2),
        purchase_date DATE
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchase_item (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id INT,
        sku VARCHAR(50),
        quantity INT,
        discount DECIMAL(5,2),
        sale_price DECIMAL(10,2)
      )
    `);

    /* ИЗМЕНЕНИЕ: Создаём недостающие таблицы с id AUTO_INCREMENT PRIMARY KEY для ORDER BY pr.id.
    console.log('📋 Создаём недостающие таблицы...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchase_records (
        
        customer_id VARCHAR(50),
        seller_id VARCHAR(50),
        total_amount DECIMAL(10,2),
        total_discount DECIMAL(10,2),
        purchase_date DATE
      )
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS purchase_item (
      id INT AUTO_INCREMENT PRIMARY KEY,  // ИЗМЕНЕНИЕ: Добавляем id AUTO_INCREMENT
      purchase_id INT,
      sku VARCHAR(50),
      quantity INT,
      discount DECIMAL(5,2),
      sale_price DECIMAL(10,2)
      )
  `);*/

    // --- Очистка таблиц перед импортом ---
    console.log('🗑️ Очищаем таблицы...');
    await connection.query('DELETE FROM purchase_item');
    await connection.query('DELETE FROM purchase_records');
    await connection.query('DELETE FROM products');
    await connection.query('DELETE FROM sellers');
    await connection.query('DELETE FROM customers');

    // --- Импорт данных ---
    console.log('📦 Импортируем продукты...');
    for (const p of data.products) {
      await connection.query(
        'INSERT INTO products (sku, name, category, purchase_price, sale_price) VALUES (?, ?, ?, ?, ?)',
        [p.sku, p.name, p.category, p.purchase_price, p.sale_price]
      );
    }

    console.log('📦 Импортируем продавцов...');
    for (let i = 0; i < data.sellers.length; i++) {
      const s = data.sellers[i];
  const sellerId = s.id || s.seller_id || `seller_${i + 1}`;  // ИЗМЕНЕНИЕ: Fallback на s.seller_id или 'seller_1' если null
  await connection.query(
    'INSERT INTO sellers (seller_id, first_name, last_name, department) VALUES (?, ?, ?, ?)',
      [sellerId, s.first_name || '', s.last_name || '', s.department || null]
    );
  }

    console.log('📦 Импортируем покупателей...');
    for (let i = 0; i < data.customers.length; i++) {
      const c = data.customers[i];
      const customerId = c.id || c.customer_id || `customer_${i + 1}`;  // ИЗМЕНЕНИЕ: Fallback
      await connection.query(
        'INSERT INTO customers (customer_id, first_name, last_name, phone, workplace, position) VALUES (?, ?, ?, ?, ?, ?)',
        [customerId, c.first_name || '', c.last_name || '', c.phone || null, c.workplace || null, c.position || null]
      );
    }

    console.log('📦 Импортируем покупки...');
    for (const r of data.purchase_records) {
      const customerId = r.customer_id || 1;  // Fallback на первый customer
      const sellerId = r.seller_id || 1;  // Fallback на первый seller
      const [result] = await connection.query(
        'INSERT INTO purchase_records (customer_id, seller_id, total_amount, total_discount, purchase_date) VALUES (?, ?, ?, ?, ?)',
        [customerId, sellerId, r.total_amount || 0, r.total_discount || 0, r.purchase_date || '2024-01-01']
      );
      const purchaseId = result.insertId;

      // импортируем связанные позиции
      if (r.items && r.items.length) {
        for (const item of r.items) {
          await connection.query(
            'INSERT INTO purchase_item (purchase_id, sku, quantity, discount_id, sale_price) VALUES (?, ?, ?, ?, ?)',
            [purchaseId, item.sku, item.quantity, item.discountID, item.sale_price]
          );
        }
      }
    }

    console.log('✅ Импорт завершён успешно!');
    await connection.end();
  } catch (error) {
    console.error('❌ Ошибка при импорте:', error);
  }
}

// Запускаем импорт
importData();
