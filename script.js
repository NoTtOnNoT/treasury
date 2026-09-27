/* ==========================================================================
   APPLICATION CENTRALIZED MANAGEMENT SYSTEM (script.js)
   Compatible with Firebase Web SDK v10 (Realtime Database)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. FIREBASE CONFIGURATION
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

// Admin session is remembered in the selected browser storage.
// This is a UI gate only; RTDB rules cannot verify a client-side session flag.
const authorized = localStorage.getItem('admin_session') === 'authenticated' ||
    sessionStorage.getItem('admin_session') === 'authenticated';
if (!authorized) location.replace('/login');

// 3. DATABASE REFERENCE DECLARATIONS
const dbStudentsRef = ref(db, 'students');
const dbExpensesRef = ref(db, 'expenses_categories');
const dbLogsRef = ref(db, 'transaction_logs');
const dbTargetsRef = ref(db, 'system_config/daily_targets');
const dbHomeworkRef = ref(db, 'homework_logs'); 

// 4. LOCAL STATES STATE MANAGEMENT
let localStudents = {};
let localExpenses = {};
let localLogs = [];
let localDailyTargets = {};
let localHomeworks = {}; 

// วันที่ตั้งต้นการทำงาน (ยึดปีปัจจุบันตามที่กำหนดระบบควบคุม 2026)
let selectedDate = new Date().toISOString().split('T')[0]; 

/* ==========================================================================
   CORE INITIALIZATION FUNCTION
   ========================================================================== */
function initTreasuryApp() {
    if (!authorized || initTreasuryApp.started) return;
    initTreasuryApp.started = true;
    // ตั้งค่าปฏิทินหน้าจอให้เป็นวันปัจจุบันเริ่มต้น
    const dateInput = document.getElementById('config-date-picker');
    if(dateInput) {
        dateInput.value = selectedDate;
        dateInput.addEventListener('change', (e) => {
            selectedDate = e.target.value;
            updateDateContext();
        });
    }

    // ผูกปุ่มบันทึกเกณฑ์เรียกเก็บเงินสดประจำวันที่เลือก
    document.getElementById('btn-set-target')?.addEventListener('click', () => {
        const inputTarget = document.getElementById('input-target-amount');
        const amount = parseFloat(inputTarget.value);
        if(isNaN(amount) || amount < 0) return alert('กรุณากรอกจำนวนเงินที่ถูกต้อง');
        
        set(ref(db, `system_config/daily_targets/${selectedDate}`), amount).then(() => {
            alert(`ตั้งเป้าหมายเงินเก็บวันที่ ${formatThaiDate(selectedDate)} สำเร็จ!`);
        });
    });

    // ผูกเหตุการณ์ตอนส่งฟอร์มสร้างกลุ่มกิจกรรมใหม่
    document.getElementById('main-expense-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('main-expense-title');
        if (!input || !input.value.trim()) return;
        const newCatRef = push(dbExpensesRef);
        set(newCatRef, { title: input.value.trim(), id: newCatRef.key });
        input.value = '';
    });

    // ผูกเหตุการณ์ฟอร์มบันทึกการบ้านประจำวัน (สำหรับฝั่งเลขาแอดมิน)
    document.getElementById('homework-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const subject = document.getElementById('hw-subject')?.value.trim();
        const detail = document.getElementById('hw-detail')?.value.trim();
        const dueDate = document.getElementById('hw-due-date')?.value;

        if (!subject || !detail || !dueDate) return alert('กรุณากรอกข้อมูลการบ้านให้ครบถ้วน');

        const newHwRef = push(dbHomeworkRef);
        set(newHwRef, {
            id: newHwRef.key,
            subject: subject,
            detail: detail,
            assignDate: selectedDate, 
            dueDate: dueDate
        }).then(() => {
            alert('ประกาศการบ้านใหม่เข้าระบบสำเร็จ! 📄');
            e.target.reset();
        });
    });

    // ระบบควบคุมเปิด-ปิด Sidebar สำหรับการใช้งานบนจอมือถือ
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuToggle && sidebar && overlay) {
        const toggleMobileMenu = () => {
            sidebar.classList.toggle('-translate-x-full');
            overlay.classList.toggle('hidden');
        };
        menuToggle.addEventListener('click', toggleMobileMenu);
        overlay.addEventListener('click', toggleMobileMenu);
    }

    // โหลดข้อมูลเกณฑ์เงินรายวันทั้งหมด
    onValue(dbTargetsRef, (snapshot) => {
        localDailyTargets = snapshot.val() || {};
        updateDateContext();
    });

    // โหลดข้อมูลนักเรียน
    onValue(dbStudentsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            let initialStudents = {};
            const startStudentId = 27648; 
            for (let i = 1; i <= 28; i++) {
                const currentStudentId = startStudentId + (i - 1);
                initialStudents[`${currentStudentId}`] = {
                    id: i,
                    name: `นักเรียน เลขที่ ${i}`,
                    attendance: {} 
                };
            }
            set(dbStudentsRef, initialStudents);
        } else {
            localStudents = data;
            renderStudentList();
            calculateSummary();
        }
    });

    // โหลดรายจ่าย
    onValue(dbExpensesRef, (snapshot) => {
        localExpenses = snapshot.val() || {};
        renderExpenseCategories();
        calculateSummary();
    });

    // โหลด Logs
    onValue(dbLogsRef, (snapshot) => {
        const data = snapshot.val() || {};
        localLogs = Object.values(data).reverse();
    });

    // โหลดข้อมูลการบ้าน Real-time
    onValue(dbHomeworkRef, (snapshot) => {
        localHomeworks = snapshot.val() || {};
        renderHomeworkAdmin();   
        renderHomeworkStudent(); 
    });
}

