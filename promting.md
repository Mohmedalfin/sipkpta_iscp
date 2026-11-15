**Task: Final Verification & Code Quality Review — Fase I Bimbingan KP SIPKITA**

Implementasi Fase I sudah selesai dan 6 integration test PostgreSQL TEST telah PASS.

Lakukan **final verification terarah**, bukan audit ulang menyeluruh.

### Cakupan

1. **Business Rules**
   - Pastikan alur Offline/Online sesuai PRD Fase I.
   - Validasi transisi status, revisi, dan penguncian keputusan.
   - Periksa hitungan bimbingan sah dan tidak adanya ACC penyelesaian otomatis.
   - Pastikan Validasi Semua atomik, idempotent, dan aman terhadap request paralel.

2. **Clean Code & Arsitektur**
   - Review service, controller, routes, serta integrasi storage Fase I.
   - Periksa penerapan SRP, DRY, KISS, modularitas, validasi input, error handling, dan separation of concerns.
   - Identifikasi duplikasi atau kompleksitas yang benar-benar mengganggu maintainability.
   - Jangan melakukan refactor besar atau memecah file tanpa alasan teknis yang kuat.

3. **Database & Keamanan**
   - Pastikan riwayat pengiriman, keputusan dosen, dan lampiran tetap konsisten.
   - Validasi ownership mahasiswa, penugasan Pembimbing aktif, dan pembatasan role.
   - Periksa risiko stale version, transaksi, serta file orphan ketika operasi storage/database gagal.

4. **Supabase Storage**
   - Verifikasi integrasi lampiran dengan Supabase Storage privat.
   - Jika konfigurasi pengujian aman tersedia, jalankan smoke test upload/download, akses tidak sah, dan cleanup.
   - Jangan mengubah dokumen pengguna atau melakukan operasi berisiko pada storage production.

5. **Regression Testing**
   - Jalankan hanya tes Fase I dan regresi terkait Fase H jika diperlukan.
   - Jangan mengulang seluruh pengujian D–H yang sudah PASS tanpa indikasi regresi.

### Ketentuan
- Ikuti AGENTS.md, PRD Fase I, serta skill code-change-verification.
- Prioritaskan PRD Fase I jika dokumentasi bisnis lama bertentangan.
- Perbaiki langsung bug atau masalah kecil yang terbukti dalam scope, lalu uji ulang.
- Hindari refactor kosmetik dan overengineering.
- Jangan mengubah schema, migration, frontend, Scalar, atau sipkita_dev.
- Gunakan PostgreSQL TEST terisolasi untuk pengujian mutatif.

### Output
Laporkan secara ringkas:
- Business Rules: PASS/FAIL
- Code Quality: PASS atau temuan spesifik
- Database & Security: PASS/FAIL
- Supabase Storage: PASS/FAIL/NOT TESTED
- Regression: PASS/FAIL
- File yang diperbaiki dan risiko tersisa.

Jika seluruh pemeriksaan penting lulus, nyatakan Fase I siap `COMPLETED`.