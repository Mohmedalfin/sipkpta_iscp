# PRD — Konfigurasi Master Pengajuan KP SIPKITA

**Versi:** 1.0 — 5 November 2026  
**Status:** Rancangan untuk audit dan persetujuan; **belum mengizinkan perubahan database**  
**Target:** PostgreSQL `sipkita_dev` (setelah simulasi pada database TEST terisolasi)

## 1. Tujuan dan kondisi awal

Menyiapkan master **Tahap Akademik, Periode Akademik, Jadwal Proses, Jenis Dokumen, dan Persyaratan Pengajuan KP** agar backend dapat memvalidasi, menyimpan, dan memproses pengajuan mahasiswa dengan konfigurasi yang konsisten. Master development ini **bukan** jadwal akademik resmi UTY.

Audit sebelumnya menyatakan:

- Migrasi `20261105000000_pengajuan_kp_admin_fields` sudah berhasil diterapkan; Prisma menunjukkan empat migrasi selesai.
- Struktur `Pengajuan` beserta relasi mahasiswa, topik, dokumen, Reviewer, dan Pembimbing tersedia, tetapi endpoint KP belum dibuat.
- Master tahap `KP`, periode, jadwal pengajuan, jenis dokumen KP, dan persyaratannya **belum ada**.
- Enam jenis dokumen Data Diri dan layanan verifikasi Data Diri **sudah ada**; jangan membuat ulang atau mencampurkannya dengan dokumen Pengajuan KP.

## 2. Aturan bisnis KP yang mengikat

1. Mahasiswa boleh **submit** KP apabila **enam dokumen Data Diri terkini telah diunggah** dan formulir serta persyaratan KP lengkap. Status Data Diri belum harus `TERVERIFIKASI` pada tahap submit.
2. **Admin Prodi** memeriksa kategori **Berkas** dan **Nilai**, masing-masing dengan status serta satu catatan kategori; kemudian menetapkan **Status Pengajuan** (`ACC`/`TIDAK_ACC`) beserta catatannya. Untuk memberikan `ACC`, pemeriksaan Berkas dan Nilai harus memenuhi syarat serta agregat Data Diri harus `TERVERIFIKASI`.
3. **Kaprodi** dapat menugaskan Reviewer setelah pengajuan dikirim, **paralel** dengan pemeriksaan Admin Prodi. Umumnya dua Reviewer, tetapi desain tidak boleh mengunci jumlah tepat dua.
4. Hasil review proposal (`LAYAK`/`TIDAK_LAYAK`) **tidak menjadi gerbang otomatis** ACC administratif KP. Riwayat review mengikuti versi proposal terkini.
5. Setelah Admin Prodi memberikan `ACC`, **Kaprodi** menetapkan Pembimbing final secara eksplisit: dapat sesuai usulan mahasiswa atau seorang Reviewer aktif yang ditugaskan pada pengajuan tersebut. Usulan mahasiswa bukan penetapan otomatis.
6. KP baru siap dimulai setelah Pembimbing final ditetapkan. Aturan di sini **khusus KP**; jangan mengubah aturan ISCP, TA, pengajuan ulang, atau perpanjangan.

## 3. Rancangan master development

Nilai berikut merupakan **kontrak yang diusulkan**, bukan perintah SQL. Codex wajib menyesuaikan dengan nama kolom, panjang field, nilai kode yang sudah berlaku, FK, dan constraint aktual `schema.prisma` sebelum menyiapkan seed.

