import { getCatalogs, getRecords, updateSellerStats } from "./modules/api.js";
import { renderCharts } from "./modules/charts.js";
import { openSellerModal } from "./modules/sellerModal.js";

/* ================== Настройки ================== */
const SELLERS_PER_PAGE = 8;
let queryParams = { page: 1, limit: 9999, search: "", sellerId: "", sku: "" };

let allSellers = [];
let currentPage = 1;

/* ========== Утилиты ========== */
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeNum(v, digits = 2) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "0.00";
}

/* ========== Бизнес: расчёты ========== */
function calculateSimpleRevenue(item, product) {
  const quantity = Number(item.quantity || 0);
  const discount = Number(item.discount || 0);
  const sale_price = Number(product?.sale_price || 0);
  return sale_price * quantity * (1 - discount / 100);
}

function calculateBonusByProfit(index, total, seller) {
  if (index === 0) return (seller.profit || 0) * 0.15;
  if (index === 1 || index === 2) return (seller.profit || 0) * 0.1;
  if (index === total - 1) return 0;
  return (seller.profit || 0) * 0.05;
}

/* ========== Аналитика: собираем статистику продавцов ========== */
function analyzeSalesData(data, options = {}) {
  const { calculateRevenue = calculateSimpleRevenue, calculateBonus = calculateBonusByProfit } = options;

  const sellersMap = {};
  (data.sellers || []).forEach(s => {
    const id = String(s.seller_id ?? s.sellerId ?? s.id ?? "").trim();
    if (!id) return;
    sellersMap[id] = {
      id,
      name: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || id,
      revenue: 0,
      profit: 0,
      sales_count: 0,
      products_sales: {},
      department: s.department || "-",
      updated_at: s.updated_at || s.updatedAt || null,
      plan: Number(s.plan_revenue || 10000)
    };
  });

  const productIndex = Object.fromEntries((data.products || []).map(p => [String(p.sku), {
    sku: String(p.sku),
    name: p.name,
    purchase_price: Number(p.purchase_price) || 0,
    sale_price: Number(p.sale_price) || 0
  }]));

  (data.purchase_records || []).forEach(rec => {
    const rawId = String(rec.seller_id ?? rec.sellerId ?? "").trim();
    const seller = sellersMap[rawId];
    if (!seller) return;

    seller.sales_count += 1;
    seller.revenue += Number(rec.total_amount) || 0;

    (rec.items || []).forEach(item => {
      const sku = String(item.sku ?? "");
      const product = productIndex[sku];
      if (!product) return;

      const rev = calculateRevenue(item, product);
      const cost = (Number(product.purchase_price) || 0) * (Number(item.quantity) || 0);
      const profit = (Number(rev) || 0) - cost;

      seller.revenue += Number(rev) || 0;
      seller.profit += profit || 0;
      seller.products_sales[sku] = (seller.products_sales[sku] || 0) + (Number(item.quantity) || 0);
    });
  });

  const arr = Object.values(sellersMap);
  arr.sort((a, b) => (b.profit || 0) - (a.profit || 0));
  arr.forEach((s, idx, all) => {
    s.bonus = calculateBonus(idx, all.length, s);
    s.top_products = Object.entries(s.products_sales || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sku, qty]) => ({ sku, quantity: qty }));
  });

  return arr.map(s => ({
    seller_id: s.id,
    name: s.name,
    revenue: Number(s.revenue || 0),
    profit: Number(s.profit || 0),
    sales_count: s.sales_count || 0,
    top_products: s.top_products || [],
    bonus: Number(s.bonus || 0),
    department: s.department,
    updated_at: s.updated_at,
    plan: s.plan
  }));
}

