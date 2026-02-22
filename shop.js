import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const invCol = collection(db, "inventory");
const purCol = collection(db, "purchases");

let inventoryItems = [];

// --- 1. RENDER GROUPED SHOP ---
onSnapshot(query(invCol, orderBy("createdAt", "desc")), (snapshot) => {
    inventoryItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCategorizedShop();
});

function renderCategorizedShop() {
    const container = document.getElementById('shopContainer');
    const search = document.getElementById('shopSearch').value.toLowerCase();
    container.innerHTML = "";

    const categories = ["Grain", "Meats & fish", "Vegetables", "Spices", "Packages", "Others"];

    categories.forEach(cat => {
        const filtered = inventoryItems.filter(item => 
            item.category === cat && 
            item.name.toLowerCase().includes(search)
        );

        if (filtered.length > 0) {
            const section = document.createElement('div');
            section.className = 'cat-section';
            section.innerHTML = `
                <h2 class="cat-heading">${cat}</h2>
                <div class="shop-grid">
                    ${filtered.map(item => `
                        <div class="shop-card">
                            <img src="${item.img}" class="item-img" onerror="this.src='https://via.placeholder.com/150'">
                            <span class="item-name">${item.name}</span>
                            <button class="btn-purchase" onclick="openPurchaseModal('${item.name}')">Click to purchase</button>
                            <button class="btn-delete" onclick="deleteItem('${item.id}')">Delete</button>
                        </div>
                    `).join('')}
                </div>
            `;
            container.appendChild(section);
        }
    });
}

// --- 2. ADD PRODUCT TEMPLATE ---
document.getElementById('openAddModal').onclick = () => document.getElementById('addModal').style.display = 'block';

document.getElementById('shopForm').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('prodName').value,
        img: document.getElementById('prodImg').value,
        category: document.getElementById('prodCat').value,
        createdAt: serverTimestamp()
    };
    await addDoc(invCol, data);
    document.getElementById('addModal').style.display = 'none';
    e.target.reset();
};

window.deleteItem = async (id) => {
    if(confirm("Delete this item?")) await deleteDoc(doc(db, "inventory", id));
};

// --- 3. PURCHASE & MATH SYNC ---
window.openPurchaseModal = (name) => {
    document.getElementById('purTitle').innerText = "Buy: " + name;
    document.getElementById('purItemName').value = name;
    document.getElementById('purDate').valueAsDate = new Date();
    document.getElementById('purchaseModal').style.display = 'block';
};

const runCalculations = () => {
    const q = Number(document.getElementById('purQty').value) || 0;
    const p = Number(document.getElementById('purPriceUnit').value) || 0;
    const paid = Number(document.getElementById('purPay').value) || 0;
    const total = q * p;
    const due = total - paid;
    
    document.getElementById('purTotal').innerText = total.toFixed(2);
    document.getElementById('purDue').innerText = due.toFixed(2);
    document.getElementById('purDue').style.color = due > 0 ? "red" : "green";
};

['purQty', 'purPriceUnit', 'purPay'].forEach(id => {
    document.getElementById(id).addEventListener('input', runCalculations);
});

document.getElementById('purchaseForm').onsubmit = async (e) => {
    e.preventDefault();
    const q = Number(document.getElementById('purQty').value);
    const p = Number(document.getElementById('purPriceUnit').value);
    const paid = Number(document.getElementById('purPay').value);
    const total = q * p;

    const purRecord = {
        itemName: document.getElementById('purItemName').value,
        buyFrom: document.getElementById('purSource').value,
        date: document.getElementById('purDate').value,
        quantity: q,
        unit: document.getElementById('purUnit').value,
        unitPrice: p,
        totalPrice: total,
        paidAmount: paid,
        dueAmount: total - paid,
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(purCol, purRecord);
        alert("Success! Dashboard Updated.");
        document.getElementById('purchaseModal').style.display = 'none';
        e.target.reset();
    } catch (err) { alert("Error: " + err.message); }
};

document.getElementById('shopSearch').oninput = renderCategorizedShop;