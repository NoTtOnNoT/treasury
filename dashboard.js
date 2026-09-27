import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getDatabase(app);
const $ = id => document.getElementById(id);
const money = n => '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits:2, maximumFractionDigits:2 });
const date = s => /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`).toLocaleDateString('th-TH', {day:'numeric',month:'short',year:'numeric'}) : s;
const number = n => { const value = Number(n); return Number.isFinite(value) && value > 0 ? value : 0; };
let student = null, targets = {}, stops = [];
function message(text) { $('notice').textContent = text; $('notice').hidden = !text; }
function render() {
  if (!student) return;
  $('student-name').textContent = student.name || 'นักเรียน';
  $('student-number').textContent = `เลขที่ ${student.id ?? '—'} · รหัสนักเรียน ${student.key}`;
  $('updated').textContent = `ข้อมูล ณ ${new Date().toLocaleString('th-TH')}`;
  let paid = 0, unpaid = 0, pc = 0, uc = 0;
  const tbody = $('history'); tbody.replaceChildren();
  const dates = Object.keys(targets).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().reverse();
  if (!dates.length) { const row = tbody.insertRow(); const cell = row.insertCell(); cell.colSpan = 3; cell.textContent = 'ยังไม่มีรอบเรียกเก็บ'; }
  dates.forEach(day => {
    const amount = number(targets[day]);
    const settled = student.attendance?.[day] === 'paid';
    if (settled) { paid += amount; pc++; } else { unpaid += amount; uc++; }
    const row = tbody.insertRow();
    row.insertCell().textContent = date(day);
    row.insertCell().textContent = money(amount);
    const cell = row.insertCell(); cell.textContent = settled ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'; cell.className = settled ? 'status paid' : 'status unpaid';
  });
  $('paid-total').textContent = money(paid); $('unpaid-total').textContent = money(unpaid);
  $('due-total').textContent = money(paid + unpaid);
  $('paid-count').textContent = `${pc} รอบ`; $('unpaid-count').textContent = `${uc} รอบ`;

}
onAuthStateChanged(auth, user => {
  stops.forEach(stop => stop()); stops = []; student = null;
  const key = localStorage.getItem('kc_treasury_student_id');
  if (!user?.isAnonymous || !/^\d{5}$/.test(key || '')) { location.replace('/student-login'); return; }
  stops.push(onValue(ref(db, `students/${key}`), snapshot => {
    const data = snapshot.val();
    if (!data) { message('ไม่พบข้อมูลนักเรียน กรุณาติดต่อผู้ดูแล'); return; }
    student = { ...data, key }; render();
  }, () => message('อ่านข้อมูลนักเรียนไม่ได้ กรุณาตรวจสอบกฎ Firebase')));
  stops.push(onValue(ref(db, 'system_config/daily_targets'), s => { targets = s.val() || {}; render(); }, () => message('โหลดรอบเรียกเก็บไม่ได้')));
  $('loading').hidden = true; $('app').hidden = false;
});
$('logout').addEventListener('click', async () => { localStorage.removeItem('kc_treasury_student_id'); await signOut(auth); location.replace('/student-login'); });
