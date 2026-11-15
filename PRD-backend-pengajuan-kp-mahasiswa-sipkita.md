# PRD — Backend Pengajuan KP Mahasiswa | SIPKITA

**Versi:** 1.0 — 5 November 2026  
**Status:** Rancangan implementasi; belum mengizinkan migrasi atau perubahan database  
**Cakupan eksekusi berikutnya:** REST API pada `server/`, khusus **KP — REGULER — BARU**

## 1. Tujuan dan kondisi awal

Mahasiswa dapat membuka formulir KP berdasarkan master aktif, menyimpan/mengubah draft, mengunggah atau mengganti dokumen PDF secara bertahap, mengirim pengajuan yang lengkap, serta memantau status dan riwayat miliknya. Implementasi menggunakan fondasi Pengajuan bersama agar kelak dapat diperluas ke ISCP/TA tanpa menggandakan model/engine; **aturan tahap lain belum dikerjakan**.

**Baseline terverifikasi oleh Codex, 5 November 2026:** `sipkita_dev` telah memiliki empat migrasi selesai dan 13 konfigurasi master KP (1 tahap, 1 periode, 1 jadwal, 5 jenis dokumen, 5 persyaratan). Periode development: `2026/2027 GANJIL`, status `AKTIF`. Jadwal `PENGAJUAN_REGULER`: 1 November 2026 pukul 00:00 sampai 31 Januari 2027 pukul 23:59 WIB. Dua dokumen wajib; tiga adalah kondisional/alternatif. **Tidak perlu mengulang audit master atau seed.** Backend Pengajuan belum ada saat laporan D1.

## 2. Aturan bisnis KP yang mengikat

1. **Mahasiswa** mengisi pengajuan miliknya sendiri. Tahap/jalur tahap pertama: `KP`, `jenis_pengajuan=REGULER`, `pilihan_topik=BARU`. Periode, jadwal, persyaratan, dan identitas mahasiswa ditetapkan/divalidasi **oleh server**, bukan dipercaya dari payload.
2. **Syarat submit Data Diri: enam dokumen terkini sudah diunggah** (`IJAZAH`, `KK`, `KTP`, `AKTA`, `KTM`, `FORM_DATA_DIRI`). **Tidak perlu `TERVERIFIKASI` untuk submit.** Status agregat `TERVERIFIKASI` baru diwajibkan sebelum **Admin Prodi memberikan ACC administratif KP**. Ini mengoreksi satu butir keliru pada laporan audit D1 dan mengesampingkan dokumen lama yang berbeda khusus untuk KP.
3. **Admin Prodi** memeriksa tiga kategori Berkas, Nilai, dan Pengajuan; memutuskan administratif `ACC`/`TIDAK_ACC` berikut catatan/status masing-masing. **Kaprodi** menugaskan Reviewer setelah submit (paralel dengan Admin), lalu menetapkan Pembimbing final **setelah ACC Admin**. Hasil Reviewer **tidak otomatis menjadi gate ACC administratif KP**. Tidak ada implementasi endpoint Admin/Kaprodi/Reviewer di PRD ini.
4. Mahasiswa hanya **mengusulkan** dosen pembimbing; usulan bukan penugasan. Dosen kandidat harus aktif dan sesuai lingkup Prodi.
5. Data IPK, SKS, dan nilai D/E merupakan **snapshot isian mahasiswa**; Admin Prodi akan memverifikasi manual pada fase berikutnya. Jangan mengintegrasikan SIKADU atau menganggap angka mahasiswa sebagai bukti pengesahan. Jangan menciptakan batas minimum IPK/SKS tanpa ketentuan resmi.
6. Semua dokumen KP merupakan PDF: proposal maksimum **10 MB**, empat jenis lainnya **5 MB** sesuai master; ambil aturan ukuran/format dari master yang sudah tersedia. Harga lama formulir tahun 2022 bukan nominal resmi 2026 dan **jangan di-hardcode**.
7. Riwayat topik, proposal, dokumen, dan status dipertahankan. Penggantian satu berkas membuat versi baru; tidak menghapus atau mengunggah ulang berkas lain.