/* ==========================================================================
   UI CONTEXT & CALCULATION FUNCTIONS
   ========================================================================== */
function updateDateContext() {
    const currentTarget = localDailyTargets[selectedDate] || 0;
    
    const elTargetDisplay = document.getElementById('today-target-display');
    const elTotalTargetDisplay = document.getElementById('today-total-target');
    const elInputTarget = document.getElementById('input-target-amount');
    const elContextTitle = document.getElementById('current-date-context-title');

    if(elTargetDisplay) elTargetDisplay.innerText = currentTarget.toFixed(2);
    if(elTotalTargetDisplay) elTotalTargetDisplay.innerText = (currentTarget * 28).toFixed(2);
    if(elInputTarget) elInputTarget.value = currentTarget;
    if(elContextTitle) elContextTitle.innerText = formatThaiDate(selectedDate);

    renderStudentList();
    calculateSummary();
}

function calculateSummary() {
    let totalIncome = 0;
    let totalExpense = 0;
    let studentsWhoPaidToday = 0;

    // 1. คำนวณรายรับทั้งหมด และนับจำนวนคนจ่ายของวันที่เลือกปัจจุบัน
    Object.values(localStudents).forEach(student => {
        if (student.attendance) {
            Object.entries(student.attendance).forEach(([dateKey, status]) => {
                if (status === 'paid') {
                    const historicalTarget = localDailyTargets[dateKey] || 0;
                    totalIncome += historicalTarget;
                }
            });
            
            if (student.attendance[selectedDate] === 'paid') {
                studentsWhoPaidToday++;
            }
        }
    });

    // 2. คำนวณรายจ่ายทั้งหมด
    Object.values(localExpenses).forEach(category => {
        if(category.sub_items) {
            Object.values(category.sub_items).forEach(item => {
                totalExpense += parseFloat(item.amount || 0);
            });
        }
    });

    let balance = totalIncome - totalExpense;

    const elBalance = document.getElementById('dash-balance');
    const elIncome = document.getElementById('dash-income');
    const elExpense = document.getElementById('dash-expense');
    const elPercent = document.getElementById('collection-percent');
    const elBar = document.getElementById('collection-bar');

    const elSummaryPaid = document.getElementById('summary-paid-count');
    const elSummaryUnpaid = document.getElementById('summary-unpaid-count');

    if (elBalance) elBalance.innerText = balance.toLocaleString('th-TH', {minimumFractionDigits: 2});
    if (elIncome) elIncome.innerText = totalIncome.toLocaleString('th-TH', {minimumFractionDigits: 2});
    if (elExpense) elExpense.innerText = totalExpense.toLocaleString('th-TH', {minimumFractionDigits: 2});

    if (elSummaryPaid) elSummaryPaid.innerText = studentsWhoPaidToday;
    if (elSummaryUnpaid) elSummaryUnpaid.innerText = 28 - studentsWhoPaidToday;

    let percent = Math.round((studentsWhoPaidToday / 28) * 100) || 0;
    if (elPercent) elPercent.innerText = `${percent}% (จ่ายแล้ว ${studentsWhoPaidToday}/28 คน ของรอบวันที่เลือก)`;
    if (elBar) elBar.style.width = `${percent}%`;

    renderDailyLedgerTable();
}

