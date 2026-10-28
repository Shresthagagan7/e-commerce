// server.js
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const app = express();
const PORT = 3000;
const JWT_SECRET = 'suranjana_secret_key'; // रियल प्रोजेक्टमा यसलाई .env मा राख्नुपर्छ

// फोटो अपलोड सेटिङ (Multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/uploads/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

// MySQL Connection Pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      // तपाईंको MySQL युजरनेम
    password: '',      // तपाईंको MySQL पासवर्ड (XAMPP मा खाली हुन्छ)
    database: 'suranjana_gallery',
    waitForConnections: true,
    connectionLimit: 10
});

// Database connection check
pool.getConnection()
    .then(conn => { console.log("MySQL Connected Successfully!"); conn.release(); })
    .catch(err => console.error("MySQL Connection Failed:", err));

// API Endpoint to get products
app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products');
        // SQL बाट आएको 'sizes' string लाई फेरि Array बनाउनुपर्छ
        const products = rows.map(p => ({
            ...p,
            sizes: typeof p.sizes === 'string' ? JSON.parse(p.sizes) : p.sizes,
            color: typeof p.color === 'string' ? JSON.parse(p.color) : p.color
        }));
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth API: Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password, phone, address } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone, address]
        );
        res.json({ success: true, userId: result.insertId });
    } catch (err) {
        console.error("Signup Error:", err); // टर्मिनलमा एरर हेर्नका लागि
        res.status(500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'यो ईमेल पहिले नै दर्ता भइसकेको छ।' : 'सर्भरमा समस्या आयो।' });
    }
});

// Auth API: Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

        const token = jwt.sign({ id: user.id, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '1d' });
        delete user.password; // सुरक्षाको लागि पासवर्ड हटाउने
        res.json({ success: true, token, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Endpoint to place an order
app.post('/api/orders', async (req, res) => {
    try {
        const { cart, customer, payment, userId, adminId } = req.body;
        const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
        const total_price = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        await pool.query(
            'INSERT INTO orders (id, customer_name, customer_phone, customer_address, payment_method, total_price, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [orderId, customer.name, customer.phone, customer.address, payment, total_price, userId || null]
        );

        // स्टक घटाउने (Inventory Management)
        for (const item of cart) {
            await pool.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.id]);
        }

        res.json({ success: true, orderId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'अर्डर सेभ गर्न सकिएन' });
    }
});

// API Endpoint to track an order
app.get('/api/orders/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, status, created_at, total_price, customer_name FROM orders WHERE id = ?', [req.params.id]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'अर्डर फेला परेन' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API to get User Order History
app.get('/api/user/orders/:userId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Admin APIs ---

// Admin चेक गर्ने Middleware
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(403).json({ error: "पहुँच अस्विकार गरियो (No Token)" });

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        if (verified.is_admin) {
            req.user = verified;
            next();
        } else {
            res.status(403).json({ error: "तपाईं एडमिन हुनुहुन्न!" });
        }
    } catch (err) {
        res.status(401).json({ error: "टोकन अमान्य छ।" });
    }
};

// Get all orders (Admin only)
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update order status
app.put('/api/admin/orders/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add new product
app.post('/api/admin/products', authenticateAdmin, upload.single('imageFile'), async (req, res) => {
    try {
        const { name, price, category, subCategory, sizes, color, stock } = req.body;
        // यदि फाइल अपलोड गरिएको छ भने त्यसको पाथ राख्ने, नत्र पुरानो URL प्रयोग गर्ने
        const imagePath = req.file ? `uploads/${req.file.filename}` : req.body.image;

        await pool.query(
            'INSERT INTO products (name, price, category, subCategory, sizes, color, image, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, price, category, subCategory, sizes, color, imagePath, stock]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update product (Price/Stock/etc)
app.put('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
    try {
        const { name, price, category, subCategory, sizes, color, image, stock } = req.body;
        await pool.query(
            'UPDATE products SET name = ?, price = ?, category = ?, subCategory = ?, sizes = ?, color = ?, image = ?, stock = ? WHERE id = ?',
            [name, price, category, subCategory, JSON.stringify(sizes), JSON.stringify(color), image, stock, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete product
app.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
    console.log(`Suranjana Gallery server running at http://localhost:${PORT}`);
});
