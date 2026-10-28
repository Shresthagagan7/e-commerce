let cart = [];
let allProducts = [];
let currentCategory = 'all';
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let token = localStorage.getItem('token') || null;
let authMode = 'login';
updateUserUI();

async function fetchProducts() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        allProducts = products;
        renderProducts(allProducts);
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = products.map(product => `
        <div class="product-card">
            <img src="${product.image}" alt="${product.name}" onclick="showProductDetails(${product.id})" style="cursor:pointer;" onerror="this.src='https://via.placeholder.com/300x300?text=No+Image+Found'">
            <h4 onclick="showProductDetails(${product.id})" style="cursor:pointer;">${product.name}</h4>
            <p class="category" style="font-size: 0.8rem; color: #666;">${product.category}</p>
            <div class="color-info" style="font-size: 0.8rem; margin-bottom: 5px;">
                <strong>Colors:</strong> 
                ${Array.isArray(product.color) ? product.color.map(c => `<span class="size-tag" style="background:#e9ecef;">${c}</span>`).join('') : product.color}
            </div>
            <div class="size-info">
                <strong>Sizes:</strong> 
                ${product.sizes.map(size => `<span class="size-tag">${size}</span>`).join('')}
            </div>
            <p class="price">Rs. ${product.price}</p>
            <button class="add-btn" onclick="addToCart(${product.id})">Add to Cart</button>
        </div>
    `).join('');
}

function showProductDetails(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    // यदि पहिल्यै modal छैन भने बनाउने
    let detailModal = document.getElementById('product-detail-modal');
    if (!detailModal) {
        detailModal = document.createElement('div');
        detailModal.id = 'product-detail-modal';
        detailModal.className = 'modal';
        document.body.appendChild(detailModal);
    }

    detailModal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <span class="close" onclick="closeProductModal()">&times;</span>
            <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px;">
                <div style="flex: 1; min-width: 300px;">
                    <img src="${product.image}" alt="${product.name}" style="width: 100%; border-radius: 8px;" onerror="this.src='https://via.placeholder.com/600x600?text=No+Image+Found'">
                </div>
                <div style="flex: 1; min-width: 300px;">
                    <h2 style="margin-top: 0;">${product.name}</h2>
                    <p style="color: #666;">Category: ${product.category} ${product.subCategory ? ' > ' + product.subCategory : ''}</p>
                    <h3 style="color: #e91e63;">Rs. ${product.price}</h3>
                    <hr>
                    <div style="margin: 15px 0;">
                        <strong>Available Colors:</strong><br>
                        ${Array.isArray(product.color) ? product.color.map(c => `<span class="size-tag" style="background:#f0f0f0; display:inline-block; margin:5px 5px 0 0;">${c}</span>`).join('') : product.color}
                    </div>
                    <div style="margin: 15px 0;">
                        <strong>Available Sizes:</strong><br>
                        ${product.sizes.map(size => `<span class="size-tag" style="display:inline-block; margin:5px 5px 0 0;">${size}</span>`).join('')}
                    </div>
                    <div style="margin: 15px 0;">
                        <strong>Stock Status:</strong> 
                        <span style="color: ${product.stock > 0 ? 'green' : 'red'};">
                            ${product.stock > 0 ? product.stock + ' items in stock' : 'Out of Stock'}
                        </span>
                    </div>
                    <button class="add-btn" style="width: 100%; padding: 12px; margin-top: 20px;" onclick="addToCart(${product.id}); closeProductModal();">Add to Cart</button>
                </div>
            </div>
        </div>
    `;
    detailModal.style.display = 'block';
}

function closeProductModal() {
    document.getElementById('product-detail-modal').style.display = 'none';
}

function filterProducts(category, event) {
    // Update active button UI
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');
    
    currentCategory = category;
    applyFilters();
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedSize = document.getElementById('sizeFilter').value;
    const selectedColor = document.getElementById('colorFilter').value;
    const maxPrice = document.getElementById('priceFilter').value;

    const filtered = allProducts.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm);
        
        let matchesCategory = true;
        if (currentCategory !== 'all') {
            if (currentCategory.startsWith('sub-')) {
                matchesCategory = product.subCategory === currentCategory.replace('sub-', '');
            } else {
                matchesCategory = product.category === currentCategory;
            }
        }

        const matchesSize = selectedSize === "" || product.sizes.includes(selectedSize);
        const matchesColor = selectedColor === "" || (Array.isArray(product.color) && product.color.includes(selectedColor));
        const matchesPrice = maxPrice === "" || product.price <= parseInt(maxPrice);

        return matchesSearch && matchesCategory && matchesSize && matchesColor && matchesPrice;
    });

    renderProducts(filtered);
}

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCartUI();
    if(!document.getElementById('cart-sidebar').classList.contains('open')) {
        toggleCart();
    }
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').innerText = count;

    const cartItemsList = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    
    let total = 0;
    cartItemsList.innerHTML = cart.map(item => {
        total += item.price * item.quantity;
        return `
            <div class="cart-item">
                <div>
                    <strong>${item.name}</strong><br>
                    <small>Rs. ${item.price} x ${item.quantity}</small>
                </div>
                <button onclick="removeFromCart(${item.id})" style="border:none; background:none; color:red; cursor:pointer; font-weight:bold;">Hataune</button>
            </div>
        `;
    }).join('');
    
    cartTotal.innerText = total;
    document.getElementById('checkout-total').innerText = total;
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('open');
}

function showCheckout() {
    if (cart.length === 0) return alert("तपाईंको कार्ट खाली छ!");
    toggleCart();
    document.getElementById('checkout-modal').style.display = 'block';
}

function closeCheckout() {
    document.getElementById('checkout-modal').style.display = 'none';
}

document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const orderData = {
        customer: {
            name: formData.get('name'),
            phone: formData.get('phone'),
            address: formData.get('address')
        },
        payment: formData.get('payment'),
        userId: currentUser ? currentUser.id : null,
        cart: cart
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        const result = await response.json();
        
        alert(`नमस्ते ${orderData.customer.name}!\n\nअर्डर सफल भयो!\nतपाईंको Order ID: ${result.orderId}\nकृपया यो ID सुरक्षित राख्नुहोला।`);
        
        cart = [];
        updateCartUI();
        closeCheckout();
    } catch (error) {
        alert('अर्डर गर्दा समस्या आयो। फेरि प्रयास गर्नुहोला।');
    }
});

function showTrackModal() { document.getElementById('track-modal').style.display = 'block'; }
function closeTrackModal() { document.getElementById('track-modal').style.display = 'none'; }

async function trackOrder() {
    const orderId = document.getElementById('trackIdInput').value.trim();
    const resultDiv = document.getElementById('track-result');
    if (!orderId) return alert("कृपया Order ID राख्नुहोस्।");

    try {
        const response = await fetch(`/api/orders/${orderId}`);
        if (!response.ok) throw new Error();
        const order = await response.json();

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <p style="border-bottom: 1px solid #ddd; padding-bottom: 5px;"><strong>Customer:</strong> ${order.customer_name}</p>
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Status:</strong> <span class="status-badge" style="background:#fff3cd; color:#856404; padding: 2px 8px; border-radius: 4px;">${order.status}</span></p>
            <p><strong>Total Amount:</strong> Rs. ${order.total_price}</p>
            <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
        `;
    } catch (error) {
        alert("Order ID मिलेन। कृपया फेरि चेक गर्नुहोला।");
    }
}

