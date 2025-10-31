/**
 * ===== main.js =====
 * Этот файл управляет загрузкой данных с сервера,
 * их анализом (выручка, прибыль, бонусы) и отображением в консоли.
 * Теперь он поддерживает фильтрацию, поиск и пагинацию.
 */

// ---------------------- НАСТРОЙКИ ----------------------
const API_BASE = 'http://localhost:5000/api';

// Текущие параметры запроса (можно будет менять при поиске/фильтрах)
let queryParams = {
  page: 1,
  limit: 9999, // потом исправлю
  search: '',
  sellerId: '',
  sku: '',
  sortBy: 'purchase_id',
  sortDir: 'asc'
};

// ---------------------- ФУНКЦИИ РАСЧЁТА ----------------------

/*function calculateSimpleRevenue(purchase, _product) {
  const { discount = 0, sale_price = 0, quantity = 0 } = purchase;
  const finalDiscount = 1 - discount / 100;
  return sale_price * quantity * finalDiscount;
}*/
function calculateSimpleRevenue(item, product) {  // Переименуйте param для ясности
  const { discount = 0, quantity = 0 } = item;   // Из item: discount, quantity
  const sale_price = product.sale_price || 0;    // Из product: sale_price
  const finalDiscount = 1 - discount / 100;
  return sale_price * quantity * finalDiscount;
}

function calculateBonusByProfit(index, total, seller) {
  const max_bonus = 0.15;
  const high_bonus = 0.1;
  const low_bonus = 0.05;
  const min_bonus = 0;
  if (index === 0) return seller.profit * max_bonus;
  else if (index === 1 || index === 2) return seller.profit * high_bonus;
  else if (index === total - 1) return seller.profit * min_bonus;
  else return seller.profit * low_bonus;
}

// ---------------------- ЗАГРУЗКА ДАННЫХ ----------------------

/**
 * Загружает справочники (продавцы, клиенты, товары)
 */
async function loadCatalogs() {
  const response = await fetch(`${API_BASE}/catalogs`);
  if (!response.ok) throw new Error('Ошибка загрузки каталогов');
  return await response.json();
}

/**
 * Загружает записи с фильтрацией, поиском и пагинацией
 */