/* ========== Топ-товары (локальный расчёт) ========== */
function calculateTopProducts(data) {
  const productMap = {};

  // Инициализируем все продукты
  (data.products || []).forEach(p => {
    const sku = String(p.sku).trim();
    if (!sku) return;
    productMap[sku] = {
      sku,
      name: p.name || "Неизвестно",
      revenue: 0,
      quantity: 0,
      sellers: new Set()  // соберём уникальных продавцов
    };
  });

  // Проходим по всем записям продаж
  (data.purchase_records || []).forEach(rec => {
    const sellerName = rec.seller_name?.trim() || "—";

    (rec.items || []).forEach(item => {
      const sku = String(item.sku ?? "").trim();
      if (!productMap[sku]) return;

      const qty = Number(item.quantity || 0);
      const price = Number(item.price || item.sale_price || 0);
      const discount = Number(item.discount || 0);
      const rev = price * qty * (1 - discount / 100);

      productMap[sku].revenue += rev;
      productMap[sku].quantity += qty;
      if (sellerName !== "—") productMap[sku].sellers.add(sellerName);
    });
  });

  // Формируем массив, сортируем по выручке, берём топ-20
  return Object.values(productMap)
    .filter(p => p.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)
    .map(p => ({
      id_artikul: p.sku,
      name: p.name,
      sellers: Array.from(p.sellers).join(", ") || "—",
      revenue: Math.round(p.revenue),
      total_qty: p.quantity
    }));
}

/* ========== Загрузка данных с backend ========== */
async function loadData() {
  try {
    const fetchDashboard = fetch('/api/dashboard').then(async r => {
      if (!r.ok) {
        console.error('Dashboard fetch failed:', r.status, await r.text());
        return { total_revenue: 0, top_sellers: [], categories: [], months: [] };
      }
      return r.json();
    }).catch(e => {
      console.error('Dashboard network error:', e);
      return { total_revenue: 0, top_sellers: [], categories: [], months: [] };
    });

    const [catalogs, recordsResp, dashboardResp] = await Promise.all([
      getCatalogs(),
      getRecords(queryParams),
      fetchDashboard
    ]);

    return {
      products: catalogs.products || [],
      sellers: catalogs.sellers || [],
      customers: catalogs.customers || [],
      purchase_records: (recordsResp && recordsResp.items) || [],
      totalRecords: (recordsResp && recordsResp.total) || 0,
      dashboard: dashboardResp
    };
  } catch (err) {
    console.error('loadData error:', err);
    // Fallback empty data
    return {
      products: [], sellers: [], customers: [], purchase_records: [], totalRecords: 0, dashboard: {}
    };
  }
}

/**
 * Рендерит секцию топ-товаров.
 */
function renderTopProductsSection(topProds = []) {
  let section = document.getElementById("topProductsSection");

  if (!section) {
    section = document.createElement("div");
    section.id = "topProductsSection";
    section.className = "top-products-section mt-8";
    const reportTable = document.getElementById("reportTable");
    if (reportTable && reportTable.parentNode) {
      reportTable.parentNode.insertBefore(section, reportTable.nextSibling);
    } else {
      document.body.appendChild(section);
    }
  }

  let tbody = section.querySelector("tbody");

  if (!tbody) {
    section.innerHTML = `
      <h3>Топ-товары по выручке</h3>
      <div class="table-container">
        <table class="table table-striped table-hover">
         <thead>
           <tr>
             <th>Артикул</th>
             <th>Название</th>
             <th>Продавец</th>
             <th>Выручка</th>
             <th>Кол-во</th>
           </tr>
         </thead>
         <tbody></tbody>
        </table>
      </div>
    `;
    tbody = section.querySelector("tbody");
  }

  if (!tbody) {
    console.error("❌ tbody still not found in TopProducts");
    return;
  }

  if (!Array.isArray(topProds) || topProds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Нет данных</td></tr>`;
    console.warn("⚠ renderTopProductsSection: No data to render.");
    return;
  }

  tbody.innerHTML = topProds.map(p => `
    <tr>
      <td>${escapeHtml(p.id_artikul || "")}</td>
      <td>${escapeHtml(p.name || "")}</td>
      <td>${escapeHtml(p.sellers || "—")}</td>
      <td>${Number(p.revenue || 0).toLocaleString("ru-RU")} ₽</td>
      <td>${p.total_qty || 0}</td>
    </tr>
  `).join("");

  console.log("✅ TopProducts rendered:", topProds.length);
}

/* ========== Рендеры UI ========== */
function populateFilters(catalogs) {
  const sellerFilter = document.getElementById("sellerFilter");
  const skuFilter = document.getElementById("skuFilter");
  if (!sellerFilter || !skuFilter) return;

  sellerFilter.innerHTML = '<option value="">Все продавцы</option>' +
    (catalogs.sellers || []).map(s => `<option value="${escapeHtml(s.seller_id)}">${escapeHtml(s.first_name ?? "")} ${escapeHtml(s.last_name ?? "")}</option>`).join("");

  skuFilter.innerHTML = '<option value="">Все товары</option>' +
    (catalogs.products || []).map(p => `<option value="${escapeHtml(p.sku)}">${escapeHtml(p.name)}</option>`).join("");

  const dlId = "searchList";
  let dl = document.getElementById(dlId);
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = dlId;
    document.body.appendChild(dl);
  }
  const options = new Set();
  (catalogs.sellers || []).forEach(s => options.add(`${s.first_name ?? ""} ${s.last_name ?? ""}`.trim()));
  (catalogs.customers || []).forEach(c => options.add(`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()));
  dl.innerHTML = Array.from(options).map(t => `<option value="${escapeHtml(t)}">`).join("");
  const searchInput = document.getElementById("search");
  if (searchInput) searchInput.setAttribute("list", dlId);
}

