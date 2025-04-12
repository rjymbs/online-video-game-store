const addToCartButtons = document.querySelectorAll('.add-to-cart');
    const cartModal = document.getElementById('cartModal');
    const cartItems = document.querySelector('.cart-items');
    const cartTotal = document.querySelector('.cart-total');
    const cartButtons = document.querySelectorAll('.cart-buttons button');
    const closeButton = document.querySelector('.close-button');
    const cartLink = document.querySelector('.callback');
    const clearCartButton = document.querySelector('.clear-cart');
    const checkoutButton = document.querySelector('.checkout');
    let cart = [];
    addToCartButtons.forEach(button => {
        button.addEventListener('click', () => {
            const item = {
                name: button.previousElementSibling.previousElementSibling.textContent,
                price: parseFloat(button.previousElementSibling.textContent.replace('р', ''))
            };
            cart.push(item);
            updateCart();
        });
    });

    function updateCart() {
        cartItems.innerHTML = '';
        let total = 0;
        cart.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.textContent = `${item.name} - ${item.price}р`;
            cartItems.appendChild(itemElement);
            total += item.price;
        });
        cartTotal.textContent = `Итого: ${total}р`;
    }

   
    clearCartButton.addEventListener('click', () => {
        cart = [];
        updateCart();
    });

    checkoutButton.addEventListener('click', () => {
        alert('Товары успешно приобретены!');
        cart = [];
        updateCart();
    });

    cartLink.addEventListener('click', () => {
        cartModal.style.display = 'block';
    });

    closeButton.addEventListener('click', () => {
        cartModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == cartModal) {
            cartModal.style.display = 'none';
        }
    });