async function loadPurchaseRecords(params = {}) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE}/records?${query}`);
  if (!response.ok) throw new Error('Ошибка загрузки записей');
  return await response.json();
}

/**
 * Основная функция загрузки данных с сервера
 */
async function loadDataFromServer(params = {}) {
  const [catalogs, recordsData] = await Promise.all([
    loadCatalogs(),
    loadPurchaseRecords(params)
  ]);

  return {
    products: catalogs.products,
    sellers: catalogs.sellers,
    customers: catalogs.customers,
    purchase_records: recordsData.items,
    total: recordsData.total,
    page: recordsData.page,
    limit: recordsData.limit
  };
}

// ---------------------- АНАЛИЗ ДАННЫХ ----------------------
const SELLERS_PER_PAGE = 5;
let allSellers = [];        // ← хранит ВСЕХ продавцов
let currentPage = 1;        // ← текущая страница

function analyzeSalesData(data, options) {
  console.log('=== ОТЛАДКА ДАННЫХ ===');
  console.log('Продавцы:', data.sellers.slice(0,3));
  console.log('Покупки:', data.purchase_records.slice(0,3));

  // Ранний выход, если данные некорректны
  if (
    !data ||
    !Array.isArray(data.customers) ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.purchase_records)
  ) {
    console.error('❌ Некорректные входные данные');
    return [];
  }

  const { calculateRevenue, calculateBonus } = options;

  try {
    // --- 1. Создаём статистику продавцов ---
    const sellerStats = data.sellers.map(seller => {
      const id = parseInt(seller.id) || parseInt(seller.seller_id) || parseInt(seller.sellerId) || `seller_${seller.id || 'unknown'}`;
      return {
        id: id.toString(),  // Нормализуем к строке для индекса
        name: `${seller.first_name ?? ''} ${seller.last_name ?? ''}`.trim(),
        revenue: 0,  // Число
        profit: 0,   // Число
        sales_count: 0,
        products_sales: {},
        bonus: 0
      };
    });

    // --- 2. Создаём индексы ---
    const sellerIndex = sellerStats.reduce((acc, obj) => {
      acc[obj.id] = obj;
      // Дублируем для числовых ключей (если seller_id — число в записях)
      const numericId = parseInt(obj.id);
      if (!isNaN(numericId)) {
        acc[numericId.toString()] = obj;
      }
      return acc;
    }, {});

    const productIndex = data.products.reduce((acc, p) => {
      const sku = p.sku?.toString() || '';
      acc[sku] = {
        name: p.name || '',
        category: p.category || '',
        sku,
        purchase_price: parseFloat(p.purchase_price) || 0,  // Нормализуем к числу
        sale_price: parseFloat(p.sale_price) || 0           // Нормализуем к числу
      };
      return acc;
    }, {});

    console.log('🔍 Ключи продавцов:', Object.keys(sellerIndex).slice(0, 10));

    // --- 3. Обрабатываем покупки ---
    data.purchase_records.forEach(record => {
      // Нормализуем sellerId
      let sellerId = record.seller_id?.toString() ||
                     record.sellerId?.toString() ||
                     (record.seller?.id?.toString()) ||
                     (typeof record.seller === 'string' ? record.seller : null);

      if (!sellerId) {
        console.warn('⚠️ Нет sellerId в записи:', record);
        return;
      }

      const seller = sellerIndex[sellerId];
      if (!seller) {
        console.warn('⚠️ Не найден продавец для ID:', sellerId, '(доступные:', Object.keys(sellerIndex).slice(0,5), ')');
        return;
      }

      if (!record.items || !Array.isArray(record.items)) {
        console.warn('⚠️ Запись без items:', record);
        return;
      }

      seller.sales_count += 1;  // Увеличиваем счётчик

      // Нормализуем total_amount
      const totalAmount = parseFloat(record.total_amount) || 0;
      seller.revenue += totalAmount;

      record.items.forEach(item => {
        const sku = item.sku?.toString() || '';
        const product = productIndex[sku];
        if (!product) {
          console.warn('❌ Не найден товар по SKU:', sku, '(доступные:', Object.keys(productIndex).slice(0,5), ')');
          return;
        }

        // Нормализуем числовые поля в item
        const quantity = parseFloat(item.quantity) || 0;
        const discount = parseFloat(item.discount) || 0;

        const cost = product.purchase_price * quantity;
        const revenue = calculateRevenue({ ...item, quantity, discount }, product);  // Передаём нормализованные
        const profit = parseFloat(revenue) - parseFloat(cost);  // Явно к числу

        seller.profit += profit;

        if (!seller.products_sales[sku]) seller.products_sales[sku] = 0;
        seller.products_sales[sku] += quantity;
      });
    });

    console.log('📊 После обработки (первые 3):', sellerStats.slice(0,3).map(s => ({ name: s.name, revenue: s.revenue, profit: s.profit })));

    // --- 4. Сортировка и бонусы ---
    sellerStats.sort((a, b) => parseFloat(b.profit) - parseFloat(a.profit));

    sellerStats.forEach((seller, index) => {
      seller.bonus = calculateBonus(index, sellerStats.length, seller);
      seller.top_products = Object.entries(seller.products_sales)
        .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]))  // Нормализуем quantity
        .slice(0, 10)
        .map(([sku, quantity]) => ({ sku, quantity: parseFloat(quantity) }));
    });

    // --- 5. Итог (финальная нормализация типов) ---
    const results = sellerStats.map(seller => ({
      seller_id: seller.id,
      name: seller.name,
      revenue: parseFloat(seller.revenue) || 0,  // Финальный parseFloat
      profit: parseFloat(seller.profit) || 0,
      sales_count: seller.sales_count || 0,
      top_products: seller.top_products || [],
      bonus: parseFloat(seller.bonus) || 0
    }));

    console.log('✅ Итоговые результаты (первые 3):', results.slice(0,3));
    return results;

  } catch (err) {
    console.error('❌ Ошибка в analyzeSalesData:', err);
    console.error('Пример данных:', { sellers: data.sellers?.[0], records: data.purchase_records?.[0] });
    return [];  // Возвращаем пустой массив
  }
}

// ---------------------- ОТОБРАЖЕНИЕ ----------------------
function renderReport(results, totalSellers, page, limit) {
  const tbody = document.querySelector('#reportTable tbody');
  const summary = document.getElementById('summary');
  const pagination = document.getElementById('pagination');

  if (!tbody) return console.error('Таблица #reportTable не найдена');

  tbody.innerHTML = '';

  if (!results || results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Нет данных для отображения</td></tr>';
    if (summary) summary.textContent = '';
    if (pagination) pagination.innerHTML = '';
    return;
  }

  results.forEach(seller => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${seller.name}</td>
      <td>${seller.revenue.toFixed(2)}</td>
      <td>${seller.profit.toFixed(2)}</td>
      <td>${seller.sales_count}</td>
      <td>${seller.bonus.toFixed(2)}</td>
      <td>${seller.top_products.map(p => `${p.sku} (${p.quantity})`).join(', ')}</td>
    `;
    tbody.appendChild(tr);
  });

  if (summary) summary.textContent = `Всего продавцов: ${totalSellers} (страница ${page})`;

  // Пагинация по продавцам
  const totalPages = Math.ceil(totalSellers / limit);
  let pagHtml = `
    <button class="btn btn-secondary" onclick="changePage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
      ← Пред
    </button>
    <span style="padding:0 1em;">${page} / ${totalPages}</span>
    <button class="btn btn-secondary" onclick="changePage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
      След →
    </button>
  `;
  if (pagination) pagination.innerHTML = pagHtml;
}

