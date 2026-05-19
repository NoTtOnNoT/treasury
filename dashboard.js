import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// คอนฟิกเชื่อมโยงกับโปรเจกต์คลาวด์เดิมของคุณ
const firebaseConfig = {
    apiKey: "AIzaSyDg3OY7bSroS76kKIaB8YxEEvdrZAuhn0Q",
    authDomain: "kc-smart-6e44d.firebaseapp.com",
    databaseURL: "https://kc-smart-6e44d-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "kc-smart-6e44d",
    storageBucket: "kc-smart-6e44d.firebasestorage.app",
    messagingSenderId: "1042713591777",
    appId: "1:1042713591777:web:33a8400b8e78d1dca55ca0"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let localStudents = {};
let localDailyTargets = {};
let localExpenses = {};

// แสดงวันปัจจุบัน
document.getElementById('current-date-sync').innerText = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

/* ==========================================================================
   1. DATABASE SYNC & CALCULATION (ดึงข้อมูลคลาวด์และประมวลผลยอดเงินรวม)
   ========================================================================== */
onValue(ref(db, 'system_config/daily_targets'), (snapshot) => {
    localDailyTargets = snapshot.val() || {};
    calculateAndRender();
});

onValue(ref(db, 'students'), (snapshot) => {
    localStudents = snapshot.val() || {};
    calculateAndRender();
});

onValue(ref(db, 'expenses_categories'), (snapshot) => {
    localExpenses = snapshot.val() || {};
    calculateAndRender();
});

function calculateAndRender() {
    if (Object.keys(localStudents).length === 0) return;

    let totalIncome = 0;
    let totalExpense = 0;
    const container = document.getElementById('student-summary-list');
    if (!container) return;
    container.innerHTML = '';

    // คำนวณรายจ่ายสุทธิทั้งหมดในคลังห้อง
    Object.values(localExpenses).forEach(category => {
        if (category.sub_items) {
            Object.values(category.sub_items).forEach(item => {
                totalExpense += parseFloat(item.amount || 0);
            });
        }
    });

    // เรียงลำดับนักเรียนตามเลขที่ 1-28
    const sortedStudents = Object.entries(localStudents).sort((a, b) => a[1].id - b[1].id);

    sortedStudents.forEach(([studentKey, student]) => {
        let studentTotalPaid = 0;

        // วนลูปคำนวณเงินสะสมเฉพาะของเด็กคนนี้ โดยอ้างอิงตามเกณฑ์เงินในแต่ละวันที่มีประวัติการจ่าย
        if (student.attendance) {
            Object.entries(student.attendance).forEach(([dateKey, status]) => {
                if (status === 'paid') {
                    const historicalTarget = localDailyTargets[dateKey] || 0;
                    studentTotalPaid += historicalTarget;
                }
            });
        }
        
        totalIncome += studentTotalPaid; // รวมเข้ายอดรวมทั้งหมดของห้อง

        // เรนเดอร์แถวตารางรายชื่อนักเรียน
        const tr = document.createElement('tr');
        tr.id = `row-std-${studentKey}`;
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="p-4 text-center font-bold text-slate-400">${student.id}</td>
            <td class="p-4 font-semibold text-slate-900">${student.name}</td>
            <td class="p-4 text-right font-black text-emerald-600">฿${studentTotalPaid.toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
            <td class="p-4 text-center no-print">
                <button onclick="openModal('${studentKey}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-indigo-100 cursor-pointer">
                    <i class="fas fa-search-dollar mr-1"></i> ดูประวัติแยกวัน
                </button>
            </td>
        `;
        container.appendChild(tr);
    });

    // แสดงยอดเงินในกล่องสรุปด้านบนสุด
    const balance = totalIncome - totalExpense;
    document.getElementById('teacher-balance').innerText = balance.toLocaleString('th-TH', {minimumFractionDigits: 2});
    document.getElementById('teacher-income').innerText = totalIncome.toLocaleString('th-TH', {minimumFractionDigits: 2});
    document.getElementById('teacher-expense').innerText = totalExpense.toLocaleString('th-TH', {minimumFractionDigits: 2});
}

/* ==========================================================================
   2. DETAILED MODAL LOGIC (ระบบป๊อปอัปสแกนประวัติจ่าย/ค้างรายวัน)
   ========================================================================== */
window.openModal = function(studentKey) {
    const student = localStudents[studentKey];
    if (!student) return;

    document.getElementById('modal-student-name').innerText = `👤 ${student.name}`;
    document.getElementById('modal-student-id').innerText = `เลขที่: ${student.id} · รหัสคลาวด์: ${studentKey}`;

    let historyRowsHTML = '';
    let totalPaidCount = 0;
    let totalUnpaidCount = 0;

    // ดึงปฏิทินทุกวันที่เคยตั้งเกณฑ์การเก็บเงินทั้งหมด เรียงจากใหม่ไปเก่า
    const allConfiguredDates = Object.keys(localDailyTargets).sort().reverse();

    if (allConfiguredDates.length === 0) {
        historyRowsHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400">ยังไม่มีการตั้งเป้าหมายในระบบ</td></tr>`;
    } else {
        allConfiguredDates.forEach(dateKey => {
            const dayAmount = localDailyTargets[dateKey] || 0;
            const status = (student.attendance && student.attendance[dateKey]) ? student.attendance[dateKey] : "unpaid";

            if (status === 'paid') {
                totalPaidCount++;
            } else {
                totalUnpaidCount++;
            }

            historyRowsHTML += `
                <tr class="${status === 'paid' ? 'bg-emerald-50/20' : 'bg-rose-50/20'}">
                    <td class="p-2.5 font-medium text-slate-700">${formatThaiDate(dateKey)}</td>
                    <td class="p-2.5 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                            ${status === 'paid' ? '✓ จ่ายแล้ว' : '✗ ยังไม่จ่าย'}
                        </span>
                    </td>
                    <td class="p-2.5 text-right font-bold ${status === 'paid' ? 'text-emerald-600' : 'text-rose-500'}">
                        ฿${dayAmount.toFixed(2)}
                    </td>
                </tr>
            `;
        });
    }

    document.getElementById('modal-stat-paid').innerText = `${totalPaidCount} ครั้ง`;
    document.getElementById('modal-stat-unpaid').innerText = `${totalUnpaidCount} รอบวัน`;
    document.getElementById('modal-history-rows').innerHTML = historyRowsHTML;

    document.getElementById('student-modal').classList.remove('hidden');
}

window.closeModal = function() {
    document.getElementById('student-modal').classList.add('hidden');
}

/* ==========================================================================
   3. UTILITIES & SEARCH FILTERS (ระบบการค้นหาและจัดรูปแบบเสริม)
   ========================================================================== */
window.filterStudents = function() {
    const term = document.getElementById('search-student').value.toLowerCase();
    Object.entries(localStudents).forEach(([studentKey, student]) => {
        const row = document.getElementById(`row-std-${studentKey}`);
        if (row) {
            const match = student.name.toLowerCase().includes(term) || String(student.id).includes(term);
            row.style.display = match ? '' : 'none';
        }
    });
}

function formatThaiDate(dateString) {
    return new Date(dateString).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}