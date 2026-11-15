# Visual Direction — SIPKITA

> Status: v1, acuan awal untuk diskusi dan implementasi UI.  
> Cakupan: aplikasi client React + Vite + Tailwind CSS.  
> Prinsip utama: **style reference, bukan pixel-perfect reproduction**.

## 1. Tujuan dan karakter produk

SIPKITA adalah sistem informasi akademik untuk pengelolaan Kerja Praktik (KP), Information Systems Capstone Project (ISCP), dan Tugas Akhir (TA). Antarmuka harus terasa **profesional, tepercaya, bersih, terstruktur, tenang, dan efisien** untuk mahasiswa, dosen reviewer, dosen pembimbing, Kaprodi, serta pengelola sistem.

Gaya yang dituju: **Modern Academic Administration** — tampilan administrasi modern yang menekankan keterbacaan informasi dan kejelasan tindakan, bukan efek dekoratif.

## 2. Interpretasi tiga referensi gambar

Ketiga gambar berasal dari aplikasi Pembayaran SPP dan dipakai **hanya sebagai inspirasi visual**. Jika gambar tersedia di proyek, simpan secara lokal di `.docs/frontend/references/` agar agent dapat membukanya.

| Referensi | Unsur gaya yang diadaptasi | Yang tidak boleh disalin mentah |
| --- | --- | --- |
| Login split-screen | Bidang biru solid, sisi formulir putih, hierarki judul yang jelas, form dengan ruang lega, tombol utama biru | Logo/identitas Pembayaran SPP, copy pembayaran, akun demo, ukuran pembagian kolom secara kaku |
| Halaman 404 | Latar netral sangat terang, satu card terpusat, judul singkat, petunjuk tindakan, tombol utama dan sekunder | Teks merek, ikon/ilustrasi secara identik, komposisi yang dipaksakan ke semua halaman |
| Dashboard | Sidebar biru, header sederhana, ruang konten putih, kartu dengan border tipis, notifikasi informatif, navigasi berkelompok | Menu keuangan, metrik transaksi, isi card, jumlah kartu dan grid yang tidak relevan bagi SIPKITA |

Warna biru yang tampak dominan kira-kira **`#3B6FDF`** (estimasi dari piksel gambar JPEG). Ini menjadi kandidat warna utama, bukan klaim nilai desain asli.

## 3. Arah visual yang disepakati sebagai baseline

1. **Color mood:** biru solid sebagai identitas dan penanda aksi utama; putih dan abu muda sebagai bidang konten; teks gelap hampir hitam; warna semantik hanya untuk status.
2. **Typography:** sans-serif modern yang bersih, dengan hierarki judul tegas dan teks pendukung lebih tenang. Utamakan keterbacaan teks Indonesia, label, tabel, dan formulir.
3. **Layout:** navigasi mudah ditemukan, area kerja luas, grouping berdasarkan tugas, alignment presisi, padding konsisten, dan whitespace secukupnya.
4. **Surfaces:** card putih, border netral tipis, radius sedang, shadow sangat halus hanya bila membantu pemisahan lapisan.
5. **Visual emphasis:** satu aksi primer jelas pada tiap konteks. Badge, ikon, dan callout harus menjelaskan informasi, bukan sekadar dekorasi.
6. **Density:** seimbang. Form nyaman diisi; tabel dan dashboard boleh lebih padat agar pekerjaan administrasi efisien.
7. **Motion:** minimal, fungsional, cepat; hormati preferensi reduced-motion.

## 4. Penerapan per kelompok halaman

### Autentikasi

- Login dapat menggunakan komposisi dua bidang pada layar lebar: panel identitas/informasi biru dan panel form putih.
- Pada layar kecil, prioritaskan form dan ringkas panel promosi/informasi.
- Tampilkan branding **SIPKITA** dan konteks akademik KP–ISCP–TA; jangan mengambil nama, klaim, atau materi Pembayaran SPP.
- Input, label, pesan validasi, tautan lupa kata sandi, dan tombol harus jelas. Jangan menampilkan akun/password demo pada UI nyata.

### Dashboard dan halaman internal

- Gunakan kerangka aplikasi yang konsisten: sidebar navigasi, area header, judul halaman, konteks singkat, lalu isi tugas.
- Sidebar biru boleh menjadi ciri visual utama. Menu dan sub-menu mengikuti **hak akses role aktual**; jangan menyalin kategori keuangan dari referensi.
- Isi utama menonjolkan **tindakan dan status yang benar-benar relevan** (misalnya pengajuan, proposal, bimbingan, atau penugasan reviewer), bukan empat KPI dekoratif yang dipaksakan.
- Gunakan card untuk ringkasan dan informasi terkelompok; gunakan tabel/list untuk data yang perlu dicari, difilter, atau diperiksa.
- Pertahankan ruang baca dan informasi utama saat sidebar diperkecil atau ditampilkan sebagai drawer mobile.

### Halaman error, kosong, dan status

- Gunakan latar netral, pesan langsung, ilustrasi/ikon sederhana bila berguna, serta tindakan pemulihan yang jelas.
- Halaman 404 memuat tindakan kembali/beranda yang valid; empty state menjelaskan apa yang belum tersedia dan langkah berikutnya.
- Status tidak boleh hanya dibedakan melalui warna; sertakan label teks.

## 5. Aturan anti-AI Slop

- Jangan memakai gradient mencolok, glassmorphism, glow, shadow berat, blob, atau dekorasi acak tanpa alasan produk.
- Jangan memaksakan hero marketing, card statistik seragam, atau angka dummy pada seluruh dashboard.
- Jangan membuat layout identik untuk semua role bila tugas dan informasi mereka berbeda.
- Jangan mengubah konten, menu, status, atau aturan bisnis hanya agar menyerupai screenshot.
- Hindari banyak variasi radius, warna biru, font, dan ukuran tombol yang tidak sistematis.
- Jika referensi visual bertentangan dengan aksesibilitas atau alur kerja, prioritaskan kejelasan dan aksesibilitas.

## 6. Cara menggunakan dokumen ini oleh AI agent

1. Baca dokumen ini sebelum membuat atau merombak UI SIPKITA; baca `design-system.md` untuk token yang berlaku.
2. Periksa komponen dan styling existing terlebih dahulu. Pertahankan pola yang sudah sesuai; hindari rewrite massal.
3. Untuk halaman baru, jelaskan singkat: pengguna/role, tugas utama, hierarki informasi, komponen reusable, dan penerapan gaya.
4. Gunakan screenshot hanya untuk memahami **rasa visual**. Tidak perlu menyamakan posisi elemen, ukuran, maupun konten secara pixel-perfect.
5. Setelah implementasi, tinjau desktop dan mobile beserta keadaan loading, empty, error, success, dan validasi; iterasikan hasil visual.
6. Aturan bisnis, hak akses, kontrak API, dan implementasi backend mengikuti dokumentasi/proyek sumber masing-masing; dokumen visual ini tidak menggantikannya.

## 7. Kriteria hasil yang baik

Sebuah halaman SIPKITA dianggap selaras jika tampak satu keluarga desain (biru, netral, tipografi, komponen), informasi dan tindakan utamanya segera terlihat, responsif, dapat dioperasikan lewat keyboard, serta tidak mengandung elemen atau konten yang disalin dari produk referensi tanpa kebutuhan SIPKITA.