function renderSummary(totalSellers) {
  const summary = document.getElementById("summary");
  if (!summary) return;
  summary.innerHTML = `<div class="summary-card">Всего продавцов: ${totalSellers}</div>`;
}

function renderTable(pageData, total, page, limit) {
  const tbody = document.querySelector("#reportTable tbody");
  const pagination = document.getElementById("pagination");
  if (!tbody || !pagination) return;

  tbody.innerHTML = "";
  pageData.forEach(s => {
    const kpi = s.plan ? ((s.revenue / s.plan) * 100).toFixed(0) : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(s.name)}</td>
      <td>${safeNum(s.revenue)}</td>
      <td>${safeNum(s.profit)}</td>
      <td>${escapeHtml(String(s.sales_count))}</td>
      <td>${kpi}%</td>
      <td>${safeNum(s.bonus)}</td>
      <td>${(s.top_products || []).map(p => `${escapeHtml(p.sku)} (${p.quantity})`).join(", ")}</td>
      <td><button class="btn btn-secondary open-seller" data-id="${escapeHtml(s.seller_id)}" data-name="${escapeHtml(s.name)}">Открыть</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".open-seller").forEach(btn => {
    btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const name = e.currentTarget.dataset.name || id;
        // Находим полный объект продавца из allSellers
        const seller = allSellers.find(s => String(s.seller_id) === String(id));
        if (seller) {
            openSellerModal(seller);  // Передаём весь объект
        } else {
            // Fallback (редко)
            openSellerModal({ seller_id: id, name });
        }
    });
});

  const pages = Math.max(1, Math.ceil(total / limit));
  pagination.innerHTML = `
    <button class="btn btn-secondary" id="prevPage" ${page <= 1 ? "disabled" : ""}>← Пред</button>
    <span style="padding: 0 1em;">${page}/${pages}</span>
    <button class="btn btn-secondary" id="nextPage" ${page >= pages ? "disabled" : ""}>След →</button>
  `;
  document.getElementById("prevPage")?.addEventListener("click", () => changePage(page - 1));
  document.getElementById("nextPage")?.addEventListener("click", () => changePage(page + 1));
}

/* ========== Pagination ========== */
function changePage(newPage) {
  if (newPage < 1) return;
  currentPage = newPage;
  const start = (currentPage - 1) * SELLERS_PER_PAGE;
  const pageData = allSellers.slice(start, start + SELLERS_PER_PAGE);
  renderTable(pageData, allSellers.length, currentPage, SELLERS_PER_PAGE);
}

