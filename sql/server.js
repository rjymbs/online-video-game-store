const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'store',
    password: '1',
    port: 5432,
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: '1', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
// основная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html', 'index.html'));
});

// Регистрация пользователя
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).send('Все поля обязательны для заполнения.');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        // Устанавливаем user_type по умолчанию на 'user'
        await pool.query('INSERT INTO users (name, email, password, user_type) VALUES ($1, $2, $3, $4)', [name, email, hashedPassword, 'user']);
        res.redirect('/html/log.html');
    } catch (error) {
        console.error('Ошибка записи в БД:', error);
        res.status(500).send('Ошибка при регистрации.');
    }
});

// Вход в аккаунт
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length > 0) {
        const match = await bcrypt.compare(password, user.rows[0].password);
        if (match) {
            req.session.userId = user.rows[0].id;
            req.session.userType = user.rows[0].user_type; 
            req.session.userName = user.rows[0].name;
            res.redirect('/html/index.html');
        } else {
            res.send('Неверные данные');
        }
    } else {
        res.send('Пользователь не найден');
    }
});

app.post('/users/:id/assign-admin', async (req, res) => {
    const userId = req.params.id;
    try {
        await pool.query('UPDATE users SET user_type = $1 WHERE id = $2', ['admin', userId]);
        res.send('Пользователь назначен администратором');
    } catch (error) {
        console.error('Ошибка при назначении администратора:', error);
        res.status(500).send('Ошибка при назначении администратора');
    }
});
// Проверка сессии
// app.get('/check-session', (req, res) => {
//     const isLoggedIn = req.session.userId !== undefined;
//     res.json({ isLoggedIn });
// });
app.get('/check-session', (req, res) => {
    if (req.session.userId) {
        const userType = req.session.userType;
        const userName = req.session.userName; 
        res.json({ isLoggedIn: true, userType, userName });
    } else {
        res.json({ isLoggedIn: false });
    }
});
// Заказ
app.post('/order', async (req, res) => {
    const { productName, productPrice } = req.body;
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).send('Unauthorized');
    }
    try {
        await pool.query('INSERT INTO orders (user_id, product_name, product_price) VALUES ($1, $2, $3)', [userId, productName, productPrice]);
        res.send('Order placed successfully');
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).send('Error placing order');
    }
});

