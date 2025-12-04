// frontend/src/modules/sellerCard.js
import { API_BASE } from "./api.js";

export async function loadSellerFullInfo(seller_id) {
    const r = await fetch(`${API_BASE}/seller-full?seller_id=${seller_id}`);
    if (!r.ok) throw new Error("Seller full info failed");
    return r.json();
}

export async function openSellerCard(seller_id) {
    const modal = document.getElementById("sellerCardModal");
    const content = document.getElementById("sellerCardContent");

    content.innerHTML = `<div class="loader">Загрузка...</div>`;
    modal.style.display = "block";

    try {
        const s = await loadSellerFullInfo(seller_id);

        content.innerHTML = `
            <div class="seller-card">
                <h2>Карточка продавца</h2>

                <div class="seller-main">
                    <p><strong>ID:</strong> ${s.seller_id}</p>
                    <p><strong>Имя:</strong> ${s.name}</p>
                    <p><strong>Отдел:</strong> ${s.department || "—"}</p>
                </div>

                <div class="seller-stats">
                    <h3>Показатели</h3>
                    <p><strong>Выручка:</strong> ${Number(s.total_revenue).toLocaleString("ru-RU")} ₽</p>
                    <p><strong>Прибыль:</strong> ${Number(s.total_profit).toLocaleString("ru-RU")} ₽</p>
                    <p><strong>Бонус:</strong> ${Number(s.bonus).toLocaleString("ru-RU")} ₽</p>
                    <p><strong>Средний чек:</strong> ${s.average_check.toFixed(2)} ₽</p>
                    <p><strong>Средняя прибыль:</strong> ${s.average_profit.toFixed(2)} ₽</p>
                </div>

                <button id="closeSellerCard" class="btn btn-secondary" style="margin-top: 1em;">
                    Закрыть
                </button>
            </div>
        `;

        document.getElementById("closeSellerCard").onclick = () => {
            modal.style.display = "none";
        };

        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = "none";
        };

    } catch (err) {
        content.innerHTML = `<p class="error">Ошибка загрузки карточки продавца</p>`;
    }
}