## 3. Kontrak formulir dan pemetaan data

Nama field di bawah adalah **kontrak logis**; saat implementasi cocokkan dengan atribut aktual `schema.prisma` sebelum menggunakan nama tertentu dalam query. Jangan membuat duplikasi model.

| Bagian form KP | Input/aturan | Penyimpanan yang tersedia menurut audit D1 |
| --- | --- | --- |
| Identitas | Mahasiswa/NIM/Prodi dari sesi dan profil, hanya tampil | `User`, `Mahasiswa`, relasi Prodi |
| Tema KP | Pilih tema aktif yang berhak digunakan | `TemaPenelitian`, relasi `TopikPenelitian` |
| Judul | Teks wajib | `VersiTopik.judul_penelitian` |
| Studi kasus dan lokasi | Objek/instansi dan lokasi yang jelas | `objek_penelitian`, `lokasi_penelitian` pada model terkait |
| Usulan Pembimbing | ID dosen aktif satu Prodi; tidak otomatis ditetapkan | `Pengajuan.usulan_pembimbing_id` |
| Akademik | IPK (0–4), jumlah SKS bilangan bulat tak negatif, punya nilai D/E YA/TIDAK; jika YA, daftar mata kuliah wajib | Snapshot IPK/SKS/D-E dan `daftar_mk_nilai_de` pada `Pengajuan` |
| SPP Variabel | Jawaban eksplisit YA/TIDAK; jika YA bukti PDF wajib | **SCHEMA GAP:** belum ada field deklarasi |
| Kebenaran data | Checkbox persetujuan saat kirim, bukan timestamp dari browser | `Pengajuan.pernyataan_kebenaran_disetujui_at` — isi waktu server saat submit |
| Dokumen | Unggah sesuai lima persyaratan KP yang aktif | `PersyaratanPengajuan`, `Dokumen`, `DokumenPengajuan` |
| Relasi topik/pengajuan | Topik + versi dan draft dimiliki mahasiswa, tetap dapat ditelusuri | `TopikPenelitian`, `VersiTopik`, `Pengajuan` |

### Aturan lima dokumen KP

| Kode jenis dokumen | Kondisi saat submit |
| --- | --- |
| `BUKTI_BAYAR_PROPOSAL_KP` | **Wajib** |
| `PROPOSAL_KP` | **Wajib**; versi proposal terkini |
| `BUKTI_SPP_VARIABEL_KP` | **Wajib jika deklarasi SPP = YA**; bila TIDAK, tidak diwajibkan |
| `SERTIFIKAT_SOSIALISASI_KP` | Alternatif dengan surat pengganti |
| `SURAT_PERNYATAAN_SOSIALISASI_KP` | Alternatif dengan sertifikat |

Minimal **satu** dari dua bukti sosialisasi harus ada; keduanya tidak boleh menjadi wajib secara individual. Aturan kondisional SPP dan alternatif sosialisasi dijaga dalam **satu validator KP di service**, karena master saat ini hanya mengenal `is_wajib` per item. Jangan membuat tabel grup dokumen generik untuk MVP. Jika ada bukti bayar SPP tetapi deklarasi TIDAK, minta konsistensi input sebelum submit; jangan menebak jawaban.

## 4. Endpoint yang dibuat (hanya role MAHASISWA)

Gunakan prefix `/api` dan konvensi respons/error aktual proyek. Nama path final boleh diselaraskan dengan router yang ada **tanpa mengubah semantik dan tanpa membuat alias ganda**.