// --- Authentication Logic ---
function showAuthModal(mode) {
    authMode = mode;
    document.getElementById('auth-modal').style.display = 'block';
    updateAuthUI();
}

function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

function toggleAuthMode() {
    authMode = (authMode === 'login') ? 'signup' : 'login';
    updateAuthUI();
}

function updateAuthUI() {
    const isLogin = authMode === 'login';
    document.getElementById('auth-title').innerText = isLogin ? 'Login' : 'Create Account';
    document.getElementById('auth-submit').innerText = isLogin ? 'Login' : 'Register';
    document.getElementById('signup-fields').style.display = isLogin ? 'none' : 'block';
    document.getElementById('auth-switch-text').innerText = isLogin ? "Don't have an account?" : "Already have an account?";
    document.getElementById('auth-switch-link').innerText = isLogin ? "Sign Up" : "Login";
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;

    if (authMode === 'signup') {
        const name = document.getElementById('reg-name').value;
        const phone = document.getElementById('reg-phone').value;
        const address = document.getElementById('reg-address').value;
        
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, phone, address })
        });
        if (res.ok) {
            alert("Registration successful! Please login.");
            authMode = 'login';
            updateAuthUI();
        } else {
            const data = await res.json();
            alert("Registration failed: " + (data.error || "अज्ञात समस्या आयो।"));
        }
    } else {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            token = data.token;
            localStorage.setItem('user', JSON.stringify(currentUser));
            localStorage.setItem('token', token);
            updateUserUI();
            closeAuthModal();
        } else {
            alert(data.error);
        }
    }
});

function updateUserUI() {
    const loginLink = document.getElementById('login-link');
    const profileLink = document.getElementById('profile-link');
    const adminLink = document.getElementById('admin-link');
    if (currentUser) {
        loginLink.style.display = 'none';
        profileLink.style.display = 'inline-block';
        if (currentUser.is_admin) adminLink.style.display = 'inline-block';
        // Auto-fill checkout if logged in
        setTimeout(() => {
            const nameField = document.querySelector('input[name="name"]');
            if(nameField) nameField.value = currentUser.name;
        }, 500);
    } else {
        loginLink.style.display = 'inline-block';
        profileLink.style.display = 'none';
    }
}

