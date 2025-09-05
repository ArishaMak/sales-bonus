/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара; продукция из коллекции data.products
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции, учитывая скидку
    const {discount, sale_price, quantity} = purchase; //деструктуризация объекта; скидка, цена продажи, кол-во
    const finalDiscount = 1 - (discount / 100); //коэффициент скидки, на него умножаем цену
    return sale_price * quantity * finalDiscount; //итоговая выручка
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    const max_bonus = 0.15; //для продавца, который принес максимальную прибыль
    const high_bonus = 0.1; //2-е и 3-е место
    const low_bonus = 0.05; 
    const min_bonus = 0; //последний продавец
    if (index === 0) return seller.profit * max_bonus; //продавец, который оказался на первом(нулевом) месте в массиве
    else if (index === 1 || index === 2) return seller.profit * high_bonus;
    else if (index === total - 1) return seller.profit * min_bonus;
    else return seller.profit * low_bonus;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) { //основная функция
    // @TODO: Проверка входных данных
    if (!data //проверяем, сущ ли вообще такая переменная
        || !Array.isArray(data.customers) //проверяем, является ли массивом
        || !Array.isArray(data.products)
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.purchase_records)
        || data.customers.length === 0 //проверяем, не являются лли массивы пустыми
        || data.products.length === 0
        || data.sellers.length === 0
        || data.purchase_records.length === 0) {
            throw new Error('Некорректные входные данные');
        }

    // @TODO: Проверка наличия опций: проверить, что опция - это объект и что новые переменные опрделены; проверяем не наличие данных, а их тип
    const {calculateRevenue, calculateBonus} = options; //деструктизация объекта
    
    if (typeof calculateRevenue !== "function" //typeof - оператор, который возвращает строку, указывающую на тип переменной
        || typeof calculateBonus !== "function") {
            throw new Error('Некорректные функции для расчета данных')
        }

    // @TODO: Подготовка промежуточных данных для сбора статистики
    //создаем массив объектов, который будет хранить статистику по каждому продавцу
    //data.sellers - исходный массив, который содержит данные обо всех продавцах
    //.map() - метод, который создает новый массив, применяя указанную функцию к каждому эл-ту исходного массива; не измен исходн. массив
    const sellerStats = data.sellers.map(seller => ({  //seller => - стрелочн функц, которая будет выполн для каждого эл-та seller в массиве data.sellers
        "id": seller.id, //копирует id продавца изз исходн данных
        "name": seller.first_name + " " + seller.last_name,
        "revenue": 0, //(выручка) инициализируем нулем, чтобы потом сюда можно было накапливать сумму выручки
        "profit": 0, //(прибыль)
        "sales_count": 0, //счетчик продаж
        "top_products": {}, //инициализир пустой объект
        "produts_sales": {},
        "bonus": 0
    }))

    //юзаем метод массива map(), чтобы создать новый массив объектов под названием productsStats на основе data.products
    const productsStats = data.products.map(product => ({
        "name": product.name,
        "category": product.category,
        "sku": product.sku,
        "purchase_price": product.purchase_price,
        "sale_price": product.sale_price
    }))

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = sellerStats.reduce((acc, obj) => ({
        ...acc, //переменная, которая накапливает результат в новый объект
        [obj.id]: obj //obj - элемент массива, который обрабатывается
        //в предыдущей строке код получает id текущего объекта и юзает знач в качестве ключа; obj - значение этого ключа
        //две строчки выше возвращают новый объект в каждой итерации
    }), {}
    )
    //ключ - sku, значение - запись из data.products
    const productIndex = productsStats.reduce((acc, obj) => ({
        ...acc,
        [obj.sku]: obj
    }), {}
    )

    // @TODO: Расчет выручки и прибыли для каждого продавца
    //реализация бизнес-логики
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];//продавец
        seller.sales_count++;//увеливаем кол-во продаж
        seller.revenue += record.total_amount;//увеличить общую сумму всех продаж

        //рассчет прибыли для каждого товара
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            //посчитать себестоимость товара (cost) как product.purchase_price умноженную на кол-во товаров из чека:
            const cost = product.purchase_price * item.quantity;
            //посчитать выручку (revenue) с учетом скидки через функцию calculateRevenue:
            const revenue = calculateRevenue(item, product);
            //посчить ть прибыль: выручка - себестоимость:
            const profit = revenue - cost;
            //увеличить общую накопленную прибыль (profit) у продавца:
            seller.profit += profit;
            //учет кол-ва проданных товаров (без этой проверки следующая строка вызовет ошибку):
            if (!seller.produts_sales[item.sku]) {
            seller.produts_sales[item.sku] = 0;
            }
            //по артикулу товара увеличиваем его кол-во у продавца
            seller.produts_sales[item.sku] += item.quantity;
        })
    })

    // @TODO: Сортировка продавцов по прибыли; при помощи функции sort()
    //функция возвращает отрицательное число, если sel1 должжен стоять перед sel2
    //положительное число, если sel1 должен стоять после sel2
    //0 - порядок эл-ов не важен
    sellerStats.sort((sel1, sel2) => {
        if (sel1.profit > sel2.profit) return -1;
        else if (sel1.profit < sel2.profit) return 1;
        return 0;
    })

    // @TODO: Назначение премий на основе ранжирования
    //перебираем отсортированный массив sellerStat и делаем след для каждого продавца:
    sellerStats.forEach((seller, index) => {
        //считаем бонус, используя фукц calculateBonus:
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        //записываем в поле bonus и получем знач
        //метод Object.entries() превращает объект в массив пар [ключ, знач]
        //seller.produts_sales стал из объекта массивом массивов
        seller.produts_sales = Object.entries(seller.produts_sales).map(item => item);
        //сформировать топ-10 проданных продуктов: перебрать объект в массиве, отсортировать и убрать 1-е 10 строк
        seller.produts_sales.sort((pr1, pr2) => {
            if (pr1[1] > pr2[1]) return -1;
            else if (pr1[1] < pr2[1]) return 1;
            return 0;
        })
        //slice возвращает новый массив
        seller.produts_sales = seller.produts_sales.slice(0, 10);
    })

    // @TODO: Подготовка итоговой коллекции с нужными полями
    //сформировываем результат (и возвращ его из функции), для этого применяем маппинг для массива sellerStat
    //для каждого продавца будет создаваться объект с полями
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),//округляет число до 2-х знаков после запятой, но возвращает строку
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        //каждая пара [sku, quantity] будет превращаться в объект, т е top_prod теперь массив объектов
        top_products: seller.produts_sales.map(product => ({sku: product[0], quantity: product[1]})),
        bonus: +seller.bonus.toFixed(2)
    }))
}