| Metode | Endpoint usulan | Fungsi dan aturan utama |
| --- | --- | --- |
| `GET` | `/api/pengajuan/opsi-form?tahap=KP` | Satu payload: tahap/periode/jadwal aktif, `is_open` dan batas waktu, tema KP, kandidat dosen sesuai Prodi, persyaratan + batas unggah, progres 6 dokumen Data Diri. Read-only; bila tutup, tampilkan alasan. |
| `GET` | `/api/pengajuan` | Daftar ringkas pengajuan **milik mahasiswa login** (termasuk histori) dengan filter/pagination sederhana; tidak bocor data mahasiswa lain. |
| `POST` | `/api/pengajuan` | Buat **draft KP REGULER BARU**. Server menetapkan mahasiswa/tahap/periode, memeriksa jadwal, ownership, dan benturan pengajuan; simpan topik/versi dan snapshot form konsisten. |
| `GET` | `/api/pengajuan/:id` | Detail draft/submitted milik sendiri: formulir, status Berkas/Nilai/Pengajuan + catatan yang aman, daftar dokumen terkini, info revisi dan riwayat yang tersedia. |
| `PATCH` | `/api/pengajuan/:id` | Ubah field formulir **hanya jika DRAFT**; jaga historis versi topik. Tolak overwrite ID mahasiswa/periode/status/role dari payload. |
| `POST` | `/api/pengajuan/:id/dokumen` | Multipart PDF + `kode_jenis`; unggah/ganti **satu** jenis dokumen pada draft. Buat `Dokumen` + versi `DokumenPengajuan` terkini, pertahankan versi lama. |
| `GET` | `/api/pengajuan/:id/dokumen/:dokumenId/file` | Unduh/preview privat dengan cek pemilik pengajuan dan kaitan dokumen; tidak ada URL publik/storage key dalam respons. |
| `POST` | `/api/pengajuan/:id/kirim` | Submit atomik: ulang seluruh pemeriksaan, wajib `setuju_pernyataan=true`, isi timestamp persetujuan dan `diajukan_at` dari server, ubah status draft ke status terkirim yang disepakati dan catat riwayat. |

**Tidak dibuat sekarang:** endpoint keputusan Admin Prodi, penugasan Reviewer/Pembimbing Kaprodi, review dosen, perpanjangan, pengajuan ulang, ISCP/TA, frontend, notifikasi, integrasi SIKADU, maupun dokumentasi Scalar/OpenAPI (ditangani pekerjaan lain). Revisi **setelah submit** akibat `BELUM_OK` akan dikembangkan bersama alur Admin Prodi; jangan membuat PATCH bebas pada pengajuan yang sudah dikirim.

## 5. Validasi dan transisi utama

### DRAFT

- Pengajuan baru hanya dibuat untuk mahasiswa aktif dengan role aktif `MAHASISWA` dan profil valid. Identitas diambil dari auth. Dosen usulan/tema dicek aktif dan scoped ke Prodi.
- Status awal `DRAFT`; kategori Berkas/Nilai tetap `BELUM_DIPERIKSA` dan keputusan pengajuan belum `ACC`/`TIDAK_ACC`. Jangan set pemeriksa atau tanggal keputusan.
- Periode/jadwal dipilih dari konfigurasi aktif yang *unambiguous*, dengan pembandingan waktu konsisten `Asia/Jakarta`. `GET opsi-form` boleh menampilkan `is_open=false`; **buat draft dan submit** hanya ketika jadwal terbuka. Jangan menerima `periode_akademik_id` arbitrer untuk bypass.
- Bila sudah ada draft sendiri pada kombinasi mahasiswa–tahap–periode–jalur, kembalikan informasi draft itu atau respons konflik yang terarah; jangan diam-diam menggandakan.

### SUBMIT

Service wajib memeriksa ulang dalam satu operasi terkoordinasi:

