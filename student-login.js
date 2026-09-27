import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getDatabase(app);
const form = document.getElementById('student-login-form');
const field = document.getElementById('student-id');
const error = document.getElementById('login-error');
const button = document.getElementById('submit-button');
const savedId = localStorage.getItem('kc_treasury_student_id');
if (/^\d{5}$/.test(savedId || '')) field.value = savedId;

async function accountExists(id) {
  const record = await get(ref(db, `students/${id}`));
  return record.exists();
}
onAuthStateChanged(auth, async user => {
  const id = localStorage.getItem('kc_treasury_student_id');
  if (!user?.isAnonymous || !/^\d{5}$/.test(id || '')) return;
  try {
    if (await accountExists(id)) location.replace('/dashboard');
    else localStorage.removeItem('kc_treasury_student_id');
  } catch { /* Form remains available if the network is down or rules deny access. */ }
});
form.addEventListener('submit', async event => {
  event.preventDefault(); error.hidden = true; button.disabled = true;
  const id = field.value.trim();
  try {
    if (!/^\d{5}$/.test(id)) throw Error('กรุณากรอกรหัสนักเรียน 5 หลัก');
    await setPersistence(auth, browserLocalPersistence);
    if (!auth.currentUser?.isAnonymous) await signInAnonymously(auth);
    if (!await accountExists(id)) throw Error('ไม่พบรหัสนักเรียนนี้ในระบบ');
    localStorage.setItem('kc_treasury_student_id', id);
    location.replace('/dashboard');
  } catch (e) {
    error.textContent = e.message.startsWith('Firebase:') ? 'เชื่อมต่อบัญชีไม่ได้ กรุณาตรวจสอบการเปิด Anonymous Authentication และกฎฐานข้อมูล' : e.message;
    error.hidden = false; button.disabled = false;
  }
});
