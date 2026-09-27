import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

const db = getDatabase(initializeApp(firebaseConfig));
const form = document.getElementById('login-form');
const button = form.querySelector('button[type="submit"]');
const active = () => localStorage.getItem('admin_session') === 'authenticated' || sessionStorage.getItem('admin_session') === 'authenticated';
if (active()) location.replace('/treasury');

form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const snapshot = await get(ref(db, 'system_config/admin_accounts'));
    if (!snapshot.exists()) throw Error('ไม่พบข้อมูลบัญชีผู้ดูแลใน Realtime Database');
    const matched = Object.values(snapshot.val()).some(account =>
      account && account.username === username && account.password === password
    );
    if (!matched) throw Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    localStorage.removeItem('admin_session');
    sessionStorage.removeItem('admin_session');
    const storage = document.getElementById('login-remember').checked ? localStorage : sessionStorage;
    storage.setItem('admin_session', 'authenticated');
    location.replace('/treasury');
  } catch (error) {
    alert(error.code === 'PERMISSION_DENIED' || error.code === 'permission-denied'
      ? 'อ่านข้อมูลแอดมินไม่ได้ กรุณาตรวจสอบ Rules ที่ system_config/admin_accounts'
      : error.message || 'เชื่อมต่อ Firebase ไม่สำเร็จ');
    button.disabled = false;
  }
});