/* ==========================================================================
   DYNAMIC RENDERING FUNCTIONS (DOM MANIPULATION)
   ========================================================================== */
function renderDailyLedgerTable() {
    const container = document.getElementById('daily-ledger-body');
    if (!container) return;
    container.innerHTML = '';

    const allConfiguredDates = Object.keys(localDailyTargets).sort().reverse();

    if (allConfiguredDates.length === 0) {
        container.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 text-xs">ยังไม่มีการตั้งเป้าหมายเรียกเก็บเงินวันใดๆ ในระบบ</td></tr>`;
        return;
    }

    allConfiguredDates.forEach(dateKey => {
        const targetPerHead = localDailyTargets[dateKey] || 0;
        let dayPaidCount = 0;
        let dayIncome = 0;

        Object.values(localStudents).forEach(student => {
            if (student.attendance && student.attendance[dateKey] === 'paid') {
                dayPaidCount++;
                dayIncome += targetPerHead;
            }
        });

        let remainingCount = 28 - dayPaidCount;
        let isComplete = remainingCount === 0;
        
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition text-xs";
        tr.innerHTML = `
            <td class="p-4 font-medium text-slate-900">${formatThaiDate(dateKey)}</td>
            <td class="p-4 text-center font-bold text-slate-700">฿${targetPerHead.toFixed(2)}</td>
            <td class="p-4 text-right font-bold text-emerald-600">฿${dayIncome.toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
            <td class="p-4 text-center">
                <span class="px-2.5 py-1 rounded-full text-2xs font-bold ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                    ${isComplete ? '🎉 จ่ายครบแล้ว' : `⚠️ เหลืออีก ${remainingCount} คน`}
                </span>
            </td>
        `;
        container.appendChild(tr);
    });
}

function renderStudentList() {
    const container = document.getElementById('student-list');
    if (!container) return;
    container.innerHTML = '';
    
    const targetAmountToday = localDailyTargets[selectedDate] || 0;
    const sortedEntries = Object.entries(localStudents).sort((a, b) => a[1].id - b[1].id);

    sortedEntries.forEach(([studentKey, student]) => {
        const currentStatus = (student.attendance && student.attendance[selectedDate]) ? student.attendance[selectedDate] : "unpaid";
        
        const tr = document.createElement('tr');
        tr.id = `row-std-${studentKey}`;
        tr.className = currentStatus === 'paid' ? "bg-emerald-50/20 hover:bg-emerald-50/40" : "bg-rose-50/30 hover:bg-rose-50/60";
        
        tr.innerHTML = `
            <td class="p-4 cursor-pointer" onclick="openStudentProfileModal('${studentKey}')">
                <div class="font-semibold text-slate-900 hover:text-indigo-600 flex items-center gap-1.5">
                    📄 ${student.name} <i class="fas fa-magnifying-glass-chart text-xs text-slate-400"></i>
                </div>
                <span class="text-xs text-slate-400">เลขที่: ${student.id} · รหัส: ${studentKey}</span>
            </td>
            <td class="p-4 text-center">
                <div class="inline-flex rounded-xl shadow-xs p-1 bg-slate-100" role="group">
                    <button onclick="toggleAttendance('${studentKey}', 'unpaid')" class="px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${currentStatus === 'unpaid' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-600 hover:bg-white/60'}">
                        ❌ ยังไม่จ่าย
                    </button>
                    <button onclick="toggleAttendance('${studentKey}', 'paid')" class="px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${currentStatus === 'paid' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-600 hover:bg-white/60'}">
                        ✅ จ่ายแล้ว
                    </button>
                </div>
            </td>
            <td class="p-4 text-right font-bold ${currentStatus === 'paid' ? 'text-emerald-600' : 'text-rose-600'}">
                ${currentStatus === 'paid' ? `+฿${targetAmountToday.toFixed(2)}` : 'ค้างยอดนี้'}
            </td>
            <td class="p-4 text-center">
                <button onclick="openStudentProfileModal('${studentKey}')" class="text-slate-500 hover:text-indigo-600 bg-slate-50 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer">
                    <i class="fas fa-user-gear mr-1"></i> ดูประวัติแยกวัน
                </button>
            </td>
        `;
        container.appendChild(tr);
    });
}