/* ========== Сортировка по поиску (новая функция) ========== */
function sortBySearch(sellers, search = '') {
  if (!search.trim()) return sellers; // Нет поиска — оригинальная

  const normalizedSearch = search.toLowerCase().trim();
  return sellers.sort((a, b) => {
    const aMatch = a.name.toLowerCase().includes(normalizedSearch);
    const bMatch = b.name.toLowerCase().includes(normalizedSearch);

    // Найденные — первыми (группа 0), остальные — вторыми (группа 1)
    const aGroup = aMatch ? 0 : 1;
    const bGroup = bMatch ? 0 : 1;
    if (aGroup !== bGroup) return aGroup - bGroup;

    // Внутри группы — по profit DESC
    return (b.profit || 0) - (a.profit || 0);
  });
}

/* ========== Загрузка, анализ и рендер (основной поток) ========== */
async function loadAndRender() {
  try {
    const data = await loadData();

    // Анализ продавцов
    allSellers = analyzeSalesData(data, {
      calculateRevenue: calculateSimpleRevenue,
      calculateBonus: calculateBonusByProfit
    });

    // Сортировка по поиску
    allSellers = sortBySearch(allSellers, queryParams.search);

    // ==== ЛОГИ ДЛЯ ОТЛАДКИ (теперь внутри try и с правильными переменными) ====
    console.log("🔍 Sellers from catalogs:", data.sellers?.length || 0);
    console.log("🔍 All sellers after analyze:", allSellers.length);

    // Отправляем агрегаты на сервер
    const payload = {
      period_id: new Date().toISOString().slice(0, 7),
      stats: allSellers.map(s => ({
        seller_id: s.seller_id,
        total_quantity: s.sales_count,
        total_profit: s.profit,
        total_revenue: s.revenue,
        bonus: s.bonus
      }))
    };
    updateSellerStats(payload).catch(e => console.warn("updateSellerStats failed:", e));

    // Рендер чартов
    const dashboard = data.dashboard;
    const stats = {
      salesOverTime: {
        labels: dashboard.months?.map(m => m.month) || [],
        values: dashboard.months?.map(m => m.revenue) || []
      },
      topSellers: {
        names: dashboard.top_sellers?.map(s => `${s.first_name} ${s.last_name}`) || [],
        revenue: dashboard.top_sellers?.map(s => s.total_revenue) || []
      },
      byCategory: {
        labels: dashboard.categories?.map(c => c.category) || [],
        values: dashboard.categories?.map(c => c.category_revenue) || []
      }
    };
    try {
      renderCharts(stats);
      console.log('✅ Charts rendered');
    } catch (e) {
      console.warn('⚠ Charts failed:', e);
    }

    // Топ-товары — локально (один вызов!)
    const topProds = calculateTopProducts(data);
    console.log("📦 Calculated top-products (local):", topProds);
    renderTopProductsSection(topProds);

    // Финальный рендер UI
    populateFilters({ sellers: data.sellers, products: data.products, customers: data.customers });
    
    const firstPage = allSellers.slice(0, SELLERS_PER_PAGE);
    currentPage = 1;
    renderSummary(allSellers.length);
    renderTable(firstPage, allSellers.length, 1, SELLERS_PER_PAGE);
    
    console.log('✅ loadAndRender complete');
  } catch (err) {
    console.error("loadAndRender error:", err);
    const tbody = document.querySelector("#reportTable tbody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="color: red;">Ошибка загрузки данных: ${escapeHtml(err.message)}</td></tr>`;
    }
    // Дополнительно покажем в топ-товарах
    renderTopProductsSection([]);
  }
}

