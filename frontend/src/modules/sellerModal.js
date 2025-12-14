// frontend/src/modules/sellerModal.js
import { buildSalesOverTimeChart, buildCategoryPieChart } from "./charts.js";

const modalEl = document.getElementById("sellerCardModal");
const contentEl = document.getElementById("sellerCardContent");

let charts = [];

function formatCurrency(n) {
    return (Number(n) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}

function clearModal() {
    contentEl.innerHTML = "";
    modalEl.classList.remove("open");
    charts.forEach(c => { try { c.destroy(); } catch {} });
    charts = [];
}

// Теперь модалка работает ТОЛЬКО на локальных данных из главной таблицы (allSellers)
// Данные всегда 100% совпадают с главной таблицей
// Нет запроса на backend — быстрее и без ошибок
export function openSellerModal(seller) {
    // seller — это объект из allSellers (с полями revenue, profit, bonus, top_products и т.д.)
    if (!seller || typeof seller !== "object") {
        contentEl.innerHTML = `
            <div style="padding: 30px; text-align: center; color: red; font-size: 1.2em;">
                <strong>Ошибка: данные продавца не найдены</strong><br><br>
                Обновите страницу и попробуйте снова.
            </div>
        `;
        modalEl.classList.add("open");
        return;
    }

    clearModal();
    modalEl.classList.add("open");

    // Локальный расчёт KPI % (как в главной таблице)
    const kpiPercent = seller.plan ? Math.round((seller.revenue / seller.plan) * 100) : 0;

    // Для чартов — простые заглушки (поскольку полные данные по дням/категориям на фронтенде нет)
    // Если нужно — можно расширить позже
    const salesOverTime = { labels: [], values: [] };
    const categoryBreakdown = { labels: [], values: [] };

    const html = `
      <div class="seller-header">
        <h2 class="seller-name">${seller.name || "Продавец"}</h2>
        <div class="seller-meta">ID: ${seller.seller_id || "—"}</div>
        <div class="seller-meta">Последнее обновление: ${new Date().toLocaleString("ru-RU")}</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-item"><div class="kpi-label">Средний чек</div><div class="kpi-value">—</div></div>
        <div class="kpi-item"><div class="kpi-label">Средняя прибыль</div><div class="kpi-value">—</div></div>
        <div class="kpi-item"><div class="kpi-label">Выручка</div><div class="kpi-value">${formatCurrency(seller.revenue)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Прибыль</div><div class="kpi-value">${formatCurrency(seller.profit)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Продаж</div><div class="kpi-value">${seller.sales_count || 0}</div></div>
        <div class="kpi-item"><div class="kpi-label">Бонус</div><div class="kpi-value">${formatCurrency(seller.bonus)}</div></div>
        <div class="kpi-item"><div class="kpi-label">KPI</div><div class="kpi-value">${kpiPercent}%</div></div>
      </div>

      <hr/>

      <div class="charts-row">
        <div class="chart-card">
          <h4>Динамика выручки</h4>
          <canvas id="chart-sales-over-time"></canvas>
          <p style="text-align:center; color: #888; margin-top:10px;">Данные недоступны в модалке</p>
        </div>
        <div class="chart-card">
          <h4>Распределение по категориям</h4>
          <canvas id="chart-cat-pie"></canvas>
          <p style="text-align:center; color: #888; margin-top:10px;">Данные недоступны в модалке</p>
        </div>
      </div>

      <div class="top-products">
        <h4>Топ товаров (по количеству)</h4>
        <table class="small-table">
          <thead><tr><th>SKU</th><th>Кол-во</th></tr></thead>
          <tbody>
            ${(seller.top_products || []).map(tp => `
              <tr>
                <td>${tp.sku}</td>
                <td>${tp.quantity}</td>
              </tr>`).join("") || '<tr><td colspan="2">Нет данных</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="sales-rows">
        <h4>Последние продажи</h4>
        <p style="text-align:center; color: #888;">Данные недоступны в модалке (доступны только в общей аналитике)</p>
      </div>

      <div style="text-align:right; margin-top:20px;">
        <button id="modalCloseBtn" class="btn btn-secondary">Закрыть</button>
      </div>
    `;

    contentEl.innerHTML = html;

    document.getElementById("modalCloseBtn")?.addEventListener("click", closeSellerModal);

    // Пустые чарты (заглушки)
    const canvas1 = document.getElementById("chart-sales-over-time");
    const canvas2 = document.getElementById("chart-cat-pie");

    if (canvas1) {
        try {
            const c1 = buildSalesOverTimeChart(canvas1, salesOverTime);
            if (c1) charts.push(c1);
        } catch (e) { console.warn(e); }
    }

    if (canvas2) {
        try {
            const c2 = buildCategoryPieChart(canvas2, categoryBreakdown);
            if (c2) charts.push(c2);
        } catch (e) { console.warn(e); }
    }

    console.log("Модалка открыта с локальными данными продавца:", seller.name);
}

export function closeSellerModal() {
    modalEl.classList.remove("open");
    clearModal();
}