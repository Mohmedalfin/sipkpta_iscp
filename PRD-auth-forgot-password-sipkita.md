# PRD — SIPKITA Auth Fase 4: Forgot & Reset Password

**Status:** Siap diimplementasikan (backend only)  
**Target:** Node.js/Express, Prisma, PostgreSQL `sipkita_dev`  
**Batas:** Menyambung autentikasi Fase 1–3 yang telah berfungsi; frontend belum dikerjakan.

## 1. Tujuan dan kondisi awal

Mahasiswa, dosen, dan admin yang lupa kata sandi dapat meminta tautan pemulihan melalui **email terdaftar**, lalu menetapkan kata sandi baru tanpa bantuan Admin Sistem.

Sistem saat ini telah memiliki:

- Login JWT, refresh token rotation, dan logout dengan pencabutan `AuthSession`.
- Pemilihan role aktif dengan `active_role_id` dan `role_version`.
- Utilitas password Argon2id pada `server/src/security/password.js` (`m=19456`, `t=2`, `p=1`). **Gunakan ulang, jangan buat implementasi hashing kedua.**
- Model `PasswordResetToken` dalam Prisma. **Periksa atribut, relasi, dan migration yang ada sebelum mengusulkan perubahan schema.** Jangan membuat model baru bila model ini memadai.
- Pengaturan Gmail SMTP dan App Password telah diisi secara lokal dalam `server/.env`. Jangan membaca, mencetak, atau menyalin nilai rahasia ke laporan.

## 2. Keputusan fungsional

| Item | Aturan |
| --- | --- |
| Identitas pemohon | Alamat email yang terhubung ke akun SIPKITA dan dapat menerima email. Gunakan kolom/relasi yang benar-benar ada di schema. |
| Akun tidak ditemukan | Balasan **sama** seperti akun ditemukan; tidak boleh mengungkap keberadaan email. |
| Pengiriman | Email sungguhan memakai Gmail SMTP melalui Nodemailer. `SMTP_USER` dan `MAIL_FROM` memakai akun Gmail pengirim yang sama. |
| Token | Token acak kriptografis minimal 32 byte, bukan JWT login; database hanya menyimpan hash SHA-256 token. |
| Masa berlaku | **15 menit** sejak dibuat, dapat dikonfigurasi dengan `RESET_TOKEN_EXPIRES_MINUTES`. |
| Banyak permintaan | Token reset yang lebih lama untuk user tersebut dibatalkan ketika permintaan baru berhasil diproses. Hindari kondisi email gagal tetapi semua tautan valid sebelumnya hilang. |
| Penggunaan | Sekali pakai, tidak dapat dipakai sesudah kedaluwarsa, dibatalkan, atau pernah digunakan. |
| Password baru | Validasi kebijakan kata sandi sesuai modul auth; simpan memakai utilitas Argon2id yang sudah ada. Tidak menggunakan tanggal lahir sebagai password baru. |
| Setelah reset berhasil | Semua sesi login user dicabut; refresh dan access token lama tidak boleh dipakai; semua token reset lain user dibatalkan. User harus login ulang. |
| Akun/role | Reset tidak boleh mengubah `User`, `UserRole`, profil Mahasiswa/Dosen, role aktif, atau relasi akademik selain hash password dan pencabutan sesi/token terkait. |

## 3. Endpoint dan kontrak respons

### `POST /api/auth/forgot-password`

Tanpa autentikasi; JSON: `{ "email": "pemilik@example.com" }`.

- Validasi format/panjang email dan normalisasi yang konsisten dengan schema.
- Untuk email terdaftar: buat token, simpan hash, kirim pesan berisi tautan/kode reset ke alamat itu.
- Untuk email tidak terdaftar: jangan kirim email dan jangan membocorkan informasi akun.
- Untuk kedua kondisi, respons HTTP `200` dengan envelope proyek yang sama dan pesan generik, misalnya: `Jika email terdaftar, instruksi reset password akan dikirim.`
- Beri rate limit **per IP dan per akun/email**; cegah spam berulang (cooldown), brute force, dan email enumeration. Terapkan respons/status aman yang konsisten.
- SMTP gagal harus dicatat secara internal tanpa token/kredensial; jangan mengembalikan detail SMTP ke klien. Token yang tidak terkirim harus dibersihkan/dibatalkan secara aman.

### `POST /api/auth/reset-password`

Tanpa autentikasi; JSON:

```json
{
  "token": "token-dari-email",
  "newPassword": "password-baru-yang-kuat",
  "confirmPassword": "password-baru-yang-kuat"
}
```

- Validasi panjang/format input, kesamaan password-konfirmasi, dan kebijakan password.
- Hash token dari request; cari token yang belum dipakai, belum dibatalkan, dan belum kedaluwarsa.
- Konsumsi token **secara atomik** (gunakan transaction/conditional update PostgreSQL sehingga dua request bersamaan tidak sama-sama berhasil).
- Dalam transaksi yang sama, perbarui `password_hash` menggunakan Argon2id, batalkan seluruh token reset lain milik user, dan set `revoked_at` untuk seluruh `AuthSession` aktif milik user.
- Berhasil: HTTP `200`, pesan berhasil; **jangan keluarkan JWT/refresh token atau password**.
- Invalid/expired/reused token: penolakan konsisten (`400`/`401` menurut konvensi API yang sudah ada), tanpa detail sensitif.
- Opsional: kirim email pemberitahuan bahwa password berubah, tanpa mencantumkan password baru; kegagalan email notifikasi tidak boleh membatalkan perubahan password yang telah berhasil.

