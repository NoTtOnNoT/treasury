// Run locally with Google Application Default Credentials (never upload credentials to the site).
// DRY_RUN=1 npm run provision to preview. Without DRY_RUN this creates real accounts.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { randomBytes } from 'node:crypto';
import { writeFileSync, openSync, closeSync } from 'node:fs';
initializeApp({ credential: applicationDefault(), databaseURL: 'https://kc-smart-6e44d-default-rtdb.asia-southeast1.firebasedatabase.app' });
const db = getDatabase(), auth = getAuth();
const students = (await db.ref('students').get()).val() || {};
const dry = process.env.DRY_RUN === '1';
const records = [];
for (const [id, student] of Object.entries(students).sort(([a],[b]) => a.localeCompare(b))) {
  if (!/^\d{5}$/.test(id)) { console.log('Skipping invalid student key:', id); continue; }
  const email = `${id}@students.kc-smart.example`;
  if (dry) { console.log(id, student.name || ''); continue; }
  let user, password = '';
  try { user = await auth.getUserByEmail(email); }
  catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    password = randomBytes(12).toString('base64url');
    user = await auth.createUser({ email, password, displayName: student.name || id });
  }
  await db.ref(`student_accounts/${user.uid}`).set(id);
  // Password is generated once. Existing accounts keep their password.
  if (password) records.push([id, password]);
  console.log('Linked', id);
}
if (records.length) {
  const path = `student-passwords-${Date.now()}.csv`;
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, 'student_id,password\n' + records.map(row => row.join(',')).join('\n') + '\n'); }
  finally { closeSync(fd); }
  console.log('New credentials saved locally:', path, '(keep private; delete after distribution)');
}
