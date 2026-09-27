import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getDatabase(app);
async function isAdmin(user) {
  if (!user) return false;
  const value = await get(ref(db, `admin_uids/${user.uid}`));
  return value.val() === true;
}
onAuthStateChanged(auth, async user => { try { if (await isAdmin(user)) location.replace('/treasury'); } catch {} });
document.getElementById('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await setPersistence(auth, document.getElementById('login-remember').checked ? browserLocalPersistence : browserSessionPersistence);
    const result = await signInWithEmailAndPassword(auth, document.getElementById('login-username').value.trim(), document.getElementById('login-password').value);
    if (!await isAdmin(result.user)) { await signOut(auth); throw Error('บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล'); }
    location.replace('/treasury');
  } catch (e) { alert(e.message.startsWith('Firebase:') ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : e.message); }
});
