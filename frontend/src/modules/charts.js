// frontend/src/modules/charts.js

/** Универсальная функция для очистки контейнера */
function clear(element) {
    if (element) element.innerHTML = "";
}

/** Линейный график продаж по времени */
export function buildSalesOverTimeChart(ctx, data) {
    return new Chart(ctx, {
        type: "line",
        data: {
            labels: data.labels,
            datasets: [{
                label: "Продажи",
                data: data.values,
                borderWidth: 2,
                fill: false,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: true } }
        }
    });
}

/** Рейтинг продавцов */
export function buildTopSellersChart(ctx, data) {
    return new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.names,
            datasets: [{
                label: "Выручка",
                data: data.revenue,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: "y",
            plugins: { legend: { display: true } }
        }
    });
}

/** Продажи по категориям (pie chart) */
export function buildCategoryPieChart(ctx, data) {
    return new Chart(ctx, {
        type: "pie",
        data: {
            labels: data.labels,  // Fix: используем labels вместо categories
            datasets: [{
                data: data.values
            }]
        },
        options: {
            responsive: true
        }
    });
}

/**
 * Главная функция: рендер всех графиков на странице
 * stats = объект с:
 *   stats.salesOverTime = { labels[], values[] }
 *   stats.topSellers = { names[], revenue[] }
 *   stats.byCategory = { labels[], values[] }
 */
export function renderCharts(stats) {
    const chartsBlock = document.getElementById("charts");
    if (!chartsBlock) return;  // Если нет блока, не рендерим
    clear(chartsBlock);

    chartsBlock.innerHTML = `
        <div class="chart-box">
            <h3>Продажи по времени</h3>
            <canvas id="chart-sales"></canvas>
        </div>

        <div class="chart-box">
            <h3>Топ продавцов</h3>
            <canvas id="chart-top-sellers"></canvas>
        </div>

        <div class="chart-box">
            <h3>Продажи по категориям</h3>
            <canvas id="chart-categories"></canvas>
        </div>
    `;

    const ctx1 = document.getElementById("chart-sales")?.getContext("2d");
    const ctx2 = document.getElementById("chart-top-sellers")?.getContext("2d");
    const ctx3 = document.getElementById("chart-categories")?.getContext("2d");

    if (ctx1 && stats.salesOverTime) buildSalesOverTimeChart(ctx1, stats.salesOverTime);
    if (ctx2 && stats.topSellers) buildTopSellersChart(ctx2, stats.topSellers);
    if (ctx3 && stats.byCategory) buildCategoryPieChart(ctx3, stats.byCategory);
}