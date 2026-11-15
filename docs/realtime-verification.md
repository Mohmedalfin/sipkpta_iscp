# Hasil verifikasi cache, SSE, dan event bus

Tanggal: 16 November 2026. Cakupan: implementasi tahap pertama/kedua.
Status awal audit: alur existing lulus; ditemukan tiga edge case. Ketiganya telah diperbaiki dan diuji ulang (lihat finalisasi di bawah).
Pada audit awal tidak ada perubahan source aplikasi, schema, migration, atau data development. Hanya dokumen ini dan script diagnostik lokal yang ditambahkan.

## Bukti pengujian

| Pemeriksaan | Hasil |
| --- | --- |
| Tes client existing terkait service/cache/parser/review | 18 PASS |
| Suite D–H PostgreSQL TEST dan tes realtime server | 6 PASS |
| Pengujian tambahan terisolasi | 3 PASS, 3 FAIL |
| Build Vite | PASS; warning bundle >500 kB existing |
| git diff --check | PASS; pemberitahuan konversi line ending Git |

Perintah client:
`node --test client/test/realtime.test.js client/test/apiServices.test.js client/test/reviewerKp.test.js client/test/kpForm.test.js client/test/kaprodiReviewerKp.test.js`

Perintah server dari `server/`, dengan flag `SIPKITA_PENGAJUAN_KP_REAL_DB=1`:
`node --test test/pengajuan-kp.postgres.test.js test/realtime.test.js`
Suite memeriksa identitas database TEST
`sipkita_test_kp_d1_spp_20261105070147_1066f27b` sebelum operasi mutatif dan membersihkan fixture.

Reproduksi tambahan: `node --test .tmp/realtime-verification.test.mjs`.
Script .tmp merupakan artefak lokal yang diabaikan Git, bukan bagian suite default.
Pengujian memakai mock transport/timer dan subscriber terkontrol, tanpa database.

## Temuan yang direproduksi

1. **Sedang — reconnect terlalu sering saat stream tidak stabil.**
   `client/src/services/realtime.js` mereset penghitung kegagalan setiap menerima
   `ready`, meskipun koneksi langsung putus. Simulasi dua siklus menghasilkan jeda
   1000/1000 ms (jitter dinonaktifkan), bukan backoff yang meningkat. Putus sebelum
   ready tetap mengikuti jalur backoff existing. Rekomendasi: reset penghitung hanya
   setelah koneksi cukup stabil, dengan pengujian timer untuk kedua kondisi.

2. **Sedang — respons mutasi bergantung pada subscriber realtime.**
   `server/src/services/realtime.service.js` menunggu listener secara berurutan.
   Subscriber SSE menjalankan pemeriksaan database sebelum mengirim event. Tes
   menahan satu listener dan membuktikan hasil operasi post-commit belum kembali
   hingga listener dilepas. Data telah commit; respons yang lama dapat menimbulkan
   timeout client dan percobaan ulang. Reproduksi ini bukan pengukuran kapasitas
   produksi. Rekomendasi: pisahkan publikasi/delivery dari respons mutasi, memakai
   antrean terbatas, penanganan rejection, dan kebijakan overload/resinkronisasi.

3. **Rendah — unsubscribe belum idempotent.**
   Setelah listener terakhir dilepas lalu subscription baru dibuat untuk user yang
   sama, pemanggilan ulang cleanup lama menghapus entri Map subscription baru.
   Tes menghasilkan nol event diterima, seharusnya satu. Route saat ini mempunyai
   guard `closed` yang mengurangi kemungkinan jalur ini; helper tetap rapuh untuk
   lifecycle/reuse. Rekomendasi: guard unsubscribe dan cocokkan identitas grup Map
   sebelum menghapusnya.

## Kasus tambahan yang lulus

- Respons stream 401 memanggil jalur API bersama, kemudian reconnect memakai token
  terbaru. Mock menguji pemanggilan jalur tersebut, bukan seluruh rotasi JWT browser.
- Respons 403 menghentikan reconnect.
- Invalidasi query form yang disabled tidak memicu fetch atau mengganti cache lokal.
- Tes existing mencakup parser terfragmentasi, pembatalan stale request, deduplikasi
  fetch, commit/rollback event, idempotensi bulk, scope fail-closed, dan sesi dicabut.

## Batas keyakinan

- Belum ada pengujian otomatis React/browser untuk penggabungan event 250 ms,
  perubahan visibility tab, StrictMode, pergantian akun/role, dan persistensi isian
  modal. Pemeriksaan kode bukan pengganti simulasi lifecycle tersebut.
- Belum ada uji watchdog/reconnect waktu nyata, proxy buffering, HTTP/2, slow client,
  banyak tab, atau load/soak test dengan pengguna serentak.
- Tiga kegagalan tambahan tidak ditutupi oleh kelulusan tes existing. Implementasi
  belum dinyatakan bebas celah atau siap beban produksi.
- Batas kartu ringkasan 100 baris, backend satu proses, serta modul yang belum
  dimigrasikan tetap mengikuti batas cakupan arsitektur sebelumnya.


## Finalisasi perbaikan setelah persetujuan

Ketiga temuan telah diperbaiki tanpa perubahan UI, dependency, schema/migrasi, atau sipkita_dev:

- `client/src/services/realtime.js`: ready tidak mereset backoff. Reset hanya setelah
  menerima data pada stream yang bertahan minimal 60 detik. Jeda bertahap 1-30 detik
  ditambah jitter sampai 500 ms dipertahankan.
- `server/src/services/realtime.service.js`: publikasi hanya memasukkan event ke antrean
  subscriber tanpa menunggu penyelesaian subscriber. Satu pengiriman berjalan per
  subscriber, maksimal 64 hint tertunda; hint type/resource sama digabung.
  Overflow, kegagalan listener, atau waktu pengiriman 10 detik menutup subscription.
  Unsubscribe idempotent tidak menghapus subscription baru.
- `server/src/routes/realtime.routes.js`: penutupan dari event bus menutup stream SSE.
  Client melakukan resinkronisasi setelah reconnect; otorisasi event tetap diperiksa.
- `client/test/realtimeConnection.test.js` dan `server/test/realtime.test.js`: kasus
  diagnostik dipindahkan menjadi tes terpelihara, ditambah pengujian batas backoff,
  koneksi sehat, 100 event, coalescing, isolasi subscriber, overflow, dan timeout.

Verifikasi ulang:

| Pemeriksaan | Hasil |
| --- | --- |
| Tes client realtime/connection/services/form/reviewer/kaprodi | 23 PASS, 0 FAIL |
| Tes server realtime + regresi D-H PostgreSQL TEST | 11 PASS, 0 FAIL |
| Build frontend | PASS; warning bundle >500 kB existing |
| git diff --check | PASS |

Client: perintah audit sebelumnya ditambah `client/test/realtimeConnection.test.js`.
Server: perintah audit sebelumnya tetap, target TEST dan cleanup fixture tetap dijaga.
Warning pg terkait query concurrent existing dan warning experimental MockTimers pada
pengujian timeout masih muncul; tidak ada test gagal.

Batas hasil: belum merupakan uji kapasitas deployment atau soak test browser.
Lookup metadata penerima sebelum enqueue masih ditunggu oleh publisher. Timeout
subscriber menutup koneksi dan menghentikan antrean, tetapi tidak membatalkan query
Prisma yang sudah berjalan; tidak menjalankan task pengganti pada subscription itu.
Event tetap best-effort, single-process, dengan rekonsiliasi REST sebagai pengaman.
