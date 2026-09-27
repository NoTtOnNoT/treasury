# KC Treasury — เข้าด้วยรหัสนักเรียน 5 หลัก

## ติดตั้ง

1. สำรองข้อมูลและ Rules ของ Realtime Database โปรเจกต์ `kc-smart-6e44d` ก่อน
2. Firebase Console → Authentication → Sign-in method → เปิด **Anonymous** (นักเรียน) และ **Email/Password** (ผู้ดูแล). สร้างบัญชีผู้ดูแลด้วยอีเมลจริงและรหัสผ่านใหม่ที่ Authentication → Users แล้วเพิ่ม `admin_uids/<UID>` = boolean `true` ใน Realtime Database
3. รวม `database.rules.example.json` เข้ากับ Rules เดิม เฉพาะ path ที่ระบุในตัวอย่าง และคง path อื่นของ KC Smart ไว้. ห้ามมีกฎ `.read: true` / `.write: true` ที่ root หรือ ancestor ของข้อมูลเหล่านี้ เพราะกฎลูกปิดทับกฎที่เปิดกว้างกว่าไม่ได้. ทดสอบ Rules ก่อน Publish
4. เมื่อย้ายบัญชีผู้ดูแลแล้ว ให้สำรองและลบ `system_config/admin_accounts` ซึ่งเก็บรหัสผ่านเก่าเป็นข้อความธรรมดา
5. อัปโหลดไฟล์ HTML/CSS/JS และ `vercel.json` ไปที่ **root ของโปรเจกต์ Vercel**. ตั้ง root directory ให้ตรงกับโฟลเดอร์นี้. เปิด `/` หรือ `/student-login` สำหรับนักเรียน; `/dashboard` สำหรับหน้าส่วนตัว; `/login` และ `/treasury` สำหรับผู้ดูแล. ไม่ต้องพิมพ์ `.html`. หากใช้โดเมนใหม่ เพิ่มโดเมนใน Firebase Authentication → Authorized domains

## การทำงาน

ข้อมูลนักเรียนอยู่ที่ `students/<รหัสนักเรียน 5 หลัก>/{id,name,attendance}`. รายวันอ่านจาก `system_config/daily_targets/{YYYY-MM-DD}` และรายจ่ายอ่านจาก `expenses_categories`. เมื่อกรอกรหัสที่มีจริง ระบบจำรหัสไว้ใน localStorage ของ browser และ Firebase จำ anonymous session แบบ LOCAL; เปิดเว็บครั้งต่อไปจะพาเข้าหน้า Dashboard อัตโนมัติ. ปุ่มออกจากระบบล้างรหัสที่บันทึกและออกจาก anonymous session

**ข้อจำกัดด้านความเป็นส่วนตัว:** รหัสนักเรียนเพียงอย่างเดียวไม่ใช่การพิสูจน์ตัวตน ใครทราบรหัส 5 หลักก็สามารถกรอกเพื่อดูรายการจ่ายของนักเรียนคนนั้นได้. Anonymous Authentication ใช้เพื่อจำ session และให้ Rules ไม่เปิดการอ่านทั้งตารางนักเรียน; ไม่ได้ยืนยันว่าคนกรอกเป็นเจ้าของรหัส. ควรใช้ PIN/รหัสผ่านเฉพาะคนในอนาคตหากข้อมูลต้องเป็นส่วนตัวจริง ๆ. กฎอนุญาตให้อ่าน `students/<รหัส>` ทีละคน แต่ไม่ให้อ่าน `students` ทั้งก้อน (เว้นแอดมิน)

ยอดค้าง = ผลรวมของรอบเรียกเก็บที่ไม่ได้บันทึกว่า `paid`; วันยังไม่ตั้งเป้าไม่นับ. หากแก้ราคาเป้าย้อนหลัง ยอดของอดีตก็เปลี่ยน. การค้างล็อกอินใช้ได้เฉพาะ browser/อุปกรณ์เดิม จนกว่าจะกดออกจากระบบหรือล้างข้อมูลเว็บไซต์

## ทดสอบ

- เปิด `/student-login` ใส่รหัสที่อยู่ใน `students` → `/dashboard` และเห็นเฉพาะรายการของรหัสที่กรอก
- รีเฟรช `/dashboard` และปิด/เปิด browser ใหม่ → ยังเข้าได้
- ออกจากระบบ → กลับหน้าเข้าสู่ระบบ
- Rules Playground: anonymous อ่าน `students/27648` ได้, อ่าน `students` ทั้งก้อน/เขียน attendance ไม่ได้; แอดมินอ่านทั้งก้อนและเขียนได้