// Изменение данных пользователя
app.post('/update-user', async (req, res) => {
    const { name, email, password } = req.body;
    const userId = req.session.userId;

    console.log('User ID:', userId);  

    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    const updates = [];
    const values = [];

    if (name) {
        updates.push(`name = $${updates.length + 1}`);
        values.push(name);
    }
    if (email) {
        updates.push(`email = $${updates.length + 1}`);
        values.push(email);
    }
    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push(`password = $${updates.length + 1}`);
        values.push(hashedPassword);
    }

    if (updates.length > 0) {
        try {
            const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${updates.length + 1}`;
            values.push(userId); 
            console.log('Query:', query);  
            console.log('Values:', values); 
            await pool.query(query, values);
            res.send('User details updated');
        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).send('Error updating user');
        } 
    } else {
        res.send('No fields to update');
    }
});

app.get('/products', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id, p.name, p.price, p.image_url, p.discount,
                   COALESCE(AVG(r.rating), 0) AS average_rating,
                   ARRAY_AGG(g.name) AS genres 
            FROM products p 
            LEFT JOIN product_genres pg ON p.id = pg.product_id
            LEFT JOIN genres g ON pg.genre_id = g.id
            LEFT JOIN reviews r ON p.id = r.product_id
            GROUP BY p.id
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Error fetching products');
    }
});

// Получение детальной информации о товаре
app.get('/product', async (req, res) => {
    const productId = req.query.id;
    
    try {
        // Получаем основную информацию о товаре
        const productQuery = await pool.query(`
            SELECT p.*, 
                   COALESCE(AVG(r.rating), 0) AS average_rating,
                   COUNT(r.id) AS reviews_count
            FROM products p
            LEFT JOIN reviews r ON p.id = r.product_id
            WHERE p.id = $1
            GROUP BY p.id
        `, [productId]);
        
        if (productQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = productQuery.rows[0];
        
        // Получаем дополнительные изображения
        const imagesQuery = await pool.query(
            'SELECT image_url FROM product_images WHERE product_id = $1',
            [productId]
        );
        
        // Получаем жанры товара
        const genresQuery = await pool.query(`
            SELECT g.name FROM genres g
            JOIN product_genres pg ON g.id = pg.genre_id
            WHERE pg.product_id = $1
        `, [productId]);
        
        res.json({
            ...product,
            images: imagesQuery.rows.map(img => img.image_url),
            genres: genresQuery.rows.map(g => g.name),
            reviews_count: parseInt(product.reviews_count),
            average_rating: parseFloat(product.average_rating)
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Database error' });
    }
});
// app.post('/checkout', async (req, res) => {
//     const userId = req.session.userId;
//     const orders = req.body;

//     if (!Array.isArray(orders) || orders.length === 0) {
//         return res.status(400).send('Invalid order data');
//     }

//     if (!userId) {
//         return res.status(401).send('Unauthorized');
//     }

//     try {
//         const user = await pool.query('SELECT balance, bonus_points FROM users WHERE id = $1', [userId]);
//         const userBalance = user.rows[0].balance;

//         // Логирование данных
//         console.log('User balance:', userBalance);
//         console.log('Orders:', orders);

//         let total = orders.reduce((sum, order) => sum + parseFloat(order.price), 0);
        
//         const userBonus = user.rows[0].bonus_points;
//         if (userBonus > 0) {
//             total -= userBonus; // Списываем бонусы
//             if (total < 0) total = 0; // Не допускаем отрицательных значений
//         }

//         if (total > userBalance) {
//             return res.status(400).send('Недостаточно средств на балансе');
//         }

//         const orderPromises = orders.map(async order => {
//             const productId = order.id; //   id продукта определен
//             const product = await pool.query('SELECT file_path FROM products WHERE id = $1', [productId]);

//             const filePath = product.rows[0]?.file_path;
//             if (!filePath) {
//                 throw new Error('File path not found for product');
//             }

//             await pool.query('INSERT INTO orders (user_id, product_id, order_date, product_name, price, image_url, file_path) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
//                 userId,
//                 productId,
//                 new Date(),
//                 order.name,
//                 order.price,
//                 order.image_url, 
//                 filePath
//             ]);
//         });

//         await Promise.all(orderPromises);

//         const newBalance = userBalance - total;
//         const newUserBonus = total/100 * 2
//         await pool.query('UPDATE users SET balance = $1, bonus_points = $2 WHERE id = $3', [newBalance, newUserBonus, userId]);
        
//         res.send('Orders saved successfully');
//     } catch (error) {
//         console.error('Error saving orders:', error);
//         res.status(500).send('Error saving orders');
//     }
// });
// Оформление заказа
app.get('/products-by-ids', async (req, res) => {
    try {
        const ids = req.query.ids.split(',').map(id => parseInt(id));
        const result = await pool.query(
            `SELECT id, name, price, image_url, discount 
             FROM products 
             WHERE id = ANY($1::int[])`,
            [ids]
        );
        
        // Добавляем полный URL к изображениям, если нужно
        const products = result.rows.map(product => ({
            ...product,
            image_url: product.image_url ? `/uploads/${product.image_url}` : null
        }));
        
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Database error' });
    }
});
app.post('/checkout', async (req, res) => {
    const userId = req.session.userId;
    
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Требуется авторизация' });
    }

    try {
        const { products, paymentMethod, email, phone, total } = req.body;

        // Проверка данных
        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Корзина пуста или данные о товарах неверны' 
            });
        }

        // Проверяем существование пользователя
        const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userExists.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }

        // Создаем заказ в транзакции
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Создаем записи о заказах для каждого товара
            const orderIds = [];
            const orderDate = new Date();
            
            for (const product of products) {
                // Проверяем существование продукта
                const productExists = await client.query(
                    'SELECT id, file_path FROM products WHERE id = $1', 
                    [product.id]
                );
                
                if (productExists.rows.length === 0) {
                    console.warn(`Товар с ID ${product.id} не найден, пропускаем`);
                    continue;
                }

                const filePath = productExists.rows[0].file_path;
                
                // Создаем запись о заказе
                const orderResult = await client.query(
                    `INSERT INTO orders 
                    (user_id, product_id, order_date, product_name, price, image_url, file_path) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7) 
                    RETURNING id`,
                    [
                        userId,
                        product.id,
                        orderDate,
                        product.name,
                        product.price,
                        product.image_url || product.image,
                        filePath
                    ]
                );
                
                orderIds.push(orderResult.rows[0].id);
            }

            if (orderIds.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: 'Ни один из товаров не найден в базе данных' 
                });
            }

            await client.query('COMMIT');
            
            res.json({ 
                success: true,
                orderIds,
                message: 'Заказ успешно оформлен'
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Ошибка оформления заказа:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка при оформлении заказа' 
        });
    }
});
app.get('/orders', async (req, res) => {
    const userId = req.session.userId; 
    try {
        const orders = await pool.query('SELECT product_id, order_date, price FROM orders WHERE user_id = $1', [userId]);
        
    
        const detailedOrders = await Promise.all(orders.rows.map(async (order) => {
            const product = await pool.query('SELECT name FROM products WHERE id = $1', [order.product_id]);
            return {
                product_id: order.product_id,
                order_date: order.order_date,
                price: order.price,
                name: product.rows[0]?.name || 'Unknown Product' 
            };
        }));

        res.json(detailedOrders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Error fetching orders');
    }
});

// Добавление товара
app.post('/add_product', async (req, res) => {
    const { product_name, price, image, file_path, description, genres, discount } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO products (name, price, image_url, file_path, description, discount) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, [product_name, price, image, file_path, description, discount]);
        
        const productId = result.rows[0].id;

        // Связываем жанры с продуктом
        if (genres.length > 0) {
            const genreQueries = genres.map(genre_id => {
                return pool.query(`INSERT INTO product_genres (product_id, genre_id) VALUES ($1, $2)`, [productId, genre_id]);
            });
            await Promise.all(genreQueries);
        }
        
        res.status(201).send('Product added successfully');
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Server error');
    }
});
// Обновление товара
app.post('/update_product', async (req, res) => {
    const { product_id, new_product_name, new_price, new_description, new_image, new_file_path } = req.body;
    const updates = [];
    const values = [];

    if (new_product_name) {
        updates.push(`name = $${updates.length + 1}`);
        values.push(new_product_name);
    }
    if (new_price) {
        updates.push(`price = $${updates.length + 1}`);
        values.push(new_price);
    }
    if (new_description) {
        updates.push(`description = $${updates.length + 1}`);
        values.push(new_description);
    }
    if (new_image) {
        updates.push(`image_url = $${updates.length + 1}`);
        values.push(new_image);
    }
    if (new_file_path) {
        updates.push(`file_path = $${updates.length + 1}`);
        values.push(new_file_path);
    }
 
    if (updates.length > 0) {
        values.push(product_id);
        await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
    }

    res.send('Product updated successfully');
});

// Удаление товара
app.post('/delete_product', async (req, res) => {
    const { product_id } = req.body;
    try {
        // Сначала удаляем связанные отзывы
        await pool.query('DELETE FROM reviews WHERE product_id = $1', [product_id]);
        // Сначала удаляем связанные заказы
        await pool.query('DELETE FROM orders WHERE product_id = $1', [product_id]);
         // Сначала удаляем связанные жанры
         await pool.query('DELETE FROM product_genres WHERE product_id = $1', [product_id]);
        // Затем удаляем товар
        await pool.query('DELETE FROM products WHERE id = $1', [product_id]);
        res.send('Товар и связанные заказы удалены');
    } catch (error) {
        console.error('Ошибка при удалении товара:', error);
        res.status(500).send('Ошибка при удалении товара');
    }
});

// Получение списка пользователей
app.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, email, user_type FROM users WHERE user_type IN ($1, $2)', ['user', 'admin']);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});
// Получение истории покупок пользователя
app.get('/users/:id/orders', async (req, res) => {
    const userId = req.params.id;
    try {
        const result = await pool.query('SELECT * FROM orders WHERE user_id = $1', [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});


app.get('/users/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        const result = await pool.query('SELECT name, email, created_at FROM users WHERE id = $1', [userId]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});
// Блокировка пользователя (удаление из БД)
app.delete('/users/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        await pool.query('DELETE FROM orders WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});
// Статистика
app.get('/statistics', async (req, res) => {
    try {
        const gamesCount = await pool.query('SELECT COUNT(*) FROM orders');
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const totalAmount = await pool.query('SELECT COALESCE(SUM(price), 0) AS total FROM orders');

        res.json({
            gamesCount: parseInt(gamesCount.rows[0].count),
            usersCount: parseInt(usersCount.rows[0].count),
            totalAmount: parseFloat(totalAmount.rows[0].total).toFixed(2) 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

const fs = require('fs');

app.get('/download/:productId', (req, res) => {
    const productId = req.params.productId;

    pool.query('SELECT file_path FROM orders WHERE product_id = $1 AND user_id = $2', [productId, req.session.userId])
        .then(result => {
            if (result.rows.length === 0) {
                return res.status(404).send('File not found');
            }

            const filePath = result.rows[0].file_path;
            res.download(filePath, (err) => {
                if (err) {
                    console.error('Error downloading file:', err);
                    res.status(500).send('Error downloading file');
                }
            });
        })
        .catch(err => {
            console.error('Error fetching file path:', err);
            res.status(500).send('Error fetching file path');
        });
});


// Logout 
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Ошибка при выходе из системы');
        }
        res.send('Выход выполнен успешно');
    });
});
app.get('/reviews', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.comment, r.rating, r.created_at, 
                   COALESCE(u.name, 'Покупатель') AS user_name, 
                   p.name AS product_name, 
                   r.show_name
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            JOIN products p ON r.product_id = p.id
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).send('Ошибка при получении отзывов');
    }
});

app.get('/reviews/:productId', async (req, res) => {
    const productId = req.params.productId;
    try {
        const result = await pool.query(`
            SELECT r.comment, r.rating, r.created_at AS date, 
                   COALESCE(u.name, 'Покупатель') AS user_name, 
                   g.name AS game_title, 
                   r.show_name 
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN products g ON r.product_id = g.id
            WHERE r.product_id = $1
        `, [productId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка при загрузке отзывов:', error);
        res.status(500).send('Error fetching reviews');
    }
});
app.post('/submit-review', async (req, res) => {
    const { product_id, rating, comment, show_name } = req.body;
    const user_id = req.session.userId; 

    if (!user_id) {
        return res.status(403).send('Пользователь не авторизован');
    }

    try {
        await pool.query(
            'INSERT INTO reviews (user_id, product_id, rating, comment, show_name) VALUES ($1, $2, $3, $4, $5)',
            [user_id, product_id, rating, comment, show_name]
        );
        res.status(201).send('Отзыв добавлен');
    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).send('Ошибка при добавлении отзыва');
    }
});
app.get('/latest-games', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id, p.name, p.image_url
            FROM orders o
            JOIN products p ON o.product_id = p.id
            ORDER BY o.order_date DESC
            LIMIT 8
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching latest games:', error);
        res.status(500).send('Ошибка при получении последних купленных игр');
    }
});

app.get('/latest-reviews', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.comment, r.rating, 
                   p.name AS product_name, 
                   p.image_url
            FROM reviews r
            JOIN products p ON r.product_id = p.id
            ORDER BY r.created_at DESC
            LIMIT 8
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching latest reviews:', error);
        res.status(500).send('Ошибка при получении последних отзывов');
    }
});

// Поддержка
app.post('/support', async (req, res) => {
    const { subject, reason, email } = req.body;
    const userId = req.session.userId; 
    try {
        const result = await pool.query(
            'INSERT INTO complaints (user_id, subject, reason, email) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, subject, reason, email]
        );
        res.json({ success: true, complaint: result.rows[0] });
    } catch (error) {
        console.error('Error saving complaint:', error);
        res.status(500).send('Ошибка при сохранении жалобы');
    }
});

app.get('/support/requests', async (req, res) => {
    const userId = req.session.userId;
    const result = await pool.query('SELECT * FROM complaints WHERE user_id = $1', [userId]);
    res.json(result.rows);
});
app.get('/support/requests/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        const requests = await pool.query('SELECT * FROM complaints WHERE user_id = $1', [userId]);
        res.json(requests.rows);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).send('Ошибка при получении обращений');
    }
});
// Получение жалоб
app.get('/support/complaints', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM complaints');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).send('Error fetching complaints');
    }
});

// Ответ на жалобу
app.post('/support/complaints/:id', async (req, res) => {
    const complaintId = req.params.id;
    const { response } = req.body;

    try {
        await pool.query('UPDATE complaints SET response = $1 WHERE id = $2', [response, complaintId]);
        res.send('Response recorded');
    } catch (error) {
        console.error('Error responding to complaint:', error);
        res.status(500).send('Error responding to complaint');
    }
});
//обработчик для пополнения баланса
app.post('/recharge', async (req, res) => {
    const { amount } = req.body; // Получаем сумму из тела запроса
    const userId = req.session.userId;

    // Проверка значений
    if (!userId || !amount || amount <= 0) {
        console.error('Invalid request:', { userId, amount });
        return res.status(400).send('Invalid request');
    }

    try {
        // Парсинг суммы
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount)) {
            return res.status(400).send('Invalid amount');
        }

        await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [parsedAmount, userId]);
        res.send('Balance updated successfully');
    } catch (error) {
        console.error('Error updating balance:', error);
        res.status(500).send('Error updating balance');
    }
});
app.get('/user/balance', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    try {
        const result = await pool.query('SELECT balance, bonus_points FROM users WHERE id = $1', [userId]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error('Error fetching user balance:', error);
        res.status(500).send('Server error');
    }
});

// Обновляем статус пользователя в зависимости от суммы покупок
app.get('/user/status', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    try {
        // Получаем общую сумму покупок
        const result = await pool.query('SELECT SUM(price) AS total_spent FROM orders WHERE user_id = $1', [userId]);
        const totalSpent = result.rows[0].total_spent || 0; // Если нет покупок, сумма будет 0

        let status = 'Бронза';
        let bonusPercentage = 2;

        if (totalSpent >= 10000) {
            status = 'Платина';
            bonusPercentage = 10;
        } else if (totalSpent >= 5000) {
            status = 'Золото';
            bonusPercentage = 5;
        }

        res.json({ status, bonusPercentage });
    } catch (error) {
        console.error('Error fetching user status:', error);
        res.status(500).send('Server error');
    }
});

// Добавление в избранное
app.post('/add-to-wishlist', async (req, res) => {
    const { product_id } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    try {
        // Проверяем, есть ли уже товар в избранном
        const exists = await pool.query(
            'SELECT 1 FROM wishlist WHERE user_id = $1 AND product_id = $2',
            [userId, product_id]
        );

        if (exists.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Товар уже в избранном' });
        }

        await pool.query(
            'INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2)',
            [userId, product_id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Получение избранных товаров
app.get('/wishlist', async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    try {
        const result = await pool.query(`
            SELECT p.id, p.name, p.price, p.image_url 
            FROM wishlist w
            JOIN products p ON w.product_id = p.id
            WHERE w.user_id = $1
        `, [userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).send('Error fetching wishlist');
    }
});
// Получение информации о пользователе
app.get('/user/info', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    try {
        const result = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [userId]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).send('Server error');
    }
});
// Получение всех заказов с возможностью фильтрации
app.get('/admin/orders', async (req, res) => {
    try {
        let query = `
            SELECT o.id, o.order_date, o.price, o.product_name, 
                   u.name as user_name, u.email as user_email,
                   p.image_url as product_image
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN products p ON o.product_id = p.id
            WHERE 1=1
        `;
        
        const params = [];
        
        // Фильтр по дате
        if (req.query.dateFrom) {
            query += ` AND o.order_date >= $${params.length + 1}`;
            params.push(req.query.dateFrom);
        }
        if (req.query.dateTo) {
            query += ` AND o.order_date <= $${params.length + 1}`;
            params.push(req.query.dateTo);
        }
        
        // Фильтр по поисковому запросу
        if (req.query.search) {
            query += ` AND (o.product_name ILIKE $${params.length + 1} OR u.name ILIKE $${params.length + 1})`;
            params.push(`%${req.query.search}%`);
        }
        
        query += ` ORDER BY o.order_date DESC`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Error fetching orders');
    }
});
// Расширенная статистика
app.get('/admin/statistics', async (req, res) => {
    try {
        const { period, metric } = req.query;
        
        // Определяем интервал для фильтрации
        const intervals = {
            day: '1 day',
            week: '1 week',
            month: '1 month',
            year: '1 year',
            all: '100 years'
        };
        
        const whereClause = intervals[period] 
            ? `WHERE o.order_date >= NOW() - INTERVAL '${intervals[period]}'`
            : '';
        
        // Основные метрики
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT o.id) as total_sales,
                COALESCE(SUM(o.price), 0) as total_revenue,
                COUNT(DISTINCT o.user_id) as total_customers,
                COUNT(DISTINCT CASE 
                    WHEN u.created_at >= NOW() - INTERVAL '${intervals[period]}' 
                    THEN u.id 
                END) as new_customers
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ${whereClause}
        `;
        
        const statsResult = await pool.query(statsQuery);
        
        // Данные для графика
        let chartQuery = '';
        if (metric === 'count') {
            chartQuery = `
                SELECT 
                    DATE_TRUNC('day', o.order_date) as date,
                    COUNT(*) as value
                FROM orders o
                ${whereClause}
                GROUP BY date
                ORDER BY date
            `;
        } else if (metric === 'revenue') {
            chartQuery = `
                SELECT 
                    DATE_TRUNC('day', o.order_date) as date,
                    SUM(o.price) as value
                FROM orders o
                ${whereClause}
                GROUP BY date
                ORDER BY date
            `;
        } else {
            chartQuery = `
                SELECT 
                    DATE_TRUNC('day', o.order_date) as date,
                    COUNT(DISTINCT o.user_id) as value
                FROM orders o
                ${whereClause}
                GROUP BY date
                ORDER BY date
            `;
        }
        
        const chartResult = await pool.query(chartQuery);
        
        res.json({
            ...statsResult.rows[0],
            chartData: chartResult.rows
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).send('Error fetching statistics');
    }
});
// Создаем таблицу для логов посещений, если ее нет
async function initAnalyticsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS site_analytics (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(255) NOT NULL,
            user_id INTEGER REFERENCES users(id),
            page_url VARCHAR(255) NOT NULL,
            referrer VARCHAR(255),
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            left_at TIMESTAMP,
            time_spent INTEGER
        )
    `);
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sales_analytics (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES orders(id),
            session_id VARCHAR(255) NOT NULL,
            user_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
}

initAnalyticsTable();

// Middleware для логирования посещений
app.use(async (req, res, next) => {
    if (req.path.startsWith('/admin') || req.path.endsWith('.css') || req.path.endsWith('.js')) {
        return next();
    }
    
    const sessionId = req.sessionID;
    const userId = req.session.userId || null;
    const pageUrl = req.originalUrl;
    const referrer = req.get('Referer') || null;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');
    
    try {
        await pool.query(
            'INSERT INTO site_analytics (session_id, user_id, page_url, referrer, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
            [sessionId, userId, pageUrl, referrer, ip, userAgent]
        );
    } catch (error) {
        console.error('Error logging visit:', error);
    }
    
    next();
});

app.get('/admin/analytics', async (req, res) => {
    try {
        const { period } = req.query;
        
        const intervals = {
            day: '1 day',
            week: '1 week',
            month: '1 month',
            year: '1 year'
        };
        
        const whereClause = intervals[period] 
            ? `WHERE created_at >= NOW() - INTERVAL '${intervals[period]}'`
            : '';
        
        // Основные метрики
        const visitorsQuery = `
            SELECT 
                COUNT(*) as total_visits,
                COUNT(DISTINCT session_id) as unique_visitors,
                COUNT(DISTINCT user_id) as registered_visitors,
                COUNT(DISTINCT CASE 
                    WHEN session_id IN (
                        SELECT session_id 
                        FROM site_analytics 
                        WHERE created_at < NOW() - INTERVAL '${intervals[period]}'
                    ) 
                    THEN session_id 
                END) as returning_visitors
            FROM site_analytics
            ${whereClause}
        `;
        
        const visitorsResult = await pool.query(visitorsQuery);
        
        res.json(visitorsResult.rows[0]);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).send('Error fetching analytics');
    }
});
// Запуск сервера
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