async function showProfile() {
    document.getElementById('profile-modal').style.display = 'block';
    document.getElementById('user-info').innerHTML = `
        <p><strong>Name:</strong> ${currentUser.name}</p>
        <p><strong>Email:</strong> ${currentUser.email}</p>
    `;
    
    const res = await fetch(`/api/user/orders/${currentUser.id}`);
    const orders = await res.json();
    const historyDiv = document.getElementById('order-history');
    
    if (orders.length === 0) {
        historyDiv.innerHTML = "<p>No orders yet.</p>";
    } else {
        historyDiv.innerHTML = orders.map(order => `
            <div class="cart-item" style="padding:10px 0;">
                <div>
                    <strong>${order.id}</strong><br>
                    <small>${new Date(order.created_at).toLocaleDateString()}</small>
                </div>
                <div>
                    <span class="status-badge" style="background:#eee;">${order.status}</span><br>
                    <strong>Rs. ${order.total_price}</strong>
                </div>
            </div>
        `).join('');
    }
}

function closeProfileModal() { document.getElementById('profile-modal').style.display = 'none'; }

function logout() {
    localStorage.removeItem('user');
    currentUser = null;
    updateUserUI();
    closeProfileModal();
    location.reload();
}

// --- Admin Logic ---
function showAdminPanel() {
    document.getElementById('admin-modal').style.display = 'block';
    loadAdminProducts();
    loadAdminOrders();
}
function closeAdminPanel() { document.getElementById('admin-modal').style.display = 'none'; }

function switchAdminTab(tab) {
    document.getElementById('admin-products-tab').style.display = tab === 'products' ? 'block' : 'none';
    document.getElementById('admin-orders-tab').style.display = tab === 'orders' ? 'block' : 'none';
}

async function loadAdminProducts() {
    const res = await fetch('/api/products');
    const products = await res.json();
    const list = document.getElementById('admin-product-list');
    list.innerHTML = products.map(p => `
        <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; align-items:center;">
            <span>${p.name} (Rs.${p.price}) - Stock: <strong>${p.stock}</strong></span>
            <div>
                <button onclick="deleteProduct(${p.id})" style="color:red; cursor:pointer; background:none; border:none;">Delete</button>
            </div>
        </div>
    `).join('');
}

document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const formData = new FormData();
        const imageFileInput = document.getElementById('p-image-file');
        const imageFile = imageFileInput ? imageFileInput.files[0] : null;
        
        // साइज र रङलाई एरे बनाएर स्ट्रिङको रूपमा पठाउने
        const sizesArray = document.getElementById('p-sizes').value.split(',').map(s => s.trim()).filter(s => s !== "");
        const colorsArray = document.getElementById('p-color').value.split(',').map(c => c.trim()).filter(c => c !== "");

        formData.append('name', document.getElementById('p-name').value);
        formData.append('price', document.getElementById('p-price').value);
        formData.append('category', document.getElementById('p-cat').value);
        formData.append('subCategory', document.getElementById('p-sub').value);
        formData.append('sizes', JSON.stringify(sizesArray));
        formData.append('color', JSON.stringify(colorsArray));
        formData.append('stock', document.getElementById('p-stock').value);
        
        if (imageFile) {
            formData.append('imageFile', imageFile);
        } else {
            formData.append('image', document.getElementById('p-image').value);
        }

        const res = await fetch('/api/admin/products', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData // Note: FormData पठाउँदा Content-Type हेडर राख्नु पर्दैन
        });

        if (res.ok) {
            alert("Product Added Successfully!");
            e.target.reset(); // फर्म खाली गर्ने
            loadAdminProducts();
            fetchProducts(); // मुख्य पेजको लिस्ट अपडेट गर्ने
        } else {
            const errData = await res.json();
            alert("Failed to add: " + errData.error);
        }
    } catch (err) {
        console.error("Add Product Error:", err);
        alert("केही समस्या आयो! साइज/रङहरू Comma (,) ले छुट्याएर लेख्नुहोस् र फोटो छान्नुहोस्।");
    }
});

async function deleteProduct(id) {
    if(!confirm("Are you sure?")) return;
    await fetch(`/api/admin/products/${id}`, { 
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    loadAdminProducts();
    fetchProducts();
}

async function loadAdminOrders() {
    const res = await fetch('/api/admin/orders', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const orders = await res.json();
    const list = document.getElementById('admin-order-list');
    list.innerHTML = orders.map(o => `
        <div style="padding:15px; border:1px solid #ddd; margin-bottom:10px; background:#fff;">
            <div style="display:flex; justify-content:space-between;">
                <strong>${o.id}</strong>
                <select onchange="updateOrderStatus('${o.id}', this.value)" style="padding:2px;">
                    <option value="Pending" ${o.status==='Pending'?'selected':''}>Pending</option>
                    <option value="Shipped" ${o.status==='Shipped'?'selected':''}>Shipped</option>
                    <option value="Delivered" ${o.status==='Delivered'?'selected':''}>Delivered</option>
                    <option value="Cancelled" ${o.status==='Cancelled'?'selected':''}>Cancelled</option>
                </select>
            </div>
            <p style="margin:5px 0; font-size:0.9rem;">
                Customer: ${o.customer_name} (${o.customer_phone})<br>
                Address: ${o.customer_address}<br>
                Total: Rs. ${o.total_price} (${o.payment_method})
            </p>
        </div>
    `).join('');
}

async function updateOrderStatus(orderId, status) {
    await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
    });
    alert("Status Updated!");
}

fetchProducts();