function populateFilters(catalogs) {
  const sellerSelect = document.getElementById('sellerFilter');
  const skuSelect = document.getElementById('skuFilter');

  sellerSelect.innerHTML = '<option value="">Все продавцы</option>' +
    catalogs.sellers.map(s => `<option value="${s.id}">${s.first_name} ${s.last_name}</option>`).join('');

  skuSelect.innerHTML = '<option value="">Все товары</option>' +
    catalogs.products.map(p => `<option value="${p.sku}">${p.name}</option>`).join('');
}

// Глобальная функция для пагинации (для onclick)
window.changePage = function(newPage) {
  const totalPages = Math.ceil(allSellers.length / SELLERS_PER_PAGE);
  if (newPage < 1 || newPage > totalPages) return;

  currentPage = newPage;
  const paginatedSellers = getPaginatedSellers(allSellers, currentPage);
  renderReport(paginatedSellers, allSellers.length, currentPage, SELLERS_PER_PAGE);
};

// --- Пагинация ---
function getPaginatedSellers(sellers, page = 1) {
  const start = (page - 1) * SELLERS_PER_PAGE;
  const end = start + SELLERS_PER_PAGE;
  return sellers.slice(start, end);
}

async function loadAndRender(params = queryParams) {
  try {
    const data = await loadDataFromServer(params);

    // 1. Анализируем → получаем ВСЕХ продавцов
    allSellers = analyzeSalesData(data, {
      calculateRevenue: calculateSimpleRevenue,
      calculateBonus: calculateBonusByProfit
    });

    populateFilters(data);

    // 2. Сбрасываем на первую страницу при фильтрации
    currentPage = 1;

    // 3. Берём только 5 продавцов
    const paginatedSellers = getPaginatedSellers(allSellers, currentPage);

    // 4. Рендерим
    renderReport(paginatedSellers, allSellers.length, currentPage, SELLERS_PER_PAGE);

  } catch (err) {
    console.error('Ошибка:', err);
  }
}

// ---------------------- АНИМАЦИЯ БУКВ В ЗАГОЛОВКЕ ----------------------
/*function animateHeadline() {
  const h1 = document.querySelector('.h1');
  if (!h1) return;

  const text = h1.textContent.trim();
  if (!text) return;

  h1.innerHTML = '';
  const letters = text.split('');

  letters.forEach((letter, i) => {
    const span = document.createElement('span');
    span.className = 'letter';
    span.textContent = letter === ' ' ? '\u00A0' : letter;
    span.style.animationDelay = `${Math.random() * 0.6}s`;
    h1.appendChild(span);
  });

  h1.offsetHeight;
}*/
/*
// ---------------------- АНИМАЦИЯ БУКВ В ЗАГОЛОВКЕ ----------------------
function animateHeadline() {
  const h1 = document.querySelector('.h1');
  if (!h1) return;

  // Явно задаем строки
  const lines = [
    'Анализ продаж',    // первая строка
    'в реальном',       // вторая строка
    'времени'           // третья строка
  ];

  h1.innerHTML = ''; // очищаем заголовок
  let delay = 0;

  lines.forEach((line) => {
    const lineSpan = document.createElement('span');
    lineSpan.style.display = 'block'; // каждая строка на отдельной линии

    for (let i = 0; i < line.length; i++) {
      const letterSpan = document.createElement('span');
      letterSpan.className = 'letter';
      letterSpan.textContent = line[i];
      letterSpan.style.display = 'inline-block';
      letterSpan.style.animationDelay = `${delay + Math.random() * 0.3}s`;
      lineSpan.appendChild(letterSpan);

      delay += 0.05;
    }

    h1.appendChild(lineSpan);
  });

  // перерисовка для запуска анимации
  void h1.offsetHeight;
}*/

