document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
        window.location.href = '../html/sets.html';
        return;
    }
    
    let currentUser = null;
    let productData = null;
    let allReviews = [];
    let showingAllReviews = false;
    let selectedRating = 0;

    // Проверяем авторизацию пользователя
    checkAuth().then(() => {
        loadProductData(productId);
        setupEventHandlers();
    });

    async function checkAuth() {
        try {
            const response = await fetch('/check-session');
            const data = await response.json();
            if (data.isLoggedIn) {
                currentUser = {
                    id: data.userId,
                    name: data.userName,
                    type: data.userType
                };
                // Показываем блок добавления отзыва
                document.getElementById('addReviewSection').style.display = 'block';
            }
        } catch (error) {
            console.error('Error checking auth:', error);
        }
    }

    async function loadProductData(productId) {
        try {
            const response = await fetch(`/product?id=${productId}`);
            if (!response.ok) {
                throw new Error('Товар не найден');
            }
            
            productData = await response.json();
            displayProduct(productData);
            loadReviews(productId);
        } catch (error) {
            console.error('Ошибка загрузки товара:', error);
            alert('Не удалось загрузить информацию о товаре');
            window.location.href = '../html/sets.html';
        }
    }

    function displayProduct(product) {
        document.getElementById('productTitle').textContent = product.name;
        document.getElementById('productId').textContent = `ID: ${product.id}`;
        document.getElementById('productPrice').textContent = `${product.price} ₽`;
        
        // Старая цена и скидка
        if (product.discount && product.discount > 0) {
            const oldPrice = Math.round(product.price / (1 - product.discount / 100));
            document.getElementById('productOldPrice').textContent = `${oldPrice} ₽`;
            document.getElementById('productDiscount').textContent = `-${product.discount}%`;
        } else {
            document.getElementById('productOldPrice').style.display = 'none';
            document.getElementById('productDiscount').style.display = 'none';
        }
        
        // Рейтинг
        const ratingElement = document.getElementById('productRating');
        if (product.average_rating > 0) {
            ratingElement.innerHTML = `★ ${product.average_rating.toFixed(1)} <span class="rating-count">(${product.reviews_count} отзывов)</span>`;
        } else {
            ratingElement.innerHTML = 'Нет отзывов';
        }
        
        // Описание и характеристики
        document.getElementById('productDescription').textContent = product.description || 'Описание отсутствует';
        document.getElementById('productGenre').textContent = product.genres?.join(', ') || 'Не указано';
        
        // Изображения
        const mainImage = document.getElementById('productMainImage');
        const thumbnailsContainer = document.getElementById('productThumbnails');
        
        if (product.image_url) {
            mainImage.src = product.image_url;
            mainImage.alt = product.name;
            
            // Создаем миниатюру из основного изображения, если нет дополнительных
            if (!product.images || product.images.length === 0) {
                const thumbnail = createThumbnail(product.image_url, 0);
                thumbnailsContainer.appendChild(thumbnail);
            }
        } else {
            mainImage.src = '../images/no-image.jpg';
        }
        
        // Дополнительные изображения
        if (product.images && product.images.length > 0) {
            product.images.forEach((img, index) => {
                const thumbnail = createThumbnail(img, index);
                thumbnailsContainer.appendChild(thumbnail);
                if (index === 0) thumbnail.classList.add('active');
            });
        }
    }

    function createThumbnail(imgSrc, index) {
        const thumbnail = document.createElement('img');
        thumbnail.src = imgSrc;
        thumbnail.alt = `${productData.name} - изображение ${index + 1}`;
        thumbnail.addEventListener('click', () => {
            document.getElementById('productMainImage').src = imgSrc;
            document.querySelectorAll('#productThumbnails img').forEach(t => t.classList.remove('active'));
            thumbnail.classList.add('active');
        });
        return thumbnail;
    }

    async function loadReviews(productId, showAll = false) {
        try {
            const response = await fetch(`/reviews/${productId}`);
            allReviews = await response.json();
            
            const reviewsList = document.getElementById('reviewsList');
            reviewsList.innerHTML = '';
            
            if (allReviews.length === 0) {
                reviewsList.innerHTML = '<p>Пока нет отзывов об этом товаре. Будьте первым!</p>';
                document.getElementById('reviewsCount').textContent = '(0)';
                return;
            }
            
            document.getElementById('reviewsCount').textContent = `(${allReviews.length})`;
            
            const reviewsToShow = showAll ? allReviews : allReviews.slice(0, 3);
            
            reviewsToShow.forEach(review => {
                const reviewElement = document.createElement('div');
                reviewElement.className = 'review-item';
                reviewElement.innerHTML = `
                    <div class="review-header">
                        <span class="review-author">${review.user_name || 'Анонимный пользователь'}</span>
                        <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
                        <span class="review-date">${new Date(review.date).toLocaleDateString()}</span>
                    </div>
                    <div class="review-text">${review.comment}</div>
                `;
                reviewsList.appendChild(reviewElement);
            });
            
            // Показываем/скрываем кнопку "Показать все"
            document.getElementById('showAllReviews').style.display = 
                (showAll || allReviews.length <= 3) ? 'none' : 'block';
                
            showingAllReviews = showAll;
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
            document.getElementById('reviewsList').innerHTML = 
                '<p>Не удалось загрузить отзывы. Попробуйте позже.</p>';
        }
    }

    function setupEventHandlers() {
        // Кнопка "Показать все отзывы"
        document.getElementById('showAllReviews').addEventListener('click', () => {
            loadReviews(productId, true);
        });
        
        // Кнопка "Добавить в корзину"
        document.getElementById('addToCart').addEventListener('click', addToCart);
        
        // Кнопка "В избранное"
        document.getElementById('addToWishlist').addEventListener('click', addToWishlist);
        
        // Звезды рейтинга
        document.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', function() {
                selectedRating = parseInt(this.getAttribute('data-value'));
                updateStars();
            });
            
            star.addEventListener('mouseover', function() {
                const hoverRating = parseInt(this.getAttribute('data-value'));
                highlightStars(hoverRating);
            });
            
            star.addEventListener('mouseout', () => {
                if (selectedRating > 0) {
                    highlightStars(selectedRating);
                } else {
                    document.querySelectorAll('.star').forEach(s => s.style.color = '#ccc');
                }
            });
        });
        
        // Кнопка отправки отзыва
        document.getElementById('submitReview').addEventListener('click', submitReview);
    }

    function updateStars() {
        document.querySelectorAll('.star').forEach(star => {
            const value = parseInt(star.getAttribute('data-value'));
            star.style.color = value <= selectedRating ? '#ffc107' : '#ccc';
        });
    }

    function highlightStars(rating) {
        document.querySelectorAll('.star').forEach(star => {
            const value = parseInt(star.getAttribute('data-value'));
            star.style.color = value <= rating ? '#ffc107' : '#ccc';
        });
    }

    async function addToCart() {
        if (!currentUser) {
            alert('Для добавления товаров в корзину необходимо авторизоваться');
            window.location.href = '../html/log.html';
            return;
        }
        
        try {
            const response = await fetch('/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([{
                    id: productData.id,
                    name: productData.name,
                    price: productData.price,
                    image_url: productData.image_url
                }])
            });
            
            if (response.ok) {
                alert('Товар добавлен в корзину!');
            } else {
                const errorData = await response.json();
                alert('Ошибка: ' + (errorData.message || 'Не удалось добавить товар в корзину'));
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Не удалось добавить товар в корзину');
        }
    }

    async function addToWishlist() {
        if (!currentUser) {
            alert('Для добавления товаров в избранное необходимо авторизоваться');
            window.location.href = '../html/log.html';
            return;
        }
        
        try {
            const response = await fetch('/add-to-wishlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ product_id: productData.id })
            });
            
            if (response.ok) {
                alert('Товар добавлен в избранное!');
            } else {
                const errorData = await response.json();
                alert('Ошибка: ' + (errorData.message || 'Не удалось добавить товар в избранное'));
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Не удалось добавить товар в избранное');
        }
    }

    async function submitReview() {
        if (!currentUser) {
            alert('Для добавления отзывов необходимо авторизоваться');
            return;
        }
        
        if (selectedRating === 0) {
            alert('Пожалуйста, выберите оценку');
            return;
        }
        
        const reviewText = document.getElementById('reviewText').value.trim();
        if (!reviewText) {
            alert('Пожалуйста, напишите отзыв');
            return;
        }
        
        const showName = document.getElementById('showName').checked;
        
        try {
            const response = await fetch('/submit-review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    product_id: productData.id,
                    rating: selectedRating,
                    comment: reviewText,
                    show_name: showName
                })
            });
            
            if (response.ok) {
                alert('Ваш отзыв успешно добавлен!');
                document.getElementById('reviewText').value = '';
                selectedRating = 0;
                updateStars();
                loadReviews(productData.id, showingAllReviews);
            } else {
                const errorData = await response.json();
                alert('Ошибка: ' + (errorData.message || 'Не удалось добавить отзыв'));
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Не удалось добавить отзыв');
        }
    }
});