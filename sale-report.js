import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Global variables to store data for filtering and downloading
let allRawSales = []; 
let dailySummaryData = [];

// --- 1. DATA FETCHING ---
onSnapshot(query(collection(db, "sales"), orderBy("date", "desc")), (snapshot) => {
    allRawSales = snapshot.docs.map(doc => doc.data());
    dailySummaryData = groupSalesByDate(allRawSales);
    renderReportTable(dailySummaryData);
});

// --- 2. GROUPING & CALCULATION LOGIC ---
function groupSalesByDate(sales) {
    const report = {};

    sales.forEach(sale => {
        const date = sale.date || "Unknown";
        
        if (!report[date]) {
            report[date] = {
                date: date,
                totalSold: 0,
                totalCancel: 0,
                foodpanda: 0,
                foodie: 0,
                revenue: 0,
                earnings: 0
            };
        }

        const price = Number(sale.totalPrice || 0);
        const qty = Number(sale.quantity || 1);
        const platform = sale.platform || "Dine-in";
        const status = sale.orderStatus || "Delivered";

        if (status.includes("Cancelled")) {
            report[date].totalCancel += 1;
        } else {
            report[date].totalSold += qty;
        }

        if (platform === "Foodpanda") report[date].foodpanda += price;
        else if (platform === "Foodie") report[date].foodie += price;
        
        report[date].revenue += price;

        let saleEarn = price;
        if (platform === "Foodpanda") {
            const disc = price * 0.15; 
            const comm = price * 0.22;
            const tax = price * 0.033;
            const bank = (sale.paymentType === "Online") ? (price * 0.015) : 0;
            saleEarn = price - disc - comm - tax - bank;
        } else if (platform === "Foodie") {
            saleEarn = price - (price * 0.20);
        }

        if (status === "Cancelled by customer") saleEarn = price * 0.40;
        else if (status === "Cancelled by us") saleEarn = -65;

        report[date].earnings += saleEarn;
    });

    return Object.values(report);
}

// --- 3. RENDER TABLE ---
function renderReportTable(data) {
    const tbody = document.getElementById('reportTbody');
    const searchTerm = document.getElementById('reportSearch').value.toLowerCase();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    tbody.innerHTML = "";

    const filtered = data.filter(day => {
        const matchesSearch = day.date.toLowerCase().includes(searchTerm);
        const matchesDate = (!startDate || day.date >= startDate) && (!endDate || day.date <= endDate);
        return matchesSearch && matchesDate;
    });

    filtered.forEach(day => {
        tbody.innerHTML += `
            <tr>
                <td style="font-weight:bold;">${day.date}</td>
                <td>${day.totalSold}</td>
                <td style="color: ${day.totalCancel > 0 ? '#e67e22' : '#333'}">${day.totalCancel}</td>
                <td>৳${day.foodpanda.toFixed(0)}</td>
                <td>৳${day.foodie.toFixed(0)}</td>
                <td style="font-weight:bold;">৳${day.revenue.toFixed(0)}</td>
                <td style="font-weight:bold; color:#2f855a;">৳${day.earnings.toFixed(0)}</td>
                <td>
                    <button class="download-btn" onclick="downloadDailyReport('${day.date}')">
                        <i class="fas fa-file-pdf"></i> download
                    </button>
                </td>
            </tr>
        `;
    });
}

// --- 4. DOWNLOAD INDIVIDUAL DAY DATA ---
window.downloadDailyReport = (targetDate) => {
    const dayOrders = allRawSales.filter(sale => sale.date === targetDate);
    
    const reportWindow = window.open('', '_blank');
    let html = `
        <html>
        <head>
            <title>Dalia's Kitchen Report - ${targetDate}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333; }
                h1 { color: #e67e22; margin-bottom: 5px; }
                .meta { margin-bottom: 20px; color: #666; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { background: #f8f9fa; color: #555; text-align: left; }
                th, td { padding: 12px; border: 1px solid #eee; font-size: 13px; }
                .total-box { margin-top: 20px; text-align: right; font-size: 18px; font-weight: bold; color: #2f855a; }
            </style>
        </head>
        <body>
            <h1>Daily Order Details</h1>
            <div class="meta">Date: ${targetDate} | Dalia's Kitchen Management System</div>
            <table>
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Item Name</th>
                        <th>Platform</th>
                        <th>Status</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let totalRev = 0;
    dayOrders.forEach(order => {
        totalRev += Number(order.totalPrice || 0);
        html += `
            <tr>
                <td>${order.orderId}</td>
                <td>${order.customerName}</td>
                <td>${order.itemName} (x${order.quantity})</td>
                <td>${order.platform}</td>
                <td>${order.orderStatus}</td>
                <td>৳${Number(order.totalPrice).toFixed(2)}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div class="total-box">Daily Total Revenue: ৳${totalRev.toFixed(2)}</div>
            <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

// --- 5. FILTERS & SEARCH (Optimized) ---
document.getElementById('reportSearch').oninput = () => renderReportTable(dailySummaryData);
document.getElementById('startDate').onchange = () => renderReportTable(dailySummaryData);
document.getElementById('endDate').onchange = () => renderReportTable(dailySummaryData);

// --- 6. SIDEBAR ACTIVE STATE ---
window.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname.split("/").pop();
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === currentPath);
    });
});