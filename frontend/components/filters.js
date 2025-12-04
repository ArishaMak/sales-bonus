export function initFilters(sellers, purchases) {
    const container = document.getElementById("filters");

    container.innerHTML = `
        <h2>Фильтры</h2>
        <select id="seller-filter">
            <option value="">Все продавцы</option>
            ${sellers
                .map(
                    s =>
                        `<option value="${s.seller_id}">${s.first_name} ${s.last_name}</option>`
                )
                .join("")}
        </select>
    `;

    document.getElementById("seller-filter").addEventListener("change", e => {
        const id = e.target.value;

        if (!id) {
            console.log("Показать всех");
        } else {
            console.log("Фильтр:", id);
        }
    });
}
