# Design System — SIPKITA

> Versi: v1 / baseline desain awal.  
> Sumber visual: tiga referensi Pembayaran SPP yang dianalisis sebagai **inspirasi gaya**, bukan spesifikasi pixel-perfect.  
> Baca bersama: `visual-direction.md`.  
> Implementasi: React + Vite + Tailwind CSS; adaptasikan pada setup Tailwind yang benar-benar terpasang.

## 1. Prinsip implementasi

- Gunakan **satu sumber token** untuk warna, font, radius, dan spacing; hindari nilai arbitrer berulang di setiap komponen.
- Utamakan kontras, keterbacaan, dan konsistensi dibanding kemiripan piksel dengan screenshot.
- Jangan memasang library UI, font, atau ikon baru hanya untuk mengejar kemiripan tanpa mengecek dependensi yang sudah ada.
- Gunakan komponen bersama untuk elemen yang berulang, namun jangan memaksakan abstraksi untuk satu pemakaian.
- Angka di bawah adalah **keputusan token awal SIPKITA**, bukan hasil ekstraksi presisi dari desain asli. Boleh disempurnakan setelah review visual.

## 2. Color tokens

| Token semantik | Hex | Penggunaan |
| --- | --- | --- |
| `brand.primary` | `#3B6FDF` | Identitas SIPKITA, sidebar, aksi primer (kontras dengan putih ~4.64:1) |
| `brand.hover` | `#3569D4` | Hover pada aksi primer |
| `brand.pressed` | `#2F5FC3` | Active/pressed |
| `brand.soft` | `#EEF3FE` | Info callout, chip ringan, latar seleksi |
| `surface.canvas` | `#F8FAFC` | Latar aplikasi/halaman error |
| `surface.card` | `#FFFFFF` | Card, formulir, konten utama |
| `surface.subtle` | `#F1F5F9` | Hover baris, grup ringan |
| `border.default` | `#E2E8F0` | Border card, input, divider |
| `text.primary` | `#0F172A` | Heading, nilai, informasi penting |
| `text.secondary` | `#475569` | Deskripsi, label sekunder |
| `text.muted` | `#64748B` | Hint dan metadata non-kritis |
| `text.onBrand` | `#FFFFFF` | Teks pada bidang biru primer |
| `focus.ring` | `#1D4ED8` | Fokus keyboard yang jelas |

### Warna status

| Status UI | Warna teks | Latar lembut | Contoh pemakaian |
| --- | --- | --- | --- |
| Success | `#166534` | `#DCFCE7` | Berhasil, selesai, layak jika sesuai aturan proses |
| Warning | `#92400E` | `#FEF3C7` | Perlu perhatian, menunggu aksi |
| Danger | `#B91C1C` | `#FEE2E2` | Gagal, ditolak, validasi error |
| Info | `#1D4ED8` | `#DBEAFE` | Informasi, dalam proses |
| Neutral | `#475569` | `#F1F5F9` | Belum ada keputusan / nonaktif |

Status dan label bisnis (misalnya `Belum Diperiksa`, `Belum OK`, `OK Lengkap`, `ACC`, `Tidak ACC`) harus berasal dari kebutuhan dan respons API yang benar; **jangan menyimpulkan pemetaan status hanya dari warna**. Selalu tampilkan teks, tidak hanya warna/ikon.

## 3. Typography

- Karakter: sans-serif modern dan terbaca. Rekomendasi: **Inter** jika tersedia; fallback `system-ui`, `Segoe UI`, `sans-serif`.
- Jangan mengasumsikan font asli screenshot dapat diketahui secara pasti.
- Gunakan maksimal satu keluarga utama untuk UI internal. Hindari variasi font dekoratif.

| Peran | Ukuran/line-height awal | Bobot |
| --- | --- | --- |
| Page title | `24px / 32px` | 700 |
| Section title | `18px / 28px` | 600–700 |
| Card heading | `16px / 24px` | 600 |
| Body | `14px / 22px` | 400–500 |
| Label form | `14px / 20px` | 500–600 |
| Caption/helper | `12px / 18px` | 400–500 |
| KPI/value penting (jika relevan) | `24–28px / 32–36px` | 700 |

Hindari body terlalu kecil, ALL CAPS untuk semua label, atau heading berlebihan. Batas lebar paragraf panjang sekitar 65–75 karakter bila memungkinkan.

## 4. Spacing, sizing, dan shape

- Sistem jarak berbasis kelipatan **4px**: `4 / 8 / 12 / 16 / 24 / 32 / 40 / 48`.
- Jarak antar elemen form: 12–16px; antar grup/section: 24–32px.
- Padding card: 16–24px; pada layar sempit dapat 16px.
- Radius: input dan button **8px**, card **12px**, badge **6px**; pertahankan konsistensi.
- Border default: 1px netral. Shadow card default minim/tanpa shadow; pakai shadow lembut hanya untuk modal/overlay atau pemisahan tingkat elevasi.
- Tinggi kontrol form dan button: sekitar **40–44px**, target sentuh minimal 44px bila sesuai konteks.
- Ikon: satu gaya outline yang konsisten, umumnya 16–20px; hindari ikon untuk dekorasi yang tidak menambah arti.

## 5. Pola layout

### Login / autentikasi

