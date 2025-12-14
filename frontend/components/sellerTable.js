export function renderSellerTable(sellers) {
    const container = document.getElementById("seller-table");

    // Функция для форматирования списка товаров
    const formatTopProducts = (products) => {
        if (!products || products.length === 0) return '—';
        // Предполагаем, что s.top_products - это строка или массив, который нужно отформатировать.
        // Если это строка (как на скриншоте), просто вернем ее.
        // В реальном проекте здесь был бы сложный парсинг и форматирование.
        return products;
    };

    // Функция для создания кнопки "Открыть"
    const createActionButton = (sellerId) => {
        // Мы используем data-атрибут для привязки ID к кнопке.
        // Обработчик события должен быть добавлен в main.js или render.js
        return `<button class="btn btn-view-seller" data-seller-id="${sellerId}">Открыть</button>`;
    };

    const rows = sellers
        .map(
            s => `
                <tr>
    <td class="table-cell column-seller">${s.name}</td> // 1. Имя
    <td class="table-cell">${Number(s.total_revenue || 0).toLocaleString('ru-RU')}</td> // 2. Выручка
    <td class="table-cell">${Number(s.total_profit || 0).toLocaleString('ru-RU')}</td>  // 3. Прибыль
    <td class="table-cell">${Number(s.total_quantity || 0)}</td> // 4. Продаж (Ваше "total_sales")
    <td class="table-cell">${s.kpi || 0}%</td> // 5. KPI
    <td class="table-cell">${Number(s.bonus || 0).toLocaleString('ru-RU')}</td> // 6. Бонус
    <td class="table-cell column-products">${formatTopProducts(s.top_products)}</td> // 7. Топ-товары
    <td class="table-cell column-actions">${createActionButton(s.seller_id)}</td> // 8. Действия
</tr>
            `
        )
        .join("");

    container.innerHTML = `
        <h2>Таблица продавцов</h2>
        <div class="seller-stats-table-container">
            <table class="seller-stats-table wide-table">
                <thead>
                    <tr>
                        <th class="table-header column-seller">Продавец</th>
                        <th class="table-header">Выручка</th>
                        <th class="table-header">Прибыль</th>
                        <th class="table-header">Продаж</th>
                        <th class="table-header">KPI</th>
                        <th class="table-header">Бонус</th>
                        <th class="table-header column-products">Топ-товары</th>
                        <th class="table-header column-actions">Действия</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
    
    // ПРИМЕЧАНИЕ: Добавьте здесь или в main.js логику для открытия модалки
    // document.querySelectorAll('.btn-view-seller').forEach(button => {
    //     button.onclick = () => openSellerCard(button.dataset.sellerId);
    // });
}