| Master | Nilai / ketentuan |
| --- | --- |
| `TahapAkademik` | `kode_tahap = KP`, nama `Kerja Praktik`, urutan `1`, aktif. Jangan mengarang nilai batas perpanjangan; tandai keputusan tertunda bila field wajib. |
| `PeriodeAkademik` | Periode khusus development berlabel **DEV KP — Ganjil 2026/2027**; tahun `2026/2027`, semester `GANJIL`, status yang dipetakan sebagai aktif berdasarkan kontrak schema/service. Jangan menyatakannya sebagai periode resmi. |
| `JadwalProses` | Jenis proses yang diusulkan `PENGAJUAN_REGULER` untuk tahap `KP` dan periode development. Mulai **1 Nov 2026 pukul 00:00 WIB**, selesai **31 Jan 2027 pukul 23:59 WIB**, aktif. Simpan dan bandingkan waktu secara konsisten dengan zona `Asia/Jakarta`. |
| `JenisDokumen` | Lima jenis dokumen pada tabel di bawah; PDF sesuai formulir SIPKPTA lama. Ukuran maksimum ikuti kebijakan penyimpanan yang telah ada atau minta keputusan eksplisit. |
| `PersyaratanPengajuan` | Kaitkan dengan periode development, tahap `KP`, dan **jalur pengajuan reguler baru** yang benar-benar didukung oleh data/model. Jangan menerapkan aturan yang belum dibahas pada jalur perpanjangan/ulang. |

Kode `PENGAJUAN_REGULER`, nilai status aktif, dan kode jalur **harus diverifikasi** terhadap schema, seed, dan aturan yang sudah ada; jangan memperkenalkan string baru secara diam-diam jika ada konvensi lain.

## 4. Jenis dokumen dan aturan persyaratan KP

| Usulan kode unik jenis dokumen | Nama | Persyaratan ketika submit |
| --- | --- | --- |
| `BUKTI_BAYAR_PROPOSAL_KP` | Bukti Pembayaran Proposal KP | **Wajib** |
| `PROPOSAL_KP` | Proposal KP | **Wajib**, PDF versi terbaru |
| `BUKTI_SPP_VARIABEL_KP` | Bukti Pembayaran SPP Variabel KP | **Kondisional:** diunggah apabila sudah membayar |
| `SERTIFIKAT_SOSIALISASI_KP` | Sertifikat Sosialisasi KP | **Alternatif** dengan surat pengganti |
| `SURAT_PERNYATAAN_SOSIALISASI_KP` | Surat Pernyataan Pengganti Sosialisasi | **Alternatif** dengan sertifikat |

**Semantik konfigurasi penting:**

- Tandai dua dokumen pertama sebagai wajib pada persyaratan individu. Jangan menandai kedua dokumen sosialisasi sebagai wajib sekaligus.
- Pada **validasi submit**, minimal **salah satu** dari sertifikat sosialisasi atau surat pengganti harus tersedia. Jika keduanya ada, tentukan secara konsisten mana yang dipakai; jangan menghapus arsip historis.
- Bukti SPP bersifat opsional pada konfigurasi per-item; jika mahasiswa secara eksplisit menyatakan **sudah membayar**, bukti harus tersedia. **Gap yang perlu diverifikasi:** bila schema/form tidak menyimpan deklarasi pembayaran, backend tidak dapat membedakan “belum membayar” dengan “sudah membayar tetapi lupa unggah”. Jangan mengklaim validasi kondisional otomatis sudah lengkap; laporkan kebutuhan field atau keputusan pemeriksaan manual sebelum implementasi endpoint.
- Nominal Rp175.000 dan meterai Rp10.000 adalah **contoh formulir tahun 2022**, bukan nominal yang disahkan untuk 2026. Jangan di-hardcode ke master/validasi tanpa konfirmasi Prodi.
- Lima dokumen tersebut terpisah dari **enam dokumen Data Diri**. Penyimpanan privat, riwayat versi, dan pembatasan akses mengikuti pola modul yang telah ada.
- Jika `PersyaratanPengajuan` hanya memiliki `is_wajib`, **group alternatif** dan aturan SPP belum bisa dijelaskan sepenuhnya oleh konfigurasi tabel. Opsi minimal untuk MVP adalah **aturan validasi terpusat di service** dan tes integrasi. Jika persyaratan harus dapat dikelola secara dinamis oleh Admin Sistem, ajukan desain schema tambahan secara terpisah sebelum membuat migration.