- Desktop: layout dua area boleh digunakan; bidang identitas biru dan bidang form putih. Form idealnya dibatasi lebar sekitar **400–440px**.
- Mobile: fokus pada form tunggal, branding ringkas, tidak membutuhkan panel hero tinggi.
- Form harus punya label nyata, indikator required yang jelas, show/hide password jika dibutuhkan, error inline, loading submit, dan tautan recovery yang jelas.
- Logo dan narasi mengikuti identitas SIPKITA, bukan gambar Pembayaran SPP.

### App shell / dashboard

- Desktop: sidebar berwarna primer sekitar **240–264px** sebagai ukuran awal, bisa disesuaikan panjang menu; header sekitar **56–64px**.
- Area konten memakai kanvas netral terang dan bidang/card putih; padding halaman 24–32px pada desktop, 16px pada mobile.
- Sidebar: teks/ikon kontras, grup menu dengan judul seperlunya, item aktif sangat jelas. Jangan menyalin struktur menu keuangan referensi.
- Tablet: sidebar boleh collapse; mobile: gunakan drawer/toggle yang operasional dan berlabel aksesibel.
- Judul halaman, deskripsi singkat, dan aksi utama berada pada hierarki yang jelas. Jangan memaksakan empat kartu KPI di semua dashboard.
- Layout data mengikuti kebutuhan: grid untuk ringkasan, tabel/list untuk data administrasi, detail panel untuk review, form untuk pengajuan.

### Error dan empty state

- Gunakan `surface.canvas`, card terpusat dengan lebar nyaman, judul singkat, penjelasan, dan satu aksi pemulihan utama.
- Gunakan warna warning/error seperlunya, tidak sebagai tema dominan seluruh halaman.
- Tombol Kembali dan Beranda hanya ditampilkan bila aksi navigasinya valid.

## 6. Komponen dasar dan states

| Komponen | Variasi minimum | Kondisi yang harus ditangani |
| --- | --- | --- |
| Button | primary, secondary, ghost, danger bila dibutuhkan | default, hover, focus, loading, disabled |
| Input/Textarea/Select | standar, invalid, readonly | label, hint, error, focus, disabled |
| Badge/Status | semantic success/warning/danger/info/neutral | teks status wajib terlihat |
| Card | informasi, ringkasan, tindakan | padding/radius/border konsisten |
| DataTable/List | judul, aksi kontekstual, filter jika diperlukan | loading, empty, error, pagination jika relevan |
| Alert/Notice | info, warning, success, danger | pesan singkat dan tindakan jelas |
| Modal/Dialog | konfirmasi/peringatan bila diperlukan | fokus keyboard, Escape, tombol batal/konfirmasi |
| Sidebar/Nav item | active, default, collapsed/mobile | akses berdasarkan role dan navigasi valid |

Jangan membuat semua komponen atau variasi sejak awal; implementasikan saat kebutuhan nyata muncul, lalu reuse.

## 7. Aksesibilitas dan responsivitas

- Pastikan kontras teks minimum WCAG AA yang relevan; evaluasi khusus teks kecil di bidang biru, badge, placeholder, dan disabled state.
- Gunakan semantic HTML, label yang terhubung ke input, fokus keyboard terlihat, dan navigasi tab yang logis.
- Pesan validasi harus menjelaskan masalah dan langkah perbaikan; jangan mengandalkan warna saja.
- Tabel kompleks perlu strategi mobile (horizontal scroll berlabel atau pola kartu yang menjaga seluruh informasi), bukan menyembunyikan kolom penting secara diam-diam.
- Gunakan breakpoint sesuai konten dan framework yang terpasang; uji minimal mobile (~375px), tablet (~768px), dan desktop (~1280px).
- Hormati `prefers-reduced-motion`; animasi tidak boleh menghambat tugas.

## 8. Aturan untuk coding agent

1. Baca `visual-direction.md` dan periksa styling/komponen existing sebelum mengimplementasikan halaman.
2. Jadikan tabel token sebagai keputusan desain awal. Implementasikan melalui mekanisme theme/Tailwind yang sudah dipakai proyek, bukan menabur hex dan ukuran acak.
3. Sesuaikan konten, istilah, kondisi, dan hak akses dengan sumber aturan bisnis SIPKITA. Jangan mengarang status, metrik, data akademik, API, maupun aksi.
4. Jangan menambah library, mengubah backend, database, auth, atau kontrak API saat tugasnya hanya styling UI tanpa kebutuhan dan persetujuan.
5. Gunakan prinsip komponen reusable dan struktur berbasis fitur yang sudah ada. Jangan membuat folder/abstraksi berlapis tanpa penggunaan nyata.
6. Review hasil visual desktop/mobile serta loading, error, empty, success, disabled, dan focus. Bandingkan **konsistensi gaya**, bukan kesamaan pixel dengan screenshot.
7. Jika aturan visual dan kebutuhan fungsional bertentangan, prioritaskan fungsi, aksesibilitas, dan aturan bisnis; laporkan tradeoff.

## 9. Hal yang perlu dikonfirmasi saat implementasi pertama

- Logo/identitas resmi SIPKITA dan apakah warna biru kandidat `#3B6FDF` disetujui.
- Font yang sudah digunakan proyek (jika ada) agar tidak memasang font duplikat.
- Komponen UI serta versi Tailwind yang sudah terpasang sebelum memilih mekanisme token CSS.
- Tampilan contoh halaman Login dan Dashboard Mahasiswa untuk kalibrasi pertama. Setelah pola disetujui, gunakan sistem yang sama pada seluruh role.
