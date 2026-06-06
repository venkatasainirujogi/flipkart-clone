// js/api.js
// ─── Centralized API Client ───────────────────────────────────
// All HTTP calls go through here — handles auth headers, errors, loading state

const API_BASE = 'http://localhost:8000/api';

const API = {
  // ─── Core request method ───────────────────────────────────
  async request(method, path, body = null, requiresAuth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (requiresAuth) {
      const token = Auth.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    try {
      const resp = await fetch(`${API_BASE}${path}`, config);

      if (resp.status === 401) {
        // Try refresh
        const refreshed = await Auth.tryRefresh();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${Auth.getToken()}`;
          const retry = await fetch(`${API_BASE}${path}`, { ...config, headers });
          return await handleResponse(retry);
        }
        Auth.logout(false);
        showModal('authModal');
        throw new Error('Authentication required');
      }
      return await handleResponse(resp);
    } catch (err) {
      if (err.message !== 'Authentication required') {
        console.error(`API Error [${method} ${path}]:`, err);
      }
      throw err;
    }
  },

  get:    (path, auth = false) => API.request('GET',    path, null, auth),
  post:   (path, body, auth = true) => API.request('POST',  path, body, auth),
  put:    (path, body, auth = true) => API.request('PUT',   path, body, auth),
  patch:  (path, body, auth = true) => API.request('PATCH', path, body, auth),
  delete: (path, auth = true) => API.request('DELETE', path, null, auth),

  // ─── Auth ─────────────────────────────────────────────────
  auth: {
    login:    (email, password)       => API.post('/auth/login',    { email, password },    false),
    register: (email, password, name, phone) =>
                                         API.post('/auth/register', { email, password, full_name: name, phone }, false),
    me:       ()                      => API.get('/auth/me', true),
    refresh:  (token)                 => API.post('/auth/refresh',  null, false)
                                           .catch(() => null),
    addresses: () => API.get('/auth/addresses', true),
    addAddress: (data) => API.post('/auth/addresses', data, true),
  },

  // ─── Products ────────────────────────────────────────────
  products: {
    list: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v != null && v !== '' && qs.append(k, v));
      return API.get(`/products?${qs.toString()}`, false);
    },
    get:        (id)     => API.get(`/products/${id}`, false),
    categories: ()       => API.get('/products/categories', false),
    reviews:    (id)     => API.get(`/products/${id}/reviews`, false),
    addReview:  (id, r)  => API.post(`/products/${id}/reviews`, r, true),
    create:     (data)   => API.post('/products', data, true),
  },

  // ─── Cart ─────────────────────────────────────────────────
  cart: {
    get:    (uid)         => API.get(`/cart/${uid}`, true),
    add:    (uid, pid, qty) => API.post(`/cart/${uid}/items`, { product_id: pid, quantity: qty }, true),
    update: (uid, iid, qty) => API.put(`/cart/${uid}/items/${iid}`, { quantity: qty }, true),
    remove: (uid, iid)    => API.delete(`/cart/${uid}/items/${iid}`, true),
    clear:  (uid)         => API.delete(`/cart/${uid}/clear`, true),
  },

  // ─── Orders ──────────────────────────────────────────────
  orders: {
    create:     (data) => API.post('/orders', data, true),
    list:       (uid)  => API.get(`/orders/user/${uid}`, true),
    get:        (id)   => API.get(`/orders/${id}`, true),
    updateStatus: (id, status, message) =>
      API.patch(`/orders/${id}/status`, { status, message }, true),
  },

  // ─── Payments ────────────────────────────────────────────
  payments: {
    initiate: (data) => API.post('/payments/initiate', data, true),
    verify:   (data) => API.post('/payments/verify',   data, true),
  },
};

async function handleResponse(resp) {
  const text = await resp.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { detail: text }; }

  if (!resp.ok) {
    const msg = data?.detail || data?.message || `HTTP ${resp.status}`;
    throw new Error(Array.isArray(msg) ? msg.map(e => e.msg).join(', ') : msg);
  }
  return data;
}

// ─── Mock data for offline/demo mode ─────────────────────────
const MOCK_PRODUCTS = [
  { id: '1', name: 'Samsung Galaxy S24 Ultra', brand: 'Samsung', category_id: 'electronics',
    base_price: 134999, selling_price: 109999, discount_percent: 19, stock_quantity: 50,
    images: [], rating: 4.5, review_count: 1832, specifications: { Display: '6.8" Dynamic AMOLED', RAM: '12GB', Storage: '256GB', Battery: '5000mAh', Camera: '200MP' } },
  { id: '2', name: 'Apple iPhone 15 Pro Max', brand: 'Apple', category_id: 'electronics',
    base_price: 159900, selling_price: 149900, discount_percent: 6, stock_quantity: 30,
    images: [], rating: 4.7, review_count: 3241, specifications: { Display: '6.7" Super Retina XDR', RAM: '8GB', Storage: '256GB', Battery: '4422mAh', Camera: '48MP' } },
  { id: '3', name: 'Sony WH-1000XM5 Headphones', brand: 'Sony', category_id: 'electronics',
    base_price: 29990, selling_price: 21990, discount_percent: 27, stock_quantity: 120,
    images: [], rating: 4.6, review_count: 5621, specifications: { Type: 'Over-ear', 'Noise Cancel': 'Yes', 'Battery Life': '30 hrs', Connectivity: 'Bluetooth 5.2', Weight: '250g' } },
  { id: '4', name: 'Nike Air Max 270 Sneakers', brand: 'Nike', category_id: 'fashion',
    base_price: 11995, selling_price: 7995, discount_percent: 33, stock_quantity: 200,
    images: [], rating: 4.3, review_count: 892, specifications: { Material: 'Mesh + Leather', Sole: 'Air Max', Style: 'Casual', 'Closure Type': 'Lace-Up' } },
  { id: '5', name: 'Instant Pot Duo 7-in-1', brand: 'Instant Pot', category_id: 'home',
    base_price: 8999, selling_price: 5999, discount_percent: 33, stock_quantity: 80,
    images: [], rating: 4.4, review_count: 4127, specifications: { Capacity: '6L', Functions: '7-in-1', Power: '1000W', Programs: '13 Built-in' } },
  { id: '6', name: 'Dell XPS 15 Laptop', brand: 'Dell', category_id: 'electronics',
    base_price: 199999, selling_price: 159999, discount_percent: 20, stock_quantity: 25,
    images: [], rating: 4.5, review_count: 643, specifications: { Display: '15.6" OLED', Processor: 'Intel Core i7', RAM: '16GB', Storage: '512GB SSD', GPU: 'NVIDIA RTX 4060' } },
  { id: '7', name: 'Levi\'s 511 Slim Jeans', brand: 'Levi\'s', category_id: 'fashion',
    base_price: 2999, selling_price: 1999, discount_percent: 33, stock_quantity: 500,
    images: [], rating: 4.1, review_count: 2184, specifications: { Fit: 'Slim', Material: '99% Cotton', Rise: 'Mid-Rise', Closure: 'Zip Fly' } },
  { id: '8', name: 'Prestige Iris 750W Mixer Grinder', brand: 'Prestige', category_id: 'home',
    base_price: 3995, selling_price: 2495, discount_percent: 38, stock_quantity: 300,
    images: [], rating: 4.2, review_count: 8912, specifications: { Power: '750W', Jars: '3', Speed: '3 + Pulse', Warranty: '5 Years' } },
  { id: '9', name: 'Boat Airdopes 141 TWS', brand: 'boAt', category_id: 'electronics',
    base_price: 1999, selling_price: 899, discount_percent: 55, stock_quantity: 1000,
    images: [], rating: 3.9, review_count: 32451, specifications: { Type: 'In-Ear TWS', 'Battery Life': '42 hrs total', Driver: '8mm', Connectivity: 'Bluetooth 5.0', 'Water Resistant': 'IPX4' } },
  { id: '10', name: 'Puma Men\'s Poly Jacket', brand: 'Puma', category_id: 'fashion',
    base_price: 3999, selling_price: 1999, discount_percent: 50, stock_quantity: 150,
    images: [], rating: 4.0, review_count: 341, specifications: { Material: '100% Polyester', 'Closure Type': 'Zipper', Sleeve: 'Full Sleeve', Style: 'Regular Fit' } },
  { id: '11', name: 'Kindle Paperwhite (16GB)', brand: 'Amazon', category_id: 'electronics',
    base_price: 14999, selling_price: 10999, discount_percent: 27, stock_quantity: 200,
    images: [], rating: 4.7, review_count: 11230, specifications: { Display: '6.8" 300ppi', Storage: '16GB', Backlight: 'Adjustable', 'Battery Life': '10 Weeks', Waterproof: 'IPX8' } },
  { id: '12', name: 'Hanes Plain Crew-Neck T-Shirt', brand: 'Hanes', category_id: 'fashion',
    base_price: 499, selling_price: 299, discount_percent: 40, stock_quantity: 2000,
    images: [], rating: 3.8, review_count: 4521, specifications: { Material: '100% Cotton', Fit: 'Regular', Neck: 'Crew', 'Pack of': '3' } },
];

const MOCK_CATEGORIES = [
  { id: 'electronics', name: 'Electronics', slug: 'electronics', image_url: null },
  { id: 'fashion',     name: 'Fashion',     slug: 'fashion',     image_url: null },
  { id: 'home',        name: 'Home & Kitchen', slug: 'home',     image_url: null },
];

const PRODUCT_EMOJIS = {
  electronics: ['📱','💻','🎧','⌚','📷','🖥️','🎮','📡'],
  fashion:     ['👟','👕','👖','👗','👔','🧥','🕶️','💍'],
  home:        ['🍳','🛋️','🏺','🪴','💡','🪣','🧹','🫙'],
};
function getProductEmoji(p) {
  const cat = p.category_id || 'electronics';
  const arr = PRODUCT_EMOJIS[cat] || PRODUCT_EMOJIS.electronics;
  const idx = (p.id ? p.id.charCodeAt(0) : 0) % arr.length;
  return arr[idx];
}
