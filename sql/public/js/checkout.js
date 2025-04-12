document.addEventListener('DOMContentLoaded', function() {
    const orderForm = document.getElementById('orderForm');
    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    // Проверяем, что корзина не пуста
    if (cart.length === 0) {
        alert('Ваша корзина пуста! Перенаправляем в корзину...');
        window.location.href = 'cart.html';
        return;
    }

    // Заполняем список товаров
    renderOrderItems(cart);

    // Обработчик отправки формы
    orderForm.addEventListener('submit', function(e) {
        e.preventDefault();
        processOrder(cart);
    });
});

function renderOrderItems(cartItems) {
    const orderItemsContainer = document.getElementById('orderItems');
    let subtotal = 0;

    orderItemsContainer.innerHTML = '';
    
    cartItems.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'order-item';
        itemElement.innerHTML = `
            <img src="${item.image_url || item.image}" alt="${item.name}" class="order-item-image">
            <div class="order-item-details">
                <div class="order-item-title">${item.name}</div>
                ${item.discount > 0 ? 
                  `<div class="original-price">${(item.price / (1 - item.discount/100)).toFixed(2)} ₽</div>
                   <div class="discounted-price">${item.price} ₽ (${item.discount}% скидка)</div>` :
                  `<div class="order-item-price">${item.price} ₽</div>`}
            </div>
        `;
        orderItemsContainer.appendChild(itemElement);
        
        subtotal += parseFloat(item.price);
    });

    document.getElementById('orderSubtotal').textContent = `${subtotal.toFixed(2)} ₽`;
    document.getElementById('orderTotal').textContent = `${subtotal.toFixed(2)} ₽`;
}

function processOrder(cartItems) {
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const email = document.getElementById('email').value;
    const total = parseFloat(document.getElementById('orderTotal').textContent);

    // Показываем индикатор загрузки
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Оформляем...';

    // Подготовка данных заказа
    const orderData = {
        products: cartItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.image_url || item.image
        })),
        paymentMethod,
        email,
        total
    };

    // Отправка заказа на сервер
    fetch('/checkout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw err; });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // 1. Очищаем корзину
            localStorage.removeItem('cart');
            
            // 2. Перенаправляем на страницу успеха
            const orderId = data.orderId || data.orderIds?.[0] || 'unknown';
            window.location.href = `../html/order-success.html?orderId=${orderId}`;
        } else {
            throw new Error(data.message || 'Ошибка оформления заказа');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert(error.message || 'Произошла ошибка при оформлении заказа');
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Оформить заказ';
    });
}