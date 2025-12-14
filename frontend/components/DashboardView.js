// frontend/components/DashboardView.js

/**
 * Генерирует HTML-разметку для страницы Личного Кабинета.
 * @param {object} userData - Данные пользователя/продавца, включая статус активации.
 * @returns {string} HTML-разметка страницы.
 */
export function DashboardView(userData) {
    const { 
        id, // Добавим id для скрытого поля формы
        email, 
        name, 
        first_name, 
        last_name, 
        department, 
        bonus,
        total_revenue,
        total_profit
    } = userData;

    // Проверка, активен ли профиль продавца (достаточно проверить основные поля)
    const isProfileActive = first_name && department && first_name.length > 0 && department.length > 0;
    const activationMessage = isProfileActive 
        ? '✅ Ваш профиль продавца активен и участвует в общем рейтинге.' 
        : '⚠️ Для участия в рейтинге заполните данные ниже и нажмите "Активировать".';

    // Возвращаем HTML-строку для рендеринга
    return `
        <div class="p-6 bg-white shadow-lg rounded-lg max-w-4xl mx-auto mt-10">
            <h2 class="text-3xl font-bold mb-6 text-gray-800">
                Личный Кабинет: ${name}
            </h2>
            <p class="text-sm text-gray-500 mb-6">Email: ${email}</p>
            
            <div class="p-4 mb-6 ${isProfileActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} border-l-4 border-${isProfileActive ? 'green' : 'yellow'}-500">
                ${activationMessage}
            </div>

            <form id="seller-profile-form">
                <input type="hidden" name="userId" value="${id}">

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label for="first_name" class="block text-sm font-medium text-gray-700">Имя</label>
                        <input type="text" id="first_name" name="first_name" 
                               class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" 
                               value="${first_name || ''}" required>
                    </div>
                    <div>
                        <label for="last_name" class="block text-sm font-medium text-gray-700">Фамилия</label>
                        <input type="text" id="last_name" name="last_name" 
                               class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" 
                               value="${last_name || ''}" required>
                    </div>
                    <div>
                        <label for="department" class="block text-sm font-medium text-gray-700">Отдел</label>
                        <input type="text" id="department" name="department" 
                               class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" 
                               value="${department || ''}" required>
                    </div>
                    <div>
                        <label for="bonus" class="block text-sm font-medium text-gray-700">Бонус (%)</label>
                        <input type="number" id="bonus" name="bonus" 
                               class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" 
                               value="${bonus || 0}" min="0" max="100">
                    </div>
                </div>

                <div class="mt-6">
                    <button type="submit" id="save-profile-btn" class="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        ${isProfileActive ? 'Сохранить Изменения' : 'Активировать Профиль Продавца'}
                    </button>
                    <p id="profile-status" class="mt-3 text-center text-sm"></p>
                </div>

                ${isProfileActive ? `
                    <div class="mt-8 pt-6 border-t border-gray-200">
                        <h3 class="text-xl font-semibold mb-4">Ваша Статистика</h3>
                        <p class="mb-1">Общая Выручка: <strong>${Number(total_revenue || 0).toLocaleString()} ₽</strong></p>
                        <p>Общая Прибыль: <strong>${Number(total_profit || 0).toLocaleString()} ₽</strong></p>
                    </div>
                ` : ''}

            </form>
        </div>
    `;
}