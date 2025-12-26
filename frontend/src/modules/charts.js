// frontend/src/modules/charts.js

/** Универсальная функция для очистки контейнера */
function clear(element) {
    if (element) element.innerHTML = "";
}

export function buildSalesOverTimeChart(ctx, data) {
    if (!data.labels || data.labels.length === 0) return null;
    return new Chart(ctx, {
        type: "line",
        data: {
            labels: data.labels,
            datasets: [{
                label: "Выручка",
                data: data.values,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
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
    if (!data.labels || data.labels.length === 0) return null;
    return new Chart(ctx, {
        type: "doughnut", // Doughnut выглядит современнее
        data: {
            labels: data.labels,
            datasets: [{
                data: data.values,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { position: 'bottom', labels: { color: '#ccc', boxWidth: 12 } } 
            }
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