/* ========== UI: фильтры, handlers ========== */
function setupUiHandlers() {
  const applyBtn = document.getElementById("applyFilters");
  const resetBtn = document.getElementById("resetFilters");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      queryParams.search = (document.getElementById("search")?.value || "").trim();
      queryParams.sellerId = (document.getElementById("sellerFilter")?.value || "");
      queryParams.sku = (document.getElementById("skuFilter")?.value || "");
      console.log('🔄 Applying filters:', queryParams);
      loadAndRender();
    });
  } else {
    console.warn('⚠ #applyFilters not found');
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const searchInput = document.getElementById("search");
      const sellerFilter = document.getElementById("sellerFilter");
      const skuFilter = document.getElementById("skuFilter");
      if (searchInput) searchInput.value = "";
      if (sellerFilter) sellerFilter.value = "";
      if (skuFilter) skuFilter.value = "";
      queryParams = { page: 1, limit: 9999, search: "", sellerId: "", sku: "" };
      console.log('🔄 Reset filters');
      loadAndRender();
    });
  } else {
    console.warn('⚠ #resetFilters not found');
  }
}

/* ========== Анимации UI ========== */
function animateHeadline() {
  const h1 = document.querySelector('.h1');
  if (!h1) {
    console.warn('⚠ .h1 not found for animation');
    return;
  }
  const lines = ['Анализ продаж', 'в реальном', 'времени'];
  h1.innerHTML = '';
  let delay = 0;
  lines.forEach(line => {
    const l = document.createElement('span');
    l.style.display = 'block';
    [...line].forEach(char => {
      const s = document.createElement('span');
      s.className = 'letter';
      s.textContent = char === ' ' ? '\u00A0' : char;
      s.style.animationDelay = `${delay + Math.random() * 0.3}s`;
      delay += 0.05;
      l.appendChild(s);
    });
    h1.appendChild(l);
  });
  console.log('✅ Headline animated');
}

function animateMenuLinks() {
  const links = document.querySelectorAll('.menu a');
  if (links.length === 0) {
    console.warn('⚠ .menu a not found for animation');
    return;
  }
  links.forEach(link => {
    const text = link.textContent.trim();
    if (!text) return;
    link.innerHTML = '';
    [...text].forEach(letter => {
      const span = document.createElement('span');
      span.textContent = letter === ' ' ? '\u00A0' : letter;
      link.appendChild(span);
    });
    link.addEventListener('mouseenter', () => {
      link.querySelectorAll('span').forEach(span => {
        span.classList.remove('letter');
        void span.offsetWidth;
        span.classList.add('letter');
        span.style.animationDelay = `${Math.random() * 0.4}s`;
      });
    });
  });
  console.log('✅ Menu links animated:', links.length);
}

/* ========== Управление видимостью кнопки "Дашборд" ========== */
function toggleDashboardButton() {
  const dashboardBtn = document.getElementById("dashboardBtn");
  if (!dashboardBtn) {
    console.warn('⚠ #dashboardBtn not found');
    return;
  }

  const userId = localStorage.getItem("userId");
  if (userId) {
    dashboardBtn.style.display = "inline"; // Показать, если авторизован
    console.log('✅ Dashboard button shown (user logged in)');
  } else {
    dashboardBtn.style.display = "none"; // Скрыть, если не авторизован
    console.log('❌ Dashboard button hidden (user not logged in)');
  }
}

/* ========== Обработчик клика "Дашборд" ========== */
function setupDashboardButton() {
  const dashboardBtn = document.getElementById("dashboardBtn");
  if (!dashboardBtn) return;

  dashboardBtn.addEventListener("click", () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Сначала войдите в аккаунт");
      // Открыть модалку логина (если функция доступна)
      if (typeof openModal === 'function') {
        openModal('loginModal');
      }
      return;
    }
    window.location.href = "/dashboard.html";
  });
}

/* ========== Listener на изменения localStorage (для динамики после logout) ========== */
window.addEventListener('storage', (e) => {
  if (e.key === 'userId') {
    toggleDashboardButton(); // Перепроверить видимость при изменении
  }
});

/* ========== INIT ========= */
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded, starting init');
  animateHeadline();
  animateMenuLinks();
  setupUiHandlers();
  setupDashboardButton(); // Настройка клика
  toggleDashboardButton(); // Проверка видимости при загрузке
  loadAndRender();
});

// Экспорт для dashboard.js (reuse)
export { loadData, analyzeSalesData, renderTopProductsSection, safeNum, escapeHtml };