function animateHeadline() {
  const h1 = document.querySelector('.h1');
  if (!h1) return;

  const lines = [
    'Анализ продаж',    // первая строка
    'в реальном',       // вторая строка
    'времени'           // третья строка
  ];

  h1.innerHTML = ''; // очищаем заголовок
  let delay = 0;

  lines.forEach(line => {
    const lineSpan = document.createElement('span');
    lineSpan.style.display = 'block';

    for (let i = 0; i < line.length; i++) {
      const letterSpan = document.createElement('span');
      letterSpan.className = 'letter';
      // Используем неразрывный пробел для пробелов
      letterSpan.textContent = line[i] === ' ' ? '\u00A0' : line[i];
      letterSpan.style.display = 'inline-block';
      letterSpan.style.animationDelay = `${delay + Math.random() * 0.3}s`;
      lineSpan.appendChild(letterSpan);
      delay += 0.05;
    }

    h1.appendChild(lineSpan);
  });

  // перерисовка для запуска анимации
  void h1.offsetHeight;
}

// ---------------------- АНИМАЦИЯ БУКВ В ССЫЛКАХ МЕНЮ ----------------------
function animateMenuLinks() {
  const links = document.querySelectorAll('.menu a');

  links.forEach(link => {
    const text = link.textContent.trim();
    if (!text) return;

    // Сохраняем оригинальный текст
    link.dataset.originalText = text;

    // Оборачиваем каждую букву в span
    link.innerHTML = '';
    text.split('').forEach(letter => {
      const span = document.createElement('span');
      span.textContent = letter === ' ' ? '\u00A0' : letter;
      link.appendChild(span);
    });

     // Добавляем hover-анимацию
    link.addEventListener('mouseenter', () => {
      const spans = link.querySelectorAll('span');
      spans.forEach(span => {
        span.classList.remove('letter'); // сброс старой анимации
        void span.offsetWidth; // перезапуск анимации (рефлоу)
        span.classList.add('letter');
        span.style.animationDelay = `${Math.random() * 0.4}s`;
      });
    });
  });
}

// ---------------------- ОСНОВНОЙ ЗАПУСК ----------------------

/*async function main() {
  try {
    console.log('🔄 Загружаем данные с сервера...');
    const data = await loadDataFromServer(queryParams);

    console.log(`✅ Загружено ${data.purchase_records.length} записей (из ${data.total})`);
    console.log('📦 Продавцы:', data.sellers.length);
    console.log('📦 Товары:', data.products.length);

    const results = analyzeSalesData(data, {
      calculateRevenue: calculateSimpleRevenue,
      calculateBonus: calculateBonusByProfit
    });

    console.log('📊 Результаты анализа:', results);
  } catch (err) {
    console.error('❌ Ошибка при выполнении анализа:', err);
  }
}*/

// и тут ее продолжение, так как рендер вызывается отсюда
async function main() {
  try {
    console.log('🔄 Загружаем данные с сервера...');
    // Сначала анимируем заголовок
    animateHeadline();
    const filtersPanel = document.querySelector('.filters-panel');
    if (filtersPanel) {
      // Немного задержки, чтобы не конфликтовать с заголовком
      setTimeout(() => {
        filtersPanel.classList.add('animate');
      }, 600);
    }
    await loadAndRender(queryParams);  // Фикс: теперь рендерит UI
  } catch (err) {
    console.error('❌ Ошибка при выполнении анализа:', err);
  }
}

// Инициализация после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
  animateHeadline();
  animateMenuLinks();
});

// ---------------------- ОБРАБОТКА ФИЛЬТРОВ ----------------------
/* document.getElementById('applyFilters').addEventListener('click', async () => {
  queryParams.search = document.getElementById('search').value;
  queryParams.sellerId = document.getElementById('sellerFilter').value;
  queryParams.sku = document.getElementById('skuFilter').value;

  const data = await loadDataFromServer(queryParams);
  const results = analyzeSalesData(data, {
    calculateRevenue: calculateSimpleRevenue,
    calculateBonus: calculateBonusByProfit
  });
  renderReport(results);
});

main(); */

const applyBtn = document.getElementById('applyFilters');
if (applyBtn) {
  applyBtn.addEventListener('click', async () => {
    try {
      const searchEl = document.getElementById('search');
      const sellerEl = document.getElementById('sellerFilter');
      const skuEl = document.getElementById('skuFilter');

      if (searchEl) queryParams.search = searchEl.value.trim();
      if (sellerEl) queryParams.sellerId = sellerEl.value;
      if (skuEl) queryParams.sku = skuEl.value;

      // Сброс страницы при фильтрации
      currentPage = 1;
      queryParams.page = 1;  // можно оставить, если сервер использует

      // Перезагружаем и рендерим
      await loadAndRender(queryParams);
    } catch (err) {
      console.error('Ошибка фильтрации:', err);
    }
  });
} else {
  console.warn('Кнопка #applyFilters не найдена');
}

main();
