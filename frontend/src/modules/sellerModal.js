// frontend/src/modules/sellerModal.js
import { buildSalesOverTimeChart, buildCategoryPieChart } from "./charts.js";  // Убрал buildTopSellersChart, т.к. не используется
import { getSellerKPI } from "./api.js";  // Добавлен импорт

const modalEl = document.getElementById("sellerCardModal");
const contentEl = document.getElementById("sellerCardContent");

let charts = [];

function formatCurrency(n) {
    return (Number(n) || 0).toLocaleString("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 });
}

function clearModal() {
    contentEl.innerHTML = "";
    // destroy charts if exist
    charts.forEach(c => {
        try { c.destroy(); } catch (e) {}
    });
    charts = [];
}

// Новая функция для получения полной информации о продавце
export async function getSellerFull(sellerId) {
    const response = await fetch(`/api/seller-full?seller_id=${sellerId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch seller data for ID ${sellerId}`);
    }
    const data = await response.json();
    // Наш бэкенд возвращает полный объект, который нам нужен
    return data;
}

export async function openSellerModal(sellerId, sellerDisplayName = null) {  // Добавлен async
    clearModal();
    // Loading placeholder
    contentEl.innerHTML = `<div class="modal-loading">Загрузка...</div>`;
    modalEl.classList.add("open");

    try {
        // Замена прямого fetch на API-функцию
        const data = await getSellerKPI(sellerId);
        renderModal(data, sellerDisplayName || sellerId);
    } catch (err) {
        console.error(err);
        contentEl.innerHTML = `<div class="modal-error">Ошибка загрузки данных: ${err.message}</div>`;
    }
}

export function closeSellerModal() {
    modalEl.classList.remove("open");
    clearModal();
}

function renderModal(data, sellerDisplayName) {
    clearModal();

    const html = `
      <div class="seller-header">
        <h2 class="seller-name">${sellerDisplayName}</h2>
        <div class="seller-meta">ID: ${data.seller}</div>
        <div class="seller-meta">Последнее обновление: ${new Date().toLocaleString()}</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-item"><div class="kpi-label">Средний чек</div><div class="kpi-value">${formatCurrency(data.avgCheck)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Средняя прибыль</div><div class="kpi-value">${formatCurrency(data.avgProfit)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Выручка</div><div class="kpi-value">${formatCurrency(data.revenue)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Прибыль</div><div class="kpi-value">${formatCurrency(data.profit)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Продаж</div><div class="kpi-value">${data.salesCount}</div></div>
        <div class="kpi-item"><div class="kpi-label">Бонус</div><div class="kpi-value">${formatCurrency(data.bonus)}</div></div>
        <div class="kpi-item"><div class="kpi-label">KPI</div><div class="kpi-value">${data.kpi || 0}%</div></div>
      </div>

      <hr/>

      <div class="charts-row">
        <div class="chart-card">
          <h4>Динамика выручки</h4>
          <canvas id="chart-sales-over-time"></canvas>
        </div>
        <div class="chart-card">
          <h4>Распределение по категориям</h4>
          <canvas id="chart-cat-pie"></canvas>
        </div>
      </div>

      <div class="top-products">
        <h4>Топ товаров</h4>
        <table class="small-table">
          <thead><tr><th>SKU</th><th>Название</th><th>Кол-во</th><th>Выручка</th><th>Прибыль</th></tr></thead>
          <tbody>
            ${data.topProducts?.map(tp => `
              <tr>
                <td>${tp.sku}</td>
                <td>${tp.name || tp.sku}</td>
                <td>${tp.totalQuantity}</td>
                <td>${formatCurrency(tp.totalRevenue)}</td>
                <td>${formatCurrency(tp.totalProfit)}</td>
              </tr>`).join("") || '<tr><td colspan="5">Нет данных</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="sales-rows">
        <h4>Последние продажи (по операциям)</h4>
        <table class="wide-table">
          <thead><tr><th>purchase_id</th><th>Дата</th><th>Выручка</th><th>Прибыль</th></tr></thead>
          <tbody>
            ${(data.salesRows || []).slice(-20).reverse().map(r => `
              <tr>
                <td>${r.purchase_id}</td>
                <td>${r.day}</td>
                <td>${formatCurrency(r.revenue)}</td>
                <td>${formatCurrency(r.profit)}</td>
              </tr>`).join("") || '<tr><td colspan="4">Нет данных</td></tr>'}
          </tbody>
        </table>
      </div>

      <div style="text-align:right; margin-top:10px;">
        <button id="modalCloseBtn" class="btn btn-secondary">Закрыть</button>
      </div>
    `;

    contentEl.innerHTML = html;

    document.getElementById("modalCloseBtn").addEventListener("click", closeSellerModal);

    // Build charts
    const canvas1 = document.getElementById("chart-sales-over-time");
    const canvas2 = document.getElementById("chart-cat-pie");

    try {
      const c1 = buildSalesOverTimeChart(canvas1, {
          labels: data.salesOverTime?.labels || [],
          values: data.salesOverTime?.values || []
      });
      if (c1) charts.push(c1);
    } catch (e) { console.warn(e); }

    try {
      const c2 = buildCategoryPieChart(canvas2, {
          labels: data.categoryBreakdown?.labels || [],
          values: data.categoryBreakdown?.values || []
      });
      if (c2) charts.push(c2);
    } catch (e) { console.warn(e); }
}