1. Pemilik dan status `DRAFT`, tahap KP, jalur `REGULER/BARU`, periode dan jadwal terbuka **pada waktu server**.
2. Tema/judul/objek/lokasi/usulan dosen, IPK, SKS, jawaban D/E dan daftar matkul bila relevan, serta deklarasi SPP telah terisi valid. Tidak ada batas angka kelayakan akademik selain validitas bentuk input yang belum disahkan Prodi.
3. Keenam dokumen Data Diri **terkini ada**, tanpa mensyaratkan agregat `TERVERIFIKASI`.
4. Seluruh persyaratan dokumen untuk kombinasi master aktif cocok; dua wajib tersedia, bukti SPP tersedia jika YA, sertifikat **atau** surat pengganti tersedia; file/versi terkini valid dan benar-benar terkait pengajuan tersebut.
5. Checkbox kebenaran data disetujui secara eksplisit. Timestamp diisi server **hanya setelah validasi sukses**.
6. Tidak ada pengajuan KP reguler lain yang berbenturan untuk mahasiswa/tahap/periode. **Kontrak status aktif belum final**, sehingga untuk MVP jangan membuat partial unique index spekulatif: cegah dua permohonan `REGULER/BARU` pada kombinasi itu (termasuk yang sudah terkirim) dan arahkan kasus pengajuan ulang resmi ke keputusan terpisah. Gunakan transaksi dengan pengamanan concurrency (misalnya isolation `Serializable` + retry bounded untuk konflik) dan tes dua submit simultan.
7. Simpan perubahan status dan `RiwayatStatusPengajuan` jika model/kontrak nyata mendukung. Gunakan **kode status terkirim yang sesuai implementasi aktual**; bila belum ada kesepakatan kode, laporkan satu keputusan blocker itu sebelum mengaktifkan submit. Repeated request tidak membuat pengajuan/riwayat duplikat.

Status Berkas, Nilai, dan keputusan pengajuan **tidak** ditetapkan mahasiswa. Data Diri `TERVERIFIKASI` adalah gate **ACC Admin Prodi nanti**, bukan gate mahasiswa saat submit. Hasil review proposal tidak mengubah keputusan administratif KP secara otomatis.

## 6. Keamanan, konsistensi, dan reuse

- Ikuti lapisan `route → controller → service → Prisma` dengan validasi input/middleware/error handler existing. Model helper hanya jika pola repo benar-benar menggunakannya. Hindari refaktor login/Data Diri/master.
- Terapkan auth, role aktif, kepemilikan record, dan scope Prodi **pada setiap endpoint termasuk file download**; jangan percaya `mahasiswa_id`, `user_id`, `status_*`, `dibuat_oleh`, atau timestamps dari body.
- Reuse validator PDF dan private storage dari Data Diri: pemeriksaan ekstensi, MIME, signature PDF, ukuran dari master, nama/key acak, no public static files, `nosniff`, `Cache-Control: private, no-store`. Hindari log PII, path fisik, dan isi dokumen.
- Transaksi untuk topik+versi+draft, penggantian versi dokumen, dan submit+riwayat. Kelola kegagalan penulisan file/DB agar tidak meninggalkan file atau metadata yatim. Jangan menghapus versi lama.
- **Concurrency:** jaga hanya satu versi `is_terkini=true` per kombinasi pengajuan/persyaratan. Tangani retry transaksi yang aman; hindari duplikasi akibat upload/submit paralel.
- Jangan memanfaatkan hasil `prisma migrate diff` untuk rebuild indeks parsial lama (`uq_pembimbing_aktif`, `uq_seminar_terjadwal`). Jangan jalankan `db push`, `migrate reset`, atau seed global.
- **Database pengujian:** gunakan TEST PostgreSQL terisolasi untuk uji write/HTTP; **jangan** mengirim POST/PATCH/upload/submission tes ke `sipkita_dev` tanpa persetujuan khusus. Query GET diagnostik yang aman boleh mengikuti izin yang tersedia.

## 7. Satu gap schema yang harus ditangani sebelum submit

Laporan D1 memastikan belum ada tempat menyimpan jawaban SPP Variabel YA/TIDAK. **Rekomendasi aditif minimal**: field nullable Boolean pada `Pengajuan` (misal `sudah_bayar_spp_variabel Boolean?`), `NULL` untuk draft/record historis dan **wajib bukan NULL saat submit**. `true` mewajibkan bukti PDF, `false` tidak. Jangan menganggap keberadaan berkas sebagai pengganti pernyataan.

**Batas otorisasi:** Codex boleh mencocokkan field aktual dan **menyiapkan draft** schema/migration minimal jika belum ada ekuivalen. **Tidak boleh menerapkan migrasi ke `sipkita_dev`/database lain tanpa persetujuan terpisah.** Jika gap ini menghambat endpoint submit, berhenti pada draft perubahan dan laporkan secara singkat; bagian endpoint yang tidak memerlukan kolom baru boleh disiapkan tanpa mengklaim alur lengkap sudah PASS.