function renderExpenseCategories() {
    const container = document.getElementById('expense-categories-container');
    if (!container) return;
    container.innerHTML = '';
    Object.values(localExpenses).forEach(category => {
        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between";
        let catSum = 0; let itemsHTML = '';
        if(category.sub_items) {
            Object.entries(category.sub_items).forEach(([subId, item]) => {
                catSum += parseFloat(item.amount);
                itemsHTML += `
                    <div class="flex justify-between items-center py-2 text-xs text-slate-600 border-b border-dashed border-slate-100">
                        <span>• ${item.detail}</span>
                        <div class="space-x-2">
                            <span class="font-bold text-rose-600">-฿${parseFloat(item.amount).toFixed(2)}</span>
                            <button onclick="deleteSubExpense('${category.id}', '${subId}')" class="text-slate-300 hover:text-rose-500 cursor-pointer"><i class="fas fa-trash-can"></i></button>
                        </div>
                    </div>`;
            });
        }
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-3 pb-2 border-b border-slate-100">
                    <div>
                        <h3 class="font-bold text-slate-900 text-base">📂 ${category.title}</h3>
                        <span class="text-xs font-bold text-slate-400">ใช้ไปรวม: ฿${catSum.toLocaleString('th-TH')}</span>
                    </div>
                    <button onclick="deleteMainCategory('${category.id}')" class="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"><i class="fas fa-folder-minus mr-1"></i>ลบกลุ่ม</button>
                </div>
                <div class="space-y-1 mb-4 max-h-40 overflow-y-auto pr-1">${itemsHTML || '<p class="text-2xs text-slate-400 text-center py-4">ยังไม่มีการบันทึกย่อย</p>'}</div>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl space-y-2">
                <input type="text" id="sub-detail-${category.id}" placeholder="ซื้ออะไร? (เช่น ค่าลูกโป่ง)" class="w-full p-2 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none">
                <input type="number" id="sub-amount-${category.id}" placeholder="กี่บาท?" class="w-full p-2 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none">
                <button onclick="addSubExpense('${category.id}')" class="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs py-2 rounded-lg font-semibold transition cursor-pointer">+ บันทึกรายการย่อย</button>
            </div>`;
        container.appendChild(card);
    });
}

function renderHomeworkAdmin() {
    const container = document.getElementById('admin-homework-list');
    if (!container) return; 
    container.innerHTML = '';

    const hwArray = Object.values(localHomeworks).sort((a, b) => new Date(b.assignDate) - new Date(a.assignDate));

    if (hwArray.length === 0) {
        container.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 text-xs">ยังไม่มีการบันทึกการบ้านในระบบ</td></tr>`;
        return;
    }

    hwArray.forEach(hw => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition text-xs border-b border-slate-100";
        tr.innerHTML = `
            <td class="p-4 font-medium text-slate-900">${formatThaiDate(hw.assignDate)}</td>
            <td class="p-4 font-bold text-indigo-600">${hw.subject}</td>
            <td class="p-4 text-slate-600 whitespace-pre-line">${hw.detail}</td>
            <td class="p-4 font-bold text-rose-600">${formatThaiDate(hw.dueDate)}</td>
            <td class="p-4 text-center">
                <button onclick="deleteHomework('${hw.id}')" class="text-rose-500 hover:text-rose-700 font-bold p-1 cursor-pointer">
                    <i class="fas fa-trash-can mr-1"></i> ลบ
                </button>
            </td>
        `;
        container.appendChild(tr);
    });
}

