import { buildSalesOverTimeChart, buildCategoryPieChart } from "./charts.js";

const modalEl = document.getElementById("sellerCardModal");
const contentEl = document.getElementById("sellerCardContent");

let charts = [];

// КЭШ для KPI данных (sellerId -> kpiData)
const kpiCache = {};

function formatCurrency(n) {
    return (Number(n) || 0).toLocaleString("ru-RU") + " ₽";
}

export async function openSellerModal(seller) {
    const sellerId = seller.seller_id || seller.id;
    if (!sellerId) return;

    if (modalEl) modalEl.style.display = 'flex';
    contentEl.innerHTML = `<div style="padding:40px; color:white; text-align:center;">Загрузка аналитики...</div>`;

    try {
        let kpiData;

        // Проверяем кэш
        if (kpiCache[sellerId]) {
            console.log('📥 KPI данные из кэша для seller_id', sellerId);
            kpiData = kpiCache[sellerId];
        } else {
            // Загружаем с сервера
            const response = await fetch(`/api/kpi/${sellerId}`);
            if (!response.ok) throw new Error('Ошибка сети');
            kpiData = await response.json();
            kpiCache[sellerId] = kpiData;  // Сохраняем в кэш
            console.log('🌐 KPI данные загружены с сервера для seller_id', sellerId, kpiData);
        }

        // ФИКС KPI (default plan = 50000)
        const plan = Number(seller.plan_revenue || seller.plan || 50000);
        const kpiPercent = seller.kpi ?? (plan > 0 ? Math.round((seller.revenue / plan) * 100) : 0);


        const avgCheck = seller.sales_count > 0 ? (seller.revenue / seller.sales_count) : 0;
        const avgProfit = seller.sales_count > 0 ? (seller.profit / seller.sales_count) : 0;

        // HTML модалки (без изменений)
        contentEl.innerHTML = `
            <div style="margin-bottom: 25px;">
                <h2 style="font-size: 2.5em; font-weight: 800; font-style: italic; margin: 0; color: white;">${seller.name || "Продавец"}</h2>
                <div style="color: #888; font-size: 1.1em; margin-top: 10px; font-weight: bold;">ID: ${sellerId}</div>
                <div style="color: #888; font-size: 1.1em; font-weight: bold;">Последнее обновление: ${new Date().toLocaleDateString("ru-RU")}, ${new Date().toLocaleTimeString("ru-RU")}</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 30px;">
                <div style="background: #0f0f12; padding: 20px; border-radius: 8px;">
                    <div style="color: #efeff1; font-size: 0.9em; margin-bottom: 8px; font-weight: 500;">Средний чек</div>
                    <div style="font-size: 1.6em; font-weight: 900; font-style: italic; color: white;">${avgCheck > 0 ? formatCurrency(avgCheck) : '—'}</div>
                </div>
                <div style="background: #0f0f12; padding: 20px; border-radius: 8px;">
                    <div style="color: #efeff1; font-size: 0.9em; margin-bottom: 8px; font-weight: 500;">Средняя прибыль</div>
                    <div style="font-size: 1.6em; font-weight: 900; font-style: italic; color: white;">${avgProfit > 0 ? formatCurrency(avgProfit) : '—'}</div>
                </div>
                <div style="background: #0f0f12; padding: 20px; border-radius: 8px;">
                    <div style="color: #efeff1; font-size: 0.9em; margin-bottom: 8px; font-weight: 500;">Выручка</div>
                    <div style="font-size: 1.6em; font-weight: 900; font-style: italic; color: white;">${formatCurrency(seller.revenue)}</div>
                </div>
                <div style="background: #0f0f12; padding: 20px; border-radius: 8px;">
                    <div style="color: #efeff1; font-size: 0.9em; margin-bottom: 8px; font-weight: 500;">Прибыль</div>
                    <div style="font-size: 1.6em; font-weight: 900; font-style: italic; color: ${seller.profit < 0 ? '#ff4d4d' : 'white'};">
                        ${formatCurrency(seller.profit)}
                    </div>
                </div>
                <div style="background: #0f0f12; padding: 20px; border-radius: 8px;">
                    <div style="color: #efeff1; font-size: 0.9em; margin-bottom: 8px; font-weight: 500;">Продаж</div>
                    <div style="font-size: 1.6em; font-weight: 900; font-style: italic; color: white;">${seller.sales_count || 0}</div>
                </div>
                <div style="background: #0f0f12; padding: 20px; border-radius: 8px;">
                    <div style="color: #efeff1; font-size: 0.9em; margin-bottom: 8px; font-weight: 500;">Бонус</div>
                    <div style="font-size: 1.6em; font-weight: 900; font-style: italic; color: white;">${formatCurrency(seller.bonus)}</div>
                </div>
                <div style="background: #0f0f12; padding: 20px; border-radius: 8px;">
                    <div style="color: #efeff1; font-size: 0.9em; margin-bottom: 8px; font-weight: 500;">KPI</div>
                    <div style="font-size: 1.6em; font-weight: 900; font-style: italic; color: white;">${kpiPercent}%</div>
                </div>
            </div>

            <hr style="border: 0; border-top: 1px solid #333; margin: 30px 0;">

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                <div>
                    <h4 style="color: white; font-size: 1.4em; margin-bottom: 15px; font-weight: 800; font-style: italic;">Динамика выручки</h4>
                    <div style="height: 300px; background: #0f0f12; border-radius: 8px; padding: 15px;">
                        <canvas id="chart-sales-over-time"></canvas>
                    </div>
                </div>
                <div>
                    <h4 style="color: white; font-size: 1.4em; margin-bottom: 15px; font-weight: 800; font-style: italic;">Категории товаров</h4>
                    <div style="height: 300px; background: #0f0f12; border-radius: 8px; padding: 15px;">
                        <canvas id="chart-cat-pie"></canvas>
                    </div>
                </div>
            </div>

            <div style="margin-top: 30px;">
                <h4 style="color: white; font-size: 1.4em; margin-bottom: 15px; font-weight: 800; font-style: italic;">Топ товаров (по количеству)</h4>
                <table style="width: 100%; border-collapse: collapse; background: #0f0f12; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="text-align: left; background: #1a1a20;">
                            <th style="padding: 12px; color: white; font-weight: 900; font-style: italic; border-bottom: 1px solid #333;">SKU</th>
                            <th style="padding: 12px; color: white; font-weight: 900; font-style: italic; border-bottom: 1px solid #333;">Кол-во</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(seller.top_products || []).map(tp => `
                            <tr>
                                <td style="padding: 12px; color: #ccc; border-bottom: 1px solid #222; font-weight: bold;">${tp.sku}</td>
                                <td style="padding: 12px; color: #ccc; border-bottom: 1px solid #222; font-weight: bold;">${tp.quantity}</td>
                            </tr>
                        `).join("") || '<tr><td colspan="2" style="padding: 20px; color: #888; text-align: center;">Нет данных</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div style="text-align: right; margin-top: 30px;">
                <button id="modalCloseBtn" class="btn btn-secondary" style="padding: 12px 30px; font-weight: bold;">Закрыть</button>
            </div>
        `;

        document.getElementById("modalCloseBtn")?.addEventListener("click", closeSellerModal);

        const canvas1 = document.getElementById("chart-sales-over-time");
        const canvas2 = document.getElementById("chart-cat-pie");

        // Графики (с логами для отладки)
        if (canvas1) {
            console.log('Динамика данные:', kpiData.salesOverTime);
            if (kpiData.salesOverTime && kpiData.salesOverTime.length > 0) {
                const c1 = buildSalesOverTimeChart(canvas1, kpiData.salesOverTime);
                if (c1) charts.push(c1);
            } else {
                canvas1.parentElement.innerHTML += '<div style="color:#888; text-align:center; margin-top:80px;">Нет данных для динамики</div>';
            }
        }

        if (canvas2) {
            console.log('Категории данные:', kpiData.categoryBreakdown);
            if (kpiData.categoryBreakdown && kpiData.categoryBreakdown.length > 0) {
                const c2 = buildCategoryPieChart(canvas2, kpiData.categoryBreakdown);
                if (c2) charts.push(c2);
            } else {
                canvas2.parentElement.innerHTML += '<div style="color:#888; text-align:center; margin-top:80px;">Нет данных по категориям</div>';
            }
        }

    } catch (e) {
        console.error("Ошибка модалки:", e);
        contentEl.innerHTML = `<div style="color:red; text-align:center; padding:20px;">Ошибка загрузки данных: ${e.message}</div>`;
    }
}

export function closeSellerModal() {
    charts.forEach(c => { try { c.destroy(); } catch {} });
    charts = [];
    if (modalEl) modalEl.style.display = 'none';
    if (contentEl) contentEl.innerHTML = "";
}