## 8. Urutan pengerjaan Codex yang hemat token

1. **Persiapan singkat (bukan audit penuh):** baca hanya `AGENTS.md`, `server/prisma/schema.prisma` model terkait, implementasi auth/Data Diri/upload, route/controller/service pattern, dan master KP. Di repo, bila tersedia gunakan hanya skill `.agents/skills/feature-implementation/SKILL.md` dan `.agents/skills/code-change-verification/SKILL.md`; `prisma-schema-change` hanya bila menyiapkan draft gap SPP. Jangan memuat semua skill dan semua `docs/`.
2. **D0 — Gap SPP:** siapkan draft aditif dan laporkan apakah persetujuan migrasi diperlukan. Tidak perlu audit ulang Fase A–C.
3. **D2 — Endpoint inti:** setelah kebutuhan schema disetujui, implementasikan opsi-form, daftar/detail, draft, edit, upload/download, dan kirim. Pecah implementasi menjadi vertical slice wajar tanpa overengineering; kerjakan hanya Fase D mahasiswa.
4. **Tes terarah:** pengujian service dan HTTP dengan fixture TEST; jalankan lint/syntax dan `git diff --check`; nyatakan jelas jika suatu tes belum dapat dijalankan.
5. **Laporan akhir ringkas:** endpoint selesai, file berubah, tes PASS/FAIL, DB mana disentuh/tidak, satu blocker utama dan langkah berikutnya. Jangan membuat laporan audit berulang.

## 9. Definition of Done / acceptance tests

| Skenario | Ekspektasi |
| --- | --- |
| Buka form | Hanya master KP aktif & periode/jadwal tepat; tema/dosen relevan; tutup jadwal ditampilkan jelas |
| Draft mahasiswa A | Berhasil; mahasiswa B tidak bisa membaca/mengubah/unduh |
| Edit draft | Validasi judul/IPK/SKS/D-E/SPP; tidak boleh mengubah kepemilikan/status dari payload |
| Upload proposal PDF | Maksimum 10 MB; dokumen lainnya 5 MB; non-PDF/palsu/oversize ditolak |
| Ganti satu PDF | Versi baru terkini, versi lama tersimpan, jenis lain tidak berubah |
| Submit saat 6/6 Data Diri terunggah namun belum diverifikasi | **Diperbolehkan** jika seluruh syarat KP lainnya lengkap |
| Submit ketika Data Diri kurang dari 6 | Ditolak dengan daftar syarat yang kurang |
| SPP YA tanpa bukti / SPP TIDAK tanpa bukti | YA ditolak; TIDAK diizinkan bila syarat lain lengkap |
| Sertifikat dan surat sama-sama kosong | Ditolak; salah satu ada diizinkan |
| Tidak menyetujui pernyataan kebenaran | Submit ditolak, timestamp tetap NULL |
| Submit di luar jadwal / role lain / mahasiswa lain | Ditolak, tidak ada perubahan state |
| Submit ganda atau paralel | Maksimal satu pengajuan sah; tidak ada riwayat duplikat |
| Submit sukses | Status terkirim dan waktu server tercatat, kategori Berkas/Nilai masih belum diperiksa; proposal/dokumen dapat dibaca pemilik |
| Uji regresi | Auth, Data Diri, master, empat migrasi, serta indeks parsial lama tetap aman |

## 10. Referensi yang benar-benar relevan

- Sumber proyek utama: `AGENTS.md`; `server/prisma/schema.prisma`; modul auth dan Data Diri aktual; `docs/api-conventions.md`; `docs/business-rules/pengajuan.md` (**abaikan konflik aturan KP lama jika bertentangan dengan Bagian 2 PRD ini**).
- Skill repo saat **implementasi**: `feature-implementation`, `code-change-verification`. Saat **draft migration SPP saja**: `prisma-schema-change`, jika benar tersedia dalam repo.
- [Prisma ORM v7 — Transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions): konsistensi perubahan multi-tabel, isolasi dan retry konflik.
- [OWASP — File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): validasi file dan penyimpanan privat.

**Dokumen ini belum menjalankan endpoint, mengubah schema, atau menerapkan migrasi.**