function renderHomeworkStudent() {
    const container = document.getElementById('student-homework-grid');
    if (!container) return;
    container.innerHTML = '';

    const hwArray = Object.values(localHomeworks).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (hwArray.length === 0) {
        container.innerHTML = `<div class="col-span-full p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 shadow-2xs">🎉 สบายใจได้! ช่วงนี้ไม่มีการบ้านค้างในระบบ</div>`;
        return;
    }

    hwArray.forEach(hw => {
        const todayStr = new Date().toISOString().split('T')[0];
        const isOverdue = hw.dueDate < todayStr; 
        
        const card = document.createElement('div');
        card.className = `p-5 rounded-2xl border flex flex-col justify-between transition-all hover:shadow-md ${isOverdue ? 'bg-rose-50/20 border-rose-100 shadow-2xs' : 'bg-white border-slate-200 shadow-xs'}`;
        
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start gap-2 mb-2">
                    <span class="px-2.5 py-1 rounded-lg text-2xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                        📚 ${hw.subject}
                    </span>
                    <span class="text-3xs text-slate-400 whitespace-nowrap">สั่งเมื่อ: ${formatThaiDate(hw.assignDate)}</span>
                </div>
                <p class="text-xs font-semibold text-slate-700 my-3 whitespace-pre-line leading-relaxed">${hw.detail}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                <span class="font-bold text-slate-400 text-2xs">🗓️ กำหนดส่ง:</span>
                <span class="font-bold ${isOverdue ? 'text-rose-600' : 'text-emerald-600'}">
                    ${formatThaiDate(hw.dueDate)} ${isOverdue ? '(เลยกำหนดส่ง ⚠️)' : ''}
                </span>
            </div>
        `;
        container.appendChild(card);
    });
}

/* ==========================================================================
   INTERACTIVE USER ACTIONS & UTILITIES
   ========================================================================== */
window.toggleAttendance = function(studentKey, newStatus) {
    const targetAmountToday = localDailyTargets[selectedDate] || 0;
    if(targetAmountToday === 0 && newStatus === 'paid') {
        if(!confirm('คำเตือน: คุณยังไม่ได้กำหนดจำนวนเงินของวันนี้ (ปัจจุบันเป็น 0 บาท) ต้องการบันทึกว่าจ่ายแล้วหรือไม่?')) return;
    }

    set(ref(db, `students/${studentKey}/attendance/${selectedDate}`), newStatus);

    const studentName = localStudents[studentKey].name;
    push(dbLogsRef, {
        detail: newStatus === 'paid' 
            ? `เช็คชื่อจ่ายเงินสด [รอบวันที่ ${formatThaiDate(selectedDate)}]: ${studentName}`
            : `เปลี่ยนสถานะเป็นค้างจ่าย [รอบวันที่ ${formatThaiDate(selectedDate)}]: ${studentName}`,
        amount: newStatus === 'paid' ? targetAmountToday : 0,
        type: newStatus === 'paid' ? 'income' : 'expense',
        time: `${new Date().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}`
    });
}

window.openStudentProfileModal = function(studentKey) {
    const student = localStudents[studentKey];
    if(!student) return;

    let modal = document.getElementById('student-profile-modal');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'student-profile-modal';
        modal.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 hidden";
        document.body.appendChild(modal);
    }

    let historyRowsHTML = '';
    let totalPaidCount = 0;
    let totalUnpaidCount = 0;
    let totalMoneyContributed = 0;

    const allConfiguredDates = Object.keys(localDailyTargets).sort().reverse();

    if(allConfiguredDates.length === 0) {
        historyRowsHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">ยังไม่มีการตั้งเป้าหมายเงินเก็บวันใดๆ ในระบบ</td></tr>`;
    } else {
        allConfiguredDates.forEach(dateKey => {
            const dayTargetAmount = localDailyTargets[dateKey] || 0;
            const status = (student.attendance && student.attendance[dateKey]) ? student.attendance[dateKey] : "unpaid";
            
            if(status === 'paid') {
                totalPaidCount++;
                totalMoneyContributed += dayTargetAmount;
            } else {
                totalUnpaidCount++;
            }

            historyRowsHTML += `
                <tr class="${status === 'paid' ? 'bg-emerald-50/20' : 'bg-rose-50/20'}">
                    <td class="p-3 text-xs font-medium text-slate-700">${formatThaiDate(dateKey)}</td>
                    <td class="p-3 text-center">
                        <span class="px-2.5 py-1 rounded-full text-2xs font-bold ${status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                            ${status === 'paid' ? '✅ จ่ายแล้ว' : '❌ ค้างจ่าย'}
                        </span>
                    </td>
                    <td class="p-3 text-right font-bold text-xs ${status === 'paid' ? 'text-emerald-600' : 'text-rose-500'}">
                        ฿${dayTargetAmount.toFixed(2)}
                    </td>
                </tr>
            `;
        });
    }

    modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="bg-slate-900 text-white p-6 flex justify-between items-start">
                <div>
                    <span class="text-xs text-indigo-400 font-bold uppercase tracking-wider">โปรไฟล์เจาะลึกข้อมูลรายบุคคล</span>
                    <h3 class="text-xl font-bold mt-0.5">👤 ${student.name}</h3>
                    <p class="text-xs text-slate-400 mt-1">เลขที่: ${student.id} · รหัสประจำตัวในระบบคลาวด์: ${studentKey}</p>
                </div>
                <button onclick="closeStudentProfileModal()" class="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"><i class="fas fa-xmark"></i></button>
            </div>
            
            <div class="p-6 bg-slate-50 border-b border-slate-100 grid grid-cols-3 gap-3 text-center">
                <div class="bg-white p-3 rounded-xl border border-slate-200">
                    <p class="text-2xs font-semibold text-slate-400">จ่ายครบแล้ว</p>
                    <p class="text-lg font-bold text-emerald-600 mt-0.5">${totalPaidCount} ครั้ง</p>
                </div>
                <div class="bg-white p-3 rounded-xl border border-slate-200">
                    <p class="text-2xs font-semibold text-slate-400">ค้างจ่ายสะสม</p>
                    <p class="text-lg font-bold text-rose-600 mt-0.5">${totalUnpaidCount} รอบวัน</p>
                </div>
                <div class="bg-white p-3 rounded-xl border border-slate-200 bg-indigo-50/30 border-indigo-100">
                    <p class="text-2xs font-semibold text-indigo-500">รวมส่งเงินสดมาแล้ว</p>
                    <p class="text-lg font-bold text-indigo-600 mt-0.5">฿${totalMoneyContributed.toFixed(0)}</p>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ตารางประวัติแยกรายวันในระบบคลาวด์</h4>
                <div class="border border-slate-200 rounded-2xl overflow-hidden">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-100 text-slate-500 text-2xs font-bold uppercase">
                            <tr>
                                <th class="p-3">รอบวันที่ทำงาน</th>
                                <th class="p-3 text-center">สถานะ</th>
                                <th class="p-3 text-right">ยอดเงินเรียกเก็บ</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${historyRowsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="p-4 bg-slate-50 border-t border-slate-100 text-right">
                <button onclick="closeStudentProfileModal()" class="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer">ปิดหน้าต่าง</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

window.closeStudentProfileModal = function() {
    const modal = document.getElementById('student-profile-modal');
    if(modal) modal.classList.add('hidden');
}

function formatThaiDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('th-TH', options);
}

window.switchPage = function(pageId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeNav = pageId.replace('page-', 'nav-');
    const targetNav = document.getElementById(activeNav);
    if(targetNav) targetNav.classList.add('active');

    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
}

window.filterStudents = function() {
    const term = document.getElementById('search-student').value.toLowerCase();
    Object.entries(localStudents).forEach(([studentKey, student]) => {
        const row = document.getElementById(`row-std-${studentKey}`);
        if(row) {
            const match = student.name.toLowerCase().includes(term) || String(student.id).includes(term) || studentKey.includes(term);
            row.style.display = match ? '' : 'none';
        }
    });
}

window.filterStudentStatus = function(status) {
    Object.entries(localStudents).forEach(([studentKey, student]) => {
        const row = document.getElementById(`row-std-${studentKey}`);
        if(row) {
            const currentStatus = (student.attendance && student.attendance[selectedDate]) ? student.attendance[selectedDate] : "unpaid";
            if(status === 'unpaid') {
                row.style.display = currentStatus === 'unpaid' ? '' : 'none';
            } else if(status === 'paid') {
                row.style.display = currentStatus === 'paid' ? '' : 'none';
            } else {
                row.style.display = '';
            }
        }
    });
}

// 💡 ต้องเอาฟังก์ชันไปผูกไว้กับ window เพื่อให้ HTML มองเห็นในระบบ Module
window.addSubExpense = function(catId) {
    const detailInput = document.getElementById(`sub-detail-${catId}`);
    const amountInput = document.getElementById(`sub-amount-${catId}`); // หรือ sub-price-${catId} ให้เลือกใช้อย่างใดอย่างหนึ่ง

    if (!detailInput || !amountInput) {
        console.error("ไม่พบ Elements สำหรับกรอกข้อมูลย่อย");
        return;
    }

    const detail = detailInput.value.trim();
    const amount = parseFloat(amountInput.value);
    
    // ตรวจสอบความถูกต้องของข้อมูล
    if (!detail || isNaN(amount) || amount <= 0) {
        alert('กรุณากรอกรายละเอียดและระบุจำนวนเงินให้ถูกต้อง (มากกว่า 0 บาท)');
        return;
    }
    
    const newItem = push(ref(db, `expenses_categories/${catId}/sub_items`));
    set(newItem, { detail, amount }).catch(() => alert('บันทึกรายการไม่ได้ กรุณาลองใหม่')); 
    
    // เคลียร์ช่องกรอกหลังบันทึกสำเร็จ
    detailInput.value = '';
    amountInput.value = '';
};

window.deleteMainCategory = function(id) { if(confirm('ต้องการลบกลุ่มนี้หรือไม่?')) remove(ref(db, `expenses_categories/${id}`)); }
window.deleteSubExpense = function(catId, subId) { if(confirm('ลบรายการย่อยนี้?')) remove(ref(db, `expenses_categories/${catId}/sub_items/${subId}`)); }

window.exportToCSV = function() {
    let csvContent = "\uFEFF;ประเภท;รายการ;จำนวนเงิน(บาท);เวลา\n";
    localLogs.forEach(log => { csvContent += `"${log.type==='income'?'รายรับ':'รายจ่าย'}";"${log.detail}";"${log.amount}";"${log.time} น."\n`; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.setAttribute("download", `รายงานเงินห้อง.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

window.handleLogout = function() {
    if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
        localStorage.removeItem('admin_session');
        sessionStorage.removeItem('admin_session');
        location.replace('/login');
    }
}

window.deleteHomework = function(hwId) {
    if (confirm('คุณต้องการลบรายการการบ้านนี้ใช่หรือไม่? บัญชีฝั่งนักเรียนจะถูกอัปเดตทันที')) {
        remove(ref(db, `homework_logs/${hwId}`));
    }
}

/* ==========================================================================
   GLOBAL WINDOW EXPORTS FOR HTML INTERACTION (ONCLICK HANDLERS)
   ========================================================================== */
window.initTreasuryApp = initTreasuryApp;
window.updateDateContext = updateDateContext;
window.calculateSummary = calculateSummary;
window.renderDailyLedgerTable = renderDailyLedgerTable;
window.renderStudentList = renderStudentList;
window.renderExpenseCategories = renderExpenseCategories;
window.renderHomeworkAdmin = renderHomeworkAdmin;
window.renderHomeworkStudent = renderHomeworkStudent;
window.formatThaiDate = formatThaiDate;

/* ==========================================================================
   INITIALIZATION RUNNER
   ========================================================================== */

if (authorized) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTreasuryApp, { once: true });
    else initTreasuryApp();
}
