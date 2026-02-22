// --- ADMIN LOGIN GATEKEEPER ---
(function() {
    const USERNAME = "chrd";
    const PASSWORD = "dalia24";
    const AUTH_KEY = "dk_admin_session";

    // If already logged in for this session, do not show the login box
    if (sessionStorage.getItem(AUTH_KEY) === "true") return;

    // 1. Inject CSS for the Login Screen
    const style = document.createElement('style');
    style.innerHTML = `
        #adminLoginOverlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #2c3e50; display: flex; align-items: center; justify-content: center;
            z-index: 999999; font-family: 'Segoe UI', Arial, sans-serif;
        }
        .login-card {
            background: white; padding: 40px; border-radius: 12px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.2); width: 350px; text-align: center;
        }
        .login-card h2 { color: #e67e22; margin-top: 0; margin-bottom: 25px; }
        .login-card input {
            width: 100%; padding: 12px; margin: 10px 0;
            border: 2px solid #eee; border-radius: 8px; box-sizing: border-box;
            outline: none; transition: border-color 0.3s;
        }
        .login-card input:focus { border-color: #e67e22; }
        .login-card button {
            width: 100%; padding: 12px; background: #e67e22; color: white;
            border: none; border-radius: 8px; cursor: pointer; font-weight: bold; 
            margin-top: 20px; font-size: 16px;
        }
        .login-card button:hover { background: #d35400; }
        #loginError { color: #e74c3c; font-size: 14px; margin-top: 15px; display: none; }
    `;
    document.head.appendChild(style);

    // 2. Inject the Login Box into the Body
    const overlay = document.createElement('div');
    overlay.id = "adminLoginOverlay";
    overlay.innerHTML = `
        <div class="login-card">
            <h2>Dalia's Kitchen Login</h2>
            <input type="text" id="adminUser" placeholder="Username">
            <input type="password" id="adminPass" placeholder="Password">
            <button id="loginBtn">Enter Dashboard</button>
            <p id="loginError">Incorrect Username or Password!</p>
        </div>
    `;
    document.body.appendChild(overlay);

    // 3. Handle Login Action
    const handleLogin = () => {
        const u = document.getElementById('adminUser').value;
        const p = document.getElementById('adminPass').value;
        const err = document.getElementById('loginError');

        if (u === USERNAME && p === PASSWORD) {
            sessionStorage.setItem(AUTH_KEY, "true");
            overlay.remove(); // Unlocks the page
        } else {
            err.style.display = "block";
            // Shake effect for wrong password
            overlay.querySelector('.login-card').style.transform = 'translateX(10px)';
            setTimeout(() => overlay.querySelector('.login-card').style.transform = 'translateX(0)', 100);
        }
    };

    document.getElementById('loginBtn').onclick = handleLogin;
    
    // Support "Enter" key to login
    window.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
})();



import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAewggG20g0ZlJvyYPTYSaIWfr4UKrUbNg",
    authDomain: "dalias-kitchen.firebaseapp.com",
    projectId: "dalias-kitchen",
    storageBucket: "dalias-kitchen.firebasestorage.app",
    messagingSenderId: "430311800072",
    appId: "1:430311800072:web:71ae6900ed96324cca40bd",
    measurementId: "G-KZF51YVGVB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let salesChart = null;

// Lock Chart.js to be static and non-animated
if (window.Chart) {
    Chart.defaults.animation = false;
    Chart.defaults.maintainAspectRatio = false;
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    const filterBtn = document.getElementById('filterBtn');
    if(filterBtn) filterBtn.onclick = loadDashboard;
});

