document.addEventListener('DOMContentLoaded', function() {
  const cartItemsContainer = document.getElementById('cartItems');
  const itemsTotalElement = document.getElementById('itemsTotal');
  const discountTotalElement = document.getElementById('discountTotal');
  const cartTotalElement = document.getElementById('cartTotal');
  const checkoutButton = document.getElementById('checkoutButton');
  let cart = JSON.parse(localStorage.getItem('cart')) || [];

  // Проверяем авторизацию пользователя
  fetch('/check-session')
      .then(response => response.json())
      .then(data => {
          const accountLink = document.getElementById('accountLink');
          if (data.isLoggedIn) {
              if (data.userType === 'admin') {
                  accountLink.href = '../html/adminLK.html';
              } else {
                  accountLink.href = '../html/lk.html';
              }
          } else {
              accountLink.href = '../html/log.html';
          }
      });

  // Загружаем корзину
  loadCart();

  function loadCart() {
      if (cart.length === 0) {
          showEmptyCart();
          return;
      }

      // Получаем полную информацию о товарах в корзине
      fetch('/products')
          .then(response => response.json())
          .then(products => {
              renderCartItems(products);
              calculateTotals(products);
          })
          .catch(error => {
              console.error('Error loading products:', error);
              renderCartItems([]);
          });
  }
  function loadCartItems() {
    if (cart.length === 0) {
        showEmptyCart();
        return;
    }

    // Обогащаем данные корзины информацией из БД
    const productIds = cart.map(item => item.id);
    
    fetch(`/products-by-ids?ids=${productIds.join(',')}`)
        .then(response => response.json())
        .then(products => {
            const enrichedCart = cart.map(cartItem => {
                const product = products.find(p => p.id == cartItem.id);
                return {
                    ...cartItem,
                    ...product, // Перезаписываем данные из БД
                    image: product?.image_url || cartItem.image // Приоритет у image_url из БД
                };
            });
            renderCartItems(enrichedCart);
            calculateTotals(enrichedCart);
            
            // Обновляем localStorage с обогащенными данными
            localStorage.setItem('cart', JSON.stringify(enrichedCart));
        })
        .catch(error => {
            console.error('Error loading products:', error);
            renderCartItems(cart);
            calculateTotals(cart);
        });
}

  function renderCartItems(products) {
      cartItemsContainer.innerHTML = '';

      if (cart.length === 0) {
          showEmptyCart();
          return;
      }

      cart.forEach(item => {
          const product = products.find(p => p.id == item.id) || item;
          const cartItemElement = document.createElement('div');
          cartItemElement.className = 'cart-item';
          cartItemElement.innerHTML = `
              <img src="${product.image_url || product.image}" alt="${product.name}" class="cart-item-image">
              <div class="cart-item-details">
                  <h3 class="cart-item-title">${product.name}</h3>
                  <p class="cart-item-genre">${product.genre || 'Жанр не указан'}</p>
                  <button class="cart-item-remove" data-id="${product.id}">Удалить</button>
              </div>
              <div class="cart-item-price">${product.price} ₽</div>
          `;
          cartItemsContainer.appendChild(cartItemElement);
      });

      // Добавляем обработчики для кнопок удаления
      document.querySelectorAll('.cart-item-remove').forEach(button => {
          button.addEventListener('click', function() {
              const productId = this.getAttribute('data-id');
              removeFromCart(productId);
          });
      });
  }

  function calculateTotals(products) {
      let itemsTotal = 0;
      let discountTotal = 0;

      cart.forEach(item => {
          const product = products.find(p => p.id == item.id) || item;
          itemsTotal += parseFloat(product.price);
          
          // Если есть скидка, рассчитываем ее
          if (product.discount && product.discount > 0) {
              const discountAmount = product.price * (product.discount / 100);
              discountTotal += discountAmount;
          }
      });

      const total = itemsTotal - discountTotal;

      itemsTotalElement.textContent = `${itemsTotal.toFixed(2)} ₽`;
      discountTotalElement.textContent = `-${discountTotal.toFixed(2)} ₽`;
      cartTotalElement.textContent = `${total.toFixed(2)} ₽`;

      // Активируем кнопку оформления заказа
      checkoutButton.disabled = false;
  }

  function removeFromCart(productId) {
      cart = cart.filter(item => item.id != productId);
      localStorage.setItem('cart', JSON.stringify(cart));
      
      if (cart.length === 0) {
          showEmptyCart();
      } else {
          loadCart();
      }
  }
  function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (!existingItem) {
        // Сохраняем все необходимые данные, включая image_url
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image_url, // Используем image_url из БД
            image_url: product.image_url, // Дублируем для совместимости
            discount: product.discount || 0
        });
        localStorage.setItem('cart', JSON.stringify(cart));
        showCartNotification();
    } else {
        showCartNotification('Товар уже в корзине');
    }
}
  function showEmptyCart() {
      cartItemsContainer.innerHTML = `
          <div class="empty-cart-message">
              <p>Ваша корзина пуста</p>
              <a href="../html/sets.html" class="btn-continue-shopping">Продолжить покупки</a>
          </div>
      `;
      
      itemsTotalElement.textContent = '0 ₽';
      discountTotalElement.textContent = '0 ₽';
      cartTotalElement.textContent = '0 ₽';
      checkoutButton.disabled = true;
  }
// Обработчик кнопки "Перейти к оформлению"
document.getElementById('checkoutButton').addEventListener('click', function() {
  // Проверяем, что корзина не пуста
  if (cart.length === 0) {
      alert('Ваша корзина пуста!');
      return;
  }

  // Сохраняем корзину в localStorage
  localStorage.setItem('cart', JSON.stringify(cart));
  
  // Переходим на страницу оформления заказа
  window.location.href = 'checkout.html';
});
  // Обработчик кнопки оформления заказа
  checkoutButton.addEventListener('click', function() {
    if (cart.length === 0) return;

    fetch('/checkout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(cart)
    })
    .then(async response => {
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Ошибка оформления заказа');
        }
        return response.text(); // Сначала получаем текст
    })
    .then(text => {
        try {
            // Пытаемся распарсить JSON, если это возможно
            return text ? JSON.parse(text) : {};
        } catch {
            // Если не JSON, возвращаем текст как сообщение
            return { success: true, message: text };
        }
    })
    .then(data => {
        if (data.success || data.message === 'Orders saved successfully') {
            cart = [];
            localStorage.setItem('cart', JSON.stringify(cart));
            showEmptyCart();
            window.location.href = '../html/order-success.html';
        } else {
            alert(data.message || 'Ошибка оформления заказа');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ошибка оформления заказа: ' + error.message);
    });
  });
});