## 5. Kebutuhan kontrak untuk backend berikutnya

- Backend menentukan periode/jadwal aktif **di server**; mahasiswa tidak boleh mengirim ID periode arbitrer untuk melewati jadwal.
- Submit harus memeriksa kepemilikan mahasiswa, scope Prodi, kelengkapan Data Diri, kelengkapan formulir, jenis/versi dokumen, periode/tahap/jalur yang cocok, dan waktu saat submit.
- Mencegah dua pengajuan **reguler aktif** pada mahasiswa–tahap–periode yang sama harus aman terhadap concurrency. Definisi status/jalur aktif masih perlu dikunci; **jangan membuat indeks unik spekulatif**.
- Koreksi dokumen mempertahankan riwayat; tidak menghapus versi lama. Perubahan status pemeriksaan dan keputusan perlu audit yang jelas.
- Reviewer dapat ditugaskan setelah submit; Admin Prodi tidak menunggu hasil `LAYAK` untuk mengambil keputusan administratif.
- Pengajuan `ACC` administratif belum otomatis berarti siap bimbingan; penetapan Pembimbing Kaprodi tetap diperlukan.

## 6. Urutan kerja Codex dan batasan kewenangan

### Fase A — Audit/draft, READ-ONLY (tahap saat ini)

1. Cocokkan setiap nama model, field, enum/string, FK, dan constraint terhadap `server/prisma/schema.prisma` dan seed yang ada.
2. Inventarisasi master yang sudah ada agar tidak membuat kode/relasi duplikat. Periksa apakah periode bisa dibedakan secara tegas sebagai **development**.
3. Susun rancangan seed/SQL **idempotent**, relasi record, serta query preflight/postflight tanpa menjalankannya.
4. Laporkan gap SPP, alternatif sosialisasi, status/jalur aktif, ukuran PDF, dan atribut batas perpanjangan yang belum pasti. **Berhenti untuk evaluasi.**

### Fase B — Uji terisolasi (memerlukan persetujuan terpisah)

Uji konfigurasi pada database PostgreSQL **TEST** yang jelas identitasnya. Pastikan pengulangan seed tidak membuat duplikat, FK valid, dan validasi master mengembalikan satu kombinasi periode/tahap/jadwal KP yang tepat.

### Fase C — Terapkan di `sipkita_dev` (memerlukan persetujuan terpisah)

Sebelum operasi tulis, ulangi identitas database dan preflight, periksa titik pemulihan, terapkan **hanya data master yang disetujui**, lalu verifikasi jumlah record dan tidak berubahnya data lama. Jangan mengubah migration yang sudah diterapkan atau menyentuh indeks parsial lama.

## 7. Kriteria penerimaan

- Satu tahap `KP` aktif; satu periode development yang jelas; jadwal KP terikat pada periode dan tahap yang benar.
- Lima jenis dokumen KP serta persyaratan untuk jalur yang disetujui tersedia tanpa duplikasi, dengan aturan **dua wajib + satu alternatif sosialisasi + SPP kondisional** terdokumentasi dalam kontrak validasi.
- Konfigurasi dapat diambil backend tanpa mengandalkan ID hardcoded atau tanggal dari client.
- Konfigurasi master **tidak dengan sendirinya berarti endpoint sudah berjalan**. Layanan, route, otorisasi, transaksi, dan integration test merupakan fase backend berikutnya.
- Tidak ada perubahan database/file saat Fase A. Setiap operasi tulis pada database TEST maupun `sipkita_dev` membutuhkan instruksi/otorisasi tersendiri.

## 8. Di luar cakupan PRD ini

Implementasi endpoint KP, UI/frontend, OpenAPI/dokumentasi runtime, konfigurasi master ISCP/TA, persetujuan Kaprodi untuk perpanjangan, perubahan schema/migration baru, serta penggantian aturan verifikasi Data Diri yang sudah berjalan.
