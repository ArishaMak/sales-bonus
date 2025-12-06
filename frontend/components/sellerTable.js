export function renderSellerTable(sellers) {
    const container = document.getElementById("seller-table");

    const rows = sellers
        .map(
            s => `
                <tr>
                    <td>${s.first_name} ${s.last_name}</td>
                    <td>${s.department}</td>
                    <td>${s.total_sales || 0}</td>
                    <td>${s.total_bonus || 0}</td>
                </tr>
            `
        )
        .join("");

    container.innerHTML = `
        <h2>Таблица продавцов</h2>
        <table class="seller-table">
            <thead>
                <tr>
                    <th>Имя</th>
                    <th>Отдел</th>
                    <th>Продажи</th>
                    <th>Бонус</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}