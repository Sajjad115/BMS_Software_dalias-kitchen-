import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const salesCol = collection(db, "sales");

let allSales = [];

// FETCH DATA WITH FALLBACK (Ensures data shows even without index)
const q = query(salesCol, orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
    allSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    filterAndRender();
}, (error) => {
    console.warn("Index missing, loading unsorted fallback.");
    onSnapshot(salesCol, (snapshot) => {
        allSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        filterAndRender();
    });
});
function filterAndRender() {
    const searchTerm = (document.getElementById('masterSearch').value || "").toLowerCase();
    const platFilter = document.getElementById('platformFilter').value;
    const payFilter = document.getElementById('paymentFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    const filtered = allSales.filter(sale => {
        const sDate = sale.date || "";
        const matchesSearch = (sale.itemName || "").toLowerCase().includes(searchTerm) || 
                               (sale.orderId || "").toLowerCase().includes(searchTerm) ||
                               (sale.customerName || "").toLowerCase().includes(searchTerm);
        const matchesPlat = platFilter === "All" || sale.platform === platFilter;
        const matchesPay = payFilter === "All" || (sale.paymentType || "Cash") === payFilter;
        const matchesDate = (!dateFrom || sDate >= dateFrom) && (!dateTo || sDate <= dateTo);
        return matchesSearch && matchesPlat && matchesPay && matchesDate;
    });

    const tbody = document.getElementById('historyTbody');
    tbody.innerHTML = "";

    filtered.forEach(sale => {
        const paid = Number(sale.totalPrice || 0);
        const disc = Number(sale.discount || 0);
        const qty = Number(sale.quantity || 1);
        
        let comm = 0;
        let platformTax = 0;
        let bankFee = 0;

        // --- PLATFORM CALCULATION RULES ---
        if (sale.platform === "Foodpanda") {
            comm = paid * 0.22;           // 22% Commission
            platformTax = paid * 0.033;    // 3.3% Tax
            bankFee = (sale.paymentType === "Online") ? (paid * 0.015) : 0;
        } else if (sale.platform === "Foodie") {
            comm = paid * 0.20;           // 20% Commission
        }

        // --- DEDUCTION TOTALS ---
        let totalDeduction = disc + comm + platformTax + bankFee;
        let netEarnings = paid - comm - platformTax - bankFee;

        // --- CANCELLATION OVERRIDES ---
        if (sale.orderStatus === "Cancelled by customer") {
            netEarnings = paid * 0.40;
            totalDeduction = paid - netEarnings;
        } else if (sale.orderStatus === "Cancelled by us") {
            netEarnings = -65;
            totalDeduction = paid + 65; 
        }

        const bStyle = sale.orderStatus === "Delivered" ? "Delivered" : (sale.orderStatus?.includes("us") ? "Us" : "Customer");

        tbody.innerHTML += `
            <tr>
                <td>${sale.date || '---'}</td>
                <td><strong>${sale.orderId || '---'}</strong></td>
                <td>${sale.customerName || 'Guest'}</td>
                <td>${sale.itemName} <small>(x${qty})</small></td>
                <td>৳${(paid + disc).toFixed(2)}</td>
                <td style="color:#e67e22">-৳${disc.toFixed(2)}</td>
                <td><span class="plat-tag">${sale.platform || 'Dine-in'}</span></td>
                
                <td style="color:#718096; font-size:11px;">
                    Comm: ৳${comm.toFixed(2)}<br>
                    Tax: ৳${platformTax.toFixed(2)}
                </td>
                <td style="font-weight:bold; color:#e53e3e;">-৳${totalDeduction.toFixed(2)}</td>
                
                <td>${sale.paymentType || 'Cash'}</td>
                <td>${sale.deliveryStatus || 'Not pick up'}</td>
                <td><span class="badge st-${bStyle}">${sale.orderStatus || 'Delivered'}</span></td>
                <td style="font-weight:bold; color:${netEarnings < 0 ? '#e53e3e' : '#2f855a'}">
                    ৳${netEarnings.toFixed(2)}
                </td>
                <td>
                    <i class="fas fa-edit edit-btn" onclick="openEditModal('${sale.id}','${sale.customerName}','${sale.deliveryStatus}','${sale.orderStatus}')"></i>
                    <i class="fas fa-trash delete-btn" onclick="deleteSale('${sale.id}')"></i>
                </td>
            </tr>
        `;
    });
}

// Event Listeners for Filters
['masterSearch', 'platformFilter', 'paymentFilter', 'dateFrom', 'dateTo'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.oninput = filterAndRender;
        el.onchange = filterAndRender;
    }
});

// Edit & Delete Logic
window.openEditModal = (id, cust, del, ord) => {
    document.getElementById('editDocId').value = id;
    document.getElementById('editCustomer').value = cust;
    document.getElementById('editDelivery').value = del;
    document.getElementById('editOrder').value = ord;
    document.getElementById('editModal').style.display = 'block';
};

document.getElementById('saveEditBtn').onclick = async () => {
    const id = document.getElementById('editDocId').value;
    try {
        await updateDoc(doc(db, "sales", id), {
            customerName: document.getElementById('editCustomer').value,
            deliveryStatus: document.getElementById('editDelivery').value,
            orderStatus: document.getElementById('editOrder').value
        });
        document.getElementById('editModal').style.display = 'none';
    } catch (e) { alert("Error: " + e.message); }
};

window.deleteSale = async (id) => {
    if(confirm("Permanently delete this record?")) await deleteDoc(doc(db, "sales", id));
};