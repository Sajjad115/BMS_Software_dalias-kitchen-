import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAewggG20g0ZlJvyYPTYSaIWfr4UKrUbNg",
    authDomain: "dalias-kitchen.firebaseapp.com",
    projectId: "dalias-kitchen",
    storageBucket: "dalias-kitchen.firebasestorage.app",
    messagingSenderId: "430311800072",
    appId: "1:430311800072:web:71ae6900ed96324cca40bd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const menuCol = collection(db, "menu");
const salesCol = collection(db, "sales");

let allItems = [];
let cart = [];

// MODAL CONTROLS
document.getElementById('openAddModal').onclick = () => document.getElementById('addModal').style.display = 'block';
document.getElementById('checkFP').onchange = (e) => document.getElementById('priceFP').style.display = e.target.checked ? 'block' : 'none';
document.getElementById('checkFoodie').onchange = (e) => document.getElementById('priceFoodie').style.display = e.target.checked ? 'block' : 'none';

// --- 1. RENDER GROUPED MENU ---
onSnapshot(query(menuCol, orderBy("createdAt", "desc")), (snapshot) => {
    allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCategorizedMenu();
});

function renderCategorizedMenu() {
    const container = document.getElementById('menuSections');
    const search = document.getElementById('menuSearch').value.toLowerCase();
    container.innerHTML = "";

    const categories = ["Main Course", "Snacks", "Beverages", "Desserts", "Others"];

    categories.forEach(cat => {
        const catItems = allItems.filter(item => 
            (item.category === cat || (!item.category && cat === "Others")) && 
            item.name.toLowerCase().includes(search)
        );

        if (catItems.length > 0) {
            const section = document.createElement('div');
            section.className = 'cat-section';
            section.innerHTML = `
                <h2 class="cat-heading">${cat}</h2>
                <div class="menu-grid">
                    ${catItems.map(item => `
                        <div class="menu-card">
                            <img src="${item.img || 'https://via.placeholder.com/150'}" class="menu-img">
                            <div class="menu-info">
                                <span style="font-size:10px; color:#e67e22; font-weight:bold;">${item.variation}</span>
                                <h3 style="margin:5px 0;">${item.name}</h3>
                                <div class="price-tag">৳ ${item.prices.dineIn}</div>
                                <button class="btn-primary" style="width:100%;" onclick="addToCart('${item.id}')">Click to Sale</button>
                                <p onclick="deleteItem('${item.id}')" style="margin-top:10px; font-size:11px; color:#bbb; cursor:pointer;">Delete</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            container.appendChild(section);
        }
    });
}

// --- 2. CART SYSTEM ---
window.addToCart = (id) => {
    const item = allItems.find(i => i.id === id);
    const existing = cart.find(c => c.id === id);
    if (existing) { existing.qty += 1; } 
    else { cart.push({ ...item, qty: 1 }); }
    updateCartUI();
};

window.updateQty = (id, change) => {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.qty += change;
        if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
    }
    updateCartUI();
};

window.clearCart = () => { cart = []; updateCartUI(); };

function updateCartUI() {
    const cartBar = document.getElementById('cartBar');
    const cartList = document.getElementById('cartItemsList');
    if (cart.length > 0) {
        cartBar.style.display = 'flex';
        document.getElementById('cartCount').innerText = cart.reduce((s, i) => s + i.qty, 0);
        cartList.innerHTML = cart.map(i => `
            <div class="cart-item-tag">
                <span>${i.name}</span>
                <button class="qty-btn" onclick="updateQty('${i.id}', -1)">-</button>
                <span>${i.qty}</span>
                <button class="qty-btn" onclick="updateQty('${i.id}', 1)">+</button>
            </div>
        `).join("");
    } else { cartBar.style.display = 'none'; }
}

// --- 3. CHECKOUT & % DISCOUNT MATH ---
window.openSaleModal = () => {
    document.getElementById('orderId').value = "DK-" + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('saleDate').valueAsDate = new Date();
    updateCheckoutTotals();
    document.getElementById('saleModal').style.display = 'block';
};

function updateCheckoutTotals() {
    const platform = document.getElementById('salePlatform').value;
    const discountPercent = Number(document.getElementById('saleDiscount').value) || 0;
    let subtotal = 0;

    cart.forEach(item => {
        let price = item.prices.dineIn;
        if (platform === "Foodpanda") price = item.prices.foodpanda || price;
        if (platform === "Foodie") price = item.prices.foodie || price;
        subtotal += (price * item.qty);
    });

    const discAmt = (subtotal * discountPercent) / 100;
    const total = subtotal - discAmt;

    document.getElementById('displaySubtotal').innerText = subtotal.toFixed(2);
    document.getElementById('displayTotal').innerText = total.toFixed(2);
}

['salePlatform', 'saleDiscount'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCheckoutTotals);
});

// --- 4. FIREBASE SYNC (SAVE PRODUCT) ---
document.getElementById('menuForm').onsubmit = async (e) => {
    e.preventDefault();
    const newItem = {
        name: document.getElementById('itemName').value,
        img: document.getElementById('imageUrl').value || "",
        category: document.getElementById('itemCategory').value,
        variation: document.getElementById('variation').value,
        prices: {
            dineIn: Number(document.getElementById('basePrice').value),
            foodpanda: document.getElementById('checkFP').checked ? Number(document.getElementById('priceFPValue').value) : null,
            foodie: document.getElementById('checkFoodie').checked ? Number(document.getElementById('priceFoodieValue').value) : null
        },
        createdAt: serverTimestamp()
    };
    await addDoc(menuCol, newItem);
    document.getElementById('addModal').style.display = 'none';
    e.target.reset();
};

// --- 5. FIREBASE SYNC (SAVE SALE) ---
document.getElementById('quickSaleForm').onsubmit = async (e) => {
    e.preventDefault();
    const finalTotal = Number(document.getElementById('displayTotal').innerText);
    const itemSummary = cart.map(i => `${i.name} (${i.variation}) x${i.qty}`).join(", ");
    
    const saleData = {
        orderId: document.getElementById('orderId').value,
        date: document.getElementById('saleDate').value,
        customerName: document.getElementById('customerName').value || "Guest",
        itemName: itemSummary,
        platform: document.getElementById('salePlatform').value,
        paymentType: document.getElementById('paymentType').value,
        totalPrice: finalTotal, // DASHBOARD SYNC
        discountPercent: Number(document.getElementById('saleDiscount').value) || 0,
        subtotal: Number(document.getElementById('displaySubtotal').innerText),
        orderStatus: "Delivered",
        items: cart,
        createdAt: serverTimestamp()
    };

    await addDoc(salesCol, saleData);
    alert("Order Saved!");
    cart = []; updateCartUI(); 
    document.getElementById('saleModal').style.display = 'none';
    e.target.reset();
};

window.deleteItem = (id) => { if(confirm("Delete item?")) deleteDoc(doc(db, "menu", id)); };
document.getElementById('menuSearch').oninput = renderCategorizedMenu;