async function loadDashboard() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    const [salesSnap, menuSnap, purSnap] = await Promise.all([
        getDocs(collection(db, "sales")),
        getDocs(collection(db, "menu")),
        getDocs(collection(db, "purchases"))
    ]);

    document.getElementById('liveItems').innerText = menuSnap.size;

    let metrics = { sell: 0, other: 0, success: 0, cancel: 0, items: {} };
    let chartData = new Array(31).fill(0);
    const now = new Date();

    salesSnap.forEach(doc => {
        const data = doc.data();
        const saleDate = new Date(data.date);
        const inRange = (!startDate || data.date >= startDate) && (!endDate || data.date <= endDate);

        if (inRange) {
            const paid = Number(data.totalPrice || 0);
            const disc = Number(data.discount || 0);

            if (data.orderStatus === "Delivered") {
                metrics.success++;
                metrics.sell += paid;

                // --- PLATFORM DEDUCTION MATH ---
                let comm = 0, platformTax = 0, bankFee = 0;
                if (data.platform === "Foodpanda") {
                    comm = paid * 0.22;           
                    platformTax = paid * 0.033;    
                    bankFee = (data.paymentType === "Online") ? (paid * 0.015) : 0;
                } else if (data.platform === "Foodie") {
                    comm = paid * 0.20;           
                }
                metrics.other += (disc + comm + platformTax + bankFee);

                if (saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear()) {
                    chartData[saleDate.getDate() - 1] += paid;
                }

                // --- ITEM PERFORMANCE LOGIC (HANDLING STRINGS LIKE "Haleem x5") ---
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach(item => {
                        const itemName = item.name || data.itemName || "Unknown Item";
                        if (!metrics.items[itemName]) {
                            metrics.items[itemName] = { qty: 0, earned: 0 };
                        }
                        
                        // Parse Quantity: Check item.qty, or extract "x5" from name
                        let itemQty = Number(item.qty);
                        if (isNaN(itemQty) || itemQty <= 0) {
                            const match = String(itemName).match(/x(\d+)/);
                            itemQty = match ? Number(match[1]) : 1;
                        }
                        
                        // Parse Price: Use item.price or calculate from order total
                        let itemPrice = Number(item.price);
                        if (isNaN(itemPrice) || itemPrice <= 0) {
                            itemPrice = paid / itemQty;
                        }
                        
                        metrics.items[itemName].qty += itemQty;
                        // Calculation: Quantity * Price
                        metrics.items[itemName].earned += (itemQty * itemPrice);
                    });
                }
            } 
            else if (data.orderStatus === "Cancelled by customer") {
                metrics.cancel++;
                metrics.sell += (paid * 0.40); 
            } else if (data.orderStatus === "Cancelled by us") {
                metrics.cancel++;
                metrics.sell -= 65;
            }
        }
    });

    // --- PURCHASE COST MATH ---
    let rawCost = 0;
    purSnap.forEach(doc => {
        const p = doc.data();
        if ((!startDate || p.date >= startDate) && (!endDate || p.date <= endDate)) {
            rawCost += Number(p.paidAmount || 0);
        }
    });

    const netProfit = metrics.sell - rawCost - metrics.other;

    // --- UI UPDATES ---
    document.getElementById('totalSell').innerText = `৳${Math.round(metrics.sell).toLocaleString()}`;
    document.getElementById('totalCost').innerText = `৳${Math.round(rawCost).toLocaleString()}`;
    document.getElementById('otherCost').innerText = `৳${Math.round(metrics.other).toLocaleString()}`;
    
    const profitEl = document.getElementById('totalProfit');
    profitEl.innerText = `৳${Math.round(netProfit).toLocaleString()}`;
    profitEl.style.color = netProfit < 0 ? "#e74c3c" : "#27ae60";

    document.getElementById('successOrders').innerText = metrics.success;
    document.getElementById('cancelOrders').innerText = metrics.cancel;

    // Target Progress (50k)
    const targetValue = 50000;
    const progressPercent = Math.min((metrics.sell / targetValue) * 100, 100);
    const progressBar = document.getElementById('targetProgress');
    if(progressBar) {
        progressBar.style.width = `${progressPercent}%`;
        progressBar.innerText = `${Math.round(progressPercent)}%`;
    }

    updateItemTable(metrics.items);
    renderStaticChart(chartData);
}

function updateItemTable(items) {
    const tbody = document.getElementById('itemTableBody');
    if (!tbody) return;
    
    // Sort by Total Earned
    const sortedItems = Object.entries(items).sort((a, b) => b[1].earned - a[1].earned);
    
    tbody.innerHTML = sortedItems.map(([name, data]) => `
        <tr>
            <td><strong>${name}</strong></td>
            <td>${data.qty}</td>
            <td>৳${Math.round(data.earned).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderStaticChart(dataPoints) {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (salesChart) salesChart.destroy();

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 31}, (_, i) => i + 1),
            datasets: [{
                label: 'Revenue',
                data: dataPoints,
                borderColor: '#e67e22',
                borderWidth: 2,
                tension: 0, 
                fill: false,
                pointRadius: 4,
                pointBackgroundColor: '#e67e22'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, 
            events: [], 
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => '৳' + v } },
                x: { grid: { display: false } }
            }
        }
    });
}
