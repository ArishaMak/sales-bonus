// frontend/src/modules/dashboard.js
import { getProfileData, saveProfileData } from '../api.js'; // Из api.js
import { DashboardView } from '../../components/DashboardView.js'; // Форма (существующая)
import { loadData, analyzeSalesData, renderTopProductsSection, safeNum, escapeHtml } from '../main.js'; // Reuse из main.js

/**
 * Инициализирует личный кабинет.
 * @param {number} userId - ID пользователя.
 * @param {HTMLElement} profileRoot - Для формы профиля.
 * @param {HTMLElement} summaryRoot - Для сводки/таблицы.
 */
export async function initDashboard(userId, profileRoot, summaryRoot) {
    if (!userId) {
        profileRoot.innerHTML = '<p class="text-red-500 text-center mt-10">⚠️ Для доступа к кабинету авторизуйтесь.</p>';
        return;
    }

    try {
        // 1. Загрузка профиля
        const userData = await getProfileData(userId);
        userData.id = userId;

        // 2. Рендер формы профиля (существующая DashboardView)
        profileRoot.innerHTML = DashboardView(userData);

        // Установка имени в хедер
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = `Ваш профиль: ${userData.name || userData.email}`;

        // 3. Настройка формы сохранения
        const form = document.getElementById('seller-profile-form');
        if (form) {
            form.addEventListener('submit', (e) => handleFormSubmit(e, form, userId));
        }

        // 4. Загрузка и расчёт персональной статистики (reuse из main.js)
        await renderPersonalStats(userId, summaryRoot);

    } catch (error) {
        console.error("Dashboard init error:", error);
        profileRoot.innerHTML = `<p class="text-red-500 text-center mt-10">Не удалось загрузить данные: ${error.message}</p>`;
    }
}

/**
 * Обрабатывает сохранение профиля.
 */
async function handleFormSubmit(e, form, userId) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-profile-btn');
    const statusElement = document.getElementById('profile-status');
    
    saveBtn.disabled = true;
    statusElement.textContent = 'Сохранение...';
    statusElement.className = 'mt-3 text-center text-blue-500';
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.bonus = parseInt(data.bonus) || 0;
    data.userId = userId;
    
    try {
        const result = await saveProfileData(data);
        statusElement.textContent = result.message;
        statusElement.className = 'mt-3 text-center text-green-500';
        
        // Перезагрузка для обновления расчётов
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error("Save profile error:", error);
        statusElement.textContent = `Ошибка: ${error.message}`;
        statusElement.className = 'mt-3 text-center text-red-500';
    } finally {
        saveBtn.disabled = false;
    }
}

/**
 * Рендерит персональную статистику (сводка + таблица + топ-товары).
 * @param {number} userId - ID пользователя (seller_id).
 * @param {HTMLElement} summaryRoot - Root для сводки/таблицы.
 */
async function renderPersonalStats(userId, summaryRoot) {
    try {
        // Загрузка данных (reuse loadData из main.js)
        const data = await loadData();
        
        // Фильтр: только записи/продукты для этого seller_id
        const userData = data.sellers.find(s => s.seller_id == userId) || {};
        const userRecords = data.purchase_records.filter(r => r.seller_id == userId);
        const filteredData = {
            ...data,
            sellers: [userData], // Только пользователь
            purchase_records: userRecords
        };

        // Расчёт статистики (reuse analyzeSalesData)
        const personalSellers = analyzeSalesData(filteredData);
        const personalSeller = personalSellers[0] || { // 1 строка
            seller_id: userId,
            name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Ваш профиль',
            revenue: 0,
            profit: 0,
            sales_count: 0,
            bonus: userData.bonus || 0,
            department: userData.department || '-',
            top_products: []
        };

        // Рендер сводки
        const summary = document.getElementById("personalSummary");
        if (summary) {
            summary.innerHTML = `
                <div class="card">Продаж: <span id="personalSalesCount">${personalSeller.sales_count}</span></div>
                <div class="card">Выручка: <span id="personalRevenue">${Number(personalSeller.revenue).toLocaleString()} ₽</span></div>
                <div class="card">Прибыль: <span id="personalProfit">${Number(personalSeller.profit).toLocaleString()} ₽</span></div>
            `;
        }

        // Рендер таблицы (reuse renderTable, но для 1 страницы/строки)
        const tableBody = document.getElementById('personalSellerTableBody');
        if (tableBody) {
            const kpi = personalSeller.plan ? ((personalSeller.revenue / personalSeller.plan) * 100).toFixed(0) : 0;
            tableBody.innerHTML = `
                <tr>
                    <td>${escapeHtml(personalSeller.name)}</td>
                    <td>${safeNum(personalSeller.revenue)}</td>
                    <td>${safeNum(personalSeller.profit)}</td>
                    <td>${personalSeller.sales_count}</td>
                    <td>${kpi}%</td>
                    <td>${safeNum(personalSeller.bonus)}</td>
                    <td>${(personalSeller.top_products || []).slice(0, 3).map(p => `${escapeHtml(p.sku)} (${p.quantity})`).join(", ") || 'Нет'}</td>
                    <td><button class="btn btn-secondary" disabled>Открыть</button></td> <!-- Нет действий для себя -->
                </tr>
            `;
        }

        // Топ-товары пользователя (reuse renderTopProductsSection, но фильтр по sku из top_products)
        const userTopProds = (data.products || []).filter(p => 
            personalSeller.top_products.some(tp => tp.sku === p.sku)
        ).map(p => ({
            id_artikul: p.sku,
            name: p.name,
            revenue: personalSeller.top_products.find(tp => tp.sku === p.sku)?.quantity * Number(p.sale_price || 0) || 0,
            total_qty: personalSeller.top_products.find(tp => tp.sku === p.sku)?.quantity || 0,
            sellers: 'Вы'
        }));
        renderTopProductsSection(userTopProds);

        console.log('✅ Personal stats rendered for user', userId);
    } catch (error) {
        console.error('Personal stats error:', error);
        summaryRoot.innerHTML = '<p class="text-red-500 text-center">Ошибка загрузки статистики.</p>';
    }
}