## 4. Arsitektur, konfigurasi, dan email

Pertahankan pola yang ada: **route → controller → service → Prisma**, dengan middleware validasi dan error handler proyek. Buat komponen pengiriman email terpisah (`mail.service.js` atau nama sesuai struktur) agar provider dapat diganti tanpa mengubah logika reset.

Gunakan konfigurasi yang sudah disiapkan, jangan membuat variabel duplikat:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=akun-pengirim@gmail.com
SMTP_APP_PASSWORD=ISI_HANYA_DI_ENV_LOKAL
MAIL_FROM=akun-pengirim@gmail.com
RESET_TOKEN_EXPIRES_MINUTES=15
```

- Password SMTP adalah **Google App Password**, bukan password login Gmail.
- Nilai sensitif hanya di `.env` yang diabaikan Git. Perbarui `.env.example` menggunakan placeholder saja.
- Bangun URL reset hanya dari **konfigurasi URL tepercaya**, bukan HTTP `Host` header. Untuk development, karena React belum dibuat, isi email boleh menyertakan token yang mudah disalin ke Postman; tautan React nanti menyusul. Jangan membuat UI pada fase ini.
- Jangan menaruh token reset, password, maupun App Password dalam body respons API, log, screenshot, database plaintext, atau laporan tes.
- Bila email test dikirim, batasi **satu akun penerima nyata yang ditentukan pengguna**; jangan kirim email kepada seluruh akun dummy atau pihak lain.

## 5. Integritas database dan batas migrasi

1. Baca model `PasswordResetToken`, `User`, `AuthSession`, dan migration aktual secara **terfokus**.
2. Jika struktur token reset sudah mendukung hash, kedaluwarsa, sekali pakai, dan FK user, gunakan apa adanya (tanpa migration).
3. Jika tidak mendukung, usulkan perubahan **aditif minimal** dan siapkan draf SQL migration tanpa merusak isi existing. **Minta satu persetujuan sebelum menerapkan migrasi** ke `sipkita_dev`.
4. Jangan `db push` paksa, reset/drop database, reseed semua akun, atau mengubah partial index lama. Pertahankan akun, role, relasi, data akademik, dan sesi existing kecuali sesi akun yang memang melakukan reset berhasil.

## 6. Pengujian penerimaan (wajib)

| Kode | Skenario | Hasil yang diharapkan |
| --- | --- | --- |
| FP-01 | Request reset ke email yang ada | HTTP `200` generik, email masuk, hanya hash token tersimpan |
| FP-02 | Request reset ke email tak terdaftar | Status/pesan sama, tidak bocorkan akun |
| FP-03 | Token valid + password sesuai | Password lama gagal login; password baru berhasil |
| FP-04 | Token salah, habis masa berlaku, atau pernah digunakan | Semua ditolak; password tetap aman |
| FP-05 | Dua request reset bersamaan memakai token sama | Tepat **satu** request berhasil |
| FP-06 | Setelah reset sukses | JWT dan refresh token dari semua sesi user sebelum reset ditolak |
| FP-07 | User multi-role melakukan reset | `UserRole` dan perilaku pemilihan role baru tetap benar |
| FP-08 | Spam request reset | Rate limit/cooldown bekerja |
| FP-09 | SMTP gagal | Tidak bocorkan error/secret; tidak meninggalkan token aktif yang tidak terkirim |
| FP-10 | Reset akun A | Sesi akun B, data fixture, dan hash password akun B tidak berubah |

Gunakan **mock SMTP dan database test terisolasi** pada unit test. Jalankan satu uji manual email Gmail nyata pada akun uji yang disetujui pengguna. Jangan mengubah password fixture permanen saat tes integrasi tanpa mekanisme pemulihan yang teruji.

## 7. Batas pekerjaan, pelaporan, dan aturan eksekusi Codex

**Di dalam cakupan:** dua endpoint, controller/service/route, email adapter, validasi, rate limit, integrasi `PasswordResetToken`, tes, `.env.example`, pembaruan ringkas status dokumentasi.

**Di luar cakupan:** React/frontend, registrasi umum, import data master, reset manual Admin Sistem, pengajuan akademik, refactor auth Fase 1–3, penggantian provider SMTP.

**Cara kerja agent:**

- Baca `AGENTS.md`, lalu file kode/schema/skill **yang benar-benar relevan** saja; hindari membaca ulang seluruh dokumentasi proyek dan melakukan audit umum.
- Implementasikan langsung bagian yang tidak destruktif; tidak perlu meminta konfirmasi untuk setiap file atau tahap kecil.
- Konfirmasi hanya jika perlu membuat/menerapkan perubahan database, mengirim email nyata ke penerima yang belum ditentukan, atau menemui keputusan keamanan/kontrak yang berdampak besar.
- Lakukan pengecekan syntax, tes unit/integrasi yang aman, Prisma validate (bila schema disentuh), serta `git diff --check`.
- Laporan akhir ringkas: file berubah, endpoint, status tes, status migration, risiko/pekerjaan tersisa. Jangan tampilkan isi `.env`, password, atau token reset.

## 8. Sumber acuan

- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [Nodemailer SMTP transport](https://nodemailer.com/smtp)
- [Nodemailer Gmail & App Password](https://nodemailer.com/guides/using-gmail)
