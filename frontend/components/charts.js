// frontend/src/modules/charts.js
export function buildSalesOverTimeChart(canvas, data) {
    if (!canvas || !window.Chart) return;
    return new Chart(canvas, {
        type: "line",
        data: {
            labels: data.labels,
            datasets: [{
                label: "Динамика KPI",
                data: data.values,
                borderWidth: 2,
                tension: 0.3
            }]
        },
        options: { responsive: true }
    });
}

export function buildTopSellersChart(canvas, data) {
    if (!canvas || !window.Chart) return;
    return new Chart(canvas, {
        type: "bar",
        data: {
            labels: data.names,
            datasets: [{
                label: "Выручка",
                data: data.revenue,
                borderWidth: 1
            }]
        },
        options: { responsive: true }
    });
}

export function buildCategoryPieChart(canvas, data) {
    if (!canvas || !window.Chart) return;
    return new Chart(canvas, {
        type: "pie",
        data: {
            labels: data.labels,
            datasets: [{
                data: data.values
            }]
        },
        options: { responsive: true }
    });
}