// server.js

// импорты библиотек
const express = require('express'); // основной фреймворе для создания сервера. обрабатывает запросы и ответы
const cors = require('cors'); // разрешает запросы с фронтенда, который может быть на другом порту
const fs = require('fs'); // работа с файловой системой (чтение json файла с данными)
const path = require('path'); // помогает корректно формировать пути к файлам

// настройка сервера и порта
const PORT = process.env.PORT || 3000; // порт, на котором автоматически запускается сервер (3000 по умолч)
const app = express(); // создаем экземпляр приложения express

app.use(cors()); // разрешает фронтенду обращаться к API без ошибок CORS
app.use(express.json()); // запросить json в теле запросов

// Путь к файлу с данными (dataset.json)
const DATA_PATH = path.join(__dirname, 'data', 'dataset.json');

// Утилита: загрузить данные (синхронно при старте)
/* открывает файл dataset.json;
   читает его содержимое;
   парсит в объект JavaScript;
   если что-то пойдёт не так (файл не найден или ошибка парсинга) — возвращает пустую структуру данных.
*/
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Ошибка чтения данных:', err);
    return { purchase_records: [], products: [], sellers: [], customers: [] };
  }
}

// загрузка данных в память (сервер работает в оперативке, не в бд)
let DATA = loadData();

// основной api для получения записей с фильтрацией/поиском/сортировкой/пагинацией
// Параметры query:
// page (1-based), limit (записей на страницу), search (строка; текст для поиска), sortBy, sortDir (направление: asc|desc), sellerId (фильтр по продавцу), sku (фильтр по товару)
app.get('/api/records', (req, res) => {
  let { page = 1, limit = 10, search = '', sortBy = 'purchase_id', sortDir = 'asc', sellerId, sku } = req.query;
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  // Берём записи покупок; предполагаем структура DATA.purchase_records
  let items = Array.isArray(DATA.purchase_records) ? [...DATA.purchase_records] : [];

  // Поиск по общему тексту: попробуем искать по seller name, customer phone, total_amount и т.д.
  const q = String(search || '').trim().toLowerCase();
  if (q) {
    items = items.filter(r => {
      // пример: ищем в total_amount, seller_id (возможно нужно маппить на имя), purchase_id
      return (
        String(r.purchase_id).includes(q) ||
        String(r.total_amount).toLowerCase().includes(q) ||
        (r.seller_id && String(r.seller_id).includes(q)) ||
        (r.customer_id && String(r.customer_id).includes(q))
      );
    });
  }

  // Фильтрация по sellerId или sku
  if (sellerId) {
    items = items.filter(r => String(r.seller_id) === String(sellerId));
  }
  if (sku) {
    // если purchase_records содержит items внутри, фильтруем те записи, где есть позиция с sku
    items = items.filter(r => Array.isArray(r.items) && r.items.some(it => String(it.sku) === String(sku)));
  }

  // Сортировка (если поле есть)
  if (sortBy) {
    items.sort((a, b) => {
      const A = a[sortBy];
      const B = b[sortBy];
      if (A == null && B == null) return 0;
      if (A == null) return sortDir === 'asc' ? -1 : 1;
      if (B == null) return sortDir === 'asc' ? 1 : -1;
      if (typeof A === 'number' && typeof B === 'number') {
        return sortDir === 'asc' ? A - B : B - A;
      } else {
        return sortDir === 'asc'
          ? String(A).localeCompare(String(B), undefined, { numeric: true })
          : String(B).localeCompare(String(A), undefined, { numeric: true });
      }
    });
  }

  // пагинация
  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  res.json({
    total,
    page,
    limit,
    items: paged
  });
});

// Эндпоинт чтобы вернуть справочники/списки (products, sellers, customers)
app.get('/api/catalogs', (req, res) => {
  res.json({
    products: DATA.products || [],
    sellers: DATA.sellers || [],
    customers: DATA.customers || []
  });
});

// Простой endpoint для перезагрузки данных (dev only)
app.post('/api/reload-data', (req, res) => {
  DATA = loadData();
  res.json({ ok: true, message: 'Data reloaded', totalRecords: DATA.purchase_records.length });
});

// запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
