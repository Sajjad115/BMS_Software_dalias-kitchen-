import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const purCol = collection(db, "purchases");

let allPurchases = []; // Hold data for filtering

// --- 1. FETCH & DISPLAY DATA WITH FILTER ---
onSnapshot(query(purCol, orderBy("date", "desc")), (snapshot) => {
    allPurchases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderTable(); // Initial draw
});

function renderTable() {
    const tbody = document.getElementById('purchaseTbody');
    const filterDate = document.getElementById('filterDate').value; // Get value from your date input
    if (!tbody) return;
    
    tbody.innerHTML = "";
    let totalP = 0;
    let totalD = 0;

    // Filter logic
    const filteredData = allPurchases.filter(p => {
        if (!filterDate) return true; // If no date selected, show all
        return p.date === filterDate; // Compare YYYY-MM-DD
    });

    filteredData.forEach(p => {
        const id = p.id;
        const paid = Number(p.paidAmount) || 0;
        const due = Number(p.dueAmount) || 0;
        const total = Number(p.totalPrice) || 0;
        const uPrice = Number(p.unitPrice) || 0;

        totalP += paid;
        totalD += due;

        tbody.innerHTML += `
            <tr>
                <td>${p.date || 'N/A'}</td>
                <td>${p.buyFrom || 'Unknown'}</td>
                <td>${p.quantity || 0} ${p.unit || ''} ${p.itemName || 'Item'}</td>
                <td>৳${uPrice.toFixed(2)}</td>
                <td>৳${total.toFixed(2)}</td>
                <td>৳${paid.toFixed(2)}</td>
                <td style="color:${due > 0 ? 'red' : 'green'}; font-weight:bold;">৳${due.toFixed(2)}</td>
                <td><span class="status-badge ${due <= 0 ? 'bg-paid' : 'bg-due'}">${due <= 0 ? 'Paid' : 'Due'}</span></td>
                <td>
                    <button class="btn-pay" onclick="payDue('${id}', ${due}, ${paid})">Pay</button>
                    <button style="border:none; background:none; color:red; cursor:pointer; margin-left:10px;" onclick="deleteRecord('${id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    // Update Summary Cards based on filtered results
    const paidEl = document.getElementById('totalPaidText');
    const dueEl = document.getElementById('totalDueText');
    if (paidEl) paidEl.innerText = `৳${totalP.toLocaleString()}`;
    if (dueEl) dueEl.innerText = `৳${totalD.toLocaleString()}`;
}

// Add event listener to your date input so it filters as you pick a date
document.getElementById('filterDate').addEventListener('change', renderTable);

// --- 2. UPDATE DUE PAYMENTS ---
window.payDue = async (id, currentDue, currentPaid) => {
    if (currentDue <= 0) return alert("Already fully paid!");
    
    const val = prompt(`Current Due: ৳${currentDue}. Enter amount to pay:`);
    if (!val || isNaN(val)) return;
    
    const amountToPay = Number(val);
    if (amountToPay > currentDue) return alert("You cannot pay more than the due amount!");

    try {
        const docRef = doc(db, "purchases", id);
        await updateDoc(docRef, {
            paidAmount: currentPaid + amountToPay,
            dueAmount: currentDue - amountToPay
        });
        alert("Payment Updated!");
    } catch (err) {
        alert("Error updating payment: " + err.message);
    }
};

// --- 3. DELETE RECORD ---
window.deleteRecord = async (id) => {
    if (confirm("Are you sure you want to delete this purchase record?")) {
        try {
            await deleteDoc(doc(db, "purchases", id));
        } catch (err) {
            alert("Error deleting: " + err.message);
        }
    }
};