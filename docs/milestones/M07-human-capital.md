# M7 — Human Capital

**Status:** Belum mulai
**Tahap PRD:** H (Human Capital)
**Bergantung pada:** M2 (dapat dikerjakan sejajar dengan M3–M6)

## 1. Tujuan

Usaha mengelola karyawan, departemen, jabatan, jadwal mingguan, absensi web, dan cuti. Karyawan dapat ada tanpa akun login, lalu ditautkan ke akun bila perlu. Workspace HC-only berjalan tanpa istilah menu, meja, atau outlet.

## 2. Cakupan

**Termasuk:** karyawan dan penugasan; departemen dan jabatan; templat shift; jadwal draft → publikasi; absensi web dengan event append-only dan rekap harian; koreksi beralasan; jenis dan pengajuan cuti; layanan mandiri karyawan di web.

**Tidak termasuk:** absensi mobile dengan GPS/foto, payroll, lembur berbayar, biometrik (setelah R1, tergantung `OD-02`).

## 3. Kriteria selesai

- [ ] HC-only onboard dan dipakai tanpa satu pun istilah F&B (label "Perusahaan/Unit/Cabang").
- [ ] Karyawan tanpa akun dapat dijadwalkan dan dicatat absensinya.
- [ ] Event absensi tidak diubah; koreksi menambah event baru dengan alasan; rekap dihitung ulang.
- [ ] Jadwal yang dipublikasikan berversi; karyawan diberi tahu.
- [ ] Karyawan yang masuk hanya melihat jadwal, absensi, dan cutinya sendiri.
- [ ] Waktu disimpan UTC dan ditampilkan dengan zona waktu lokasi.

## 4. Task

### FT — Fitur produk

- [ ] **M7-FT-01 Karyawan** — nomor, nama, status kepegawaian, departemen, jabatan, lokasi; status tautan akun terpisah.
- [ ] **M7-FT-02 Undang karyawan ke akun** — opsional, memakai undangan M2.
- [ ] **M7-FT-03 Templat shift dan jadwal mingguan** — isi per karyawan, simpan draft, publikasikan.
- [ ] **M7-FT-04 Absensi web** — catat masuk/pulang/istirahat; rekap harian jadwal vs aktual (terlambat, pulang awal, lembur).
- [ ] **M7-FT-05 Koreksi absensi** — waktu yang benar dan alasan wajib.
- [ ] **M7-FT-06 Cuti** — jenis cuti, pengajuan, setujui/tolak dengan alasan.
- [ ] **M7-FT-07 Layanan mandiri** — jadwal saya, absensi saya, cuti saya.

### BE — Backend dan data

- [ ] **M7-BE-01 Tabel HC** — schema B.8.
- [ ] **M7-BE-02 Event absensi dan rekap** — idempotent per perangkat/kunci; perhitungan ulang rekap; event `attendance.approved.v1`.
- [ ] **M7-BE-03 Jadwal berversi** — event `schedule.published.v1`.
- [ ] **M7-BE-04 Alur cuti** — status draft → diajukan → disetujui/ditolak/dibatalkan.
- [ ] **M7-BE-05 Notifikasi** — jadwal dipublikasikan dan keputusan cuti (email atau in-app).

### UX — Alur dan interaksi

- [ ] **M7-UX-01 Halaman Karyawan** — tab Karyawan, Jadwal, Absensi, Cuti.
- [ ] **M7-UX-02 Editor jadwal mingguan** — grid di layar lebar, daftar per hari di HP.
- [ ] **M7-UX-03 Label per template** — HC-only memakai istilah perusahaan.

### DS — Design system dan komponen

- [ ] **M7-DS-01 Komponen HC** — grid jadwal, kartu absensi harian, timeline koreksi, form cuti (design-system 21.2, P2).

### AS — Aset

- [ ] **M7-AS-01 Ekspor rekap absensi** — CSV per periode dengan kolom terdokumentasi.

### SC — Keamanan dan privasi

- [ ] **M7-SC-01 Batas data karyawan** — karyawan tidak melihat data karyawan lain tanpa izin; test.
- [ ] **M7-SC-02 Audit koreksi dan keputusan cuti.**
- [ ] **M7-SC-03 Masa simpan bukti absensi** — mengikuti `OD-08`.

### QA — Kualitas kode dan test

- [ ] **M7-QA-01 Test perhitungan rekap** — lintas tengah malam, zona waktu, koreksi.
- [ ] **M7-QA-02 Test HC-only** — tanpa istilah F&B di UI dan respons.

### OP — Operasional dan dokumentasi

- [ ] **M7-OP-01 Seed perusahaan HC-only** — workspace contoh dengan karyawan dan jadwal.
- [ ] **M7-OP-02 Perbarui dokumen** — `schema.md` B.8, `flowchart.md` 11, keputusan `OD-02`.

## 5. Urutan checkpoint yang disarankan

1. Putuskan `OD-02`.
2. M7-BE-01, M7-FT-01, M7-UX-01, M7-UX-03, M7-QA-02, M7-OP-01.
3. M7-BE-03, M7-DS-01, M7-UX-02, M7-FT-03.
4. M7-BE-02, M7-FT-04, M7-FT-05, M7-QA-01, M7-SC-02.
5. M7-BE-04, M7-FT-06, M7-BE-05.
6. M7-FT-02, M7-FT-07, M7-SC-01, M7-SC-03, M7-AS-01, M7-OP-02.

## 6. Referensi

`prd.md` 4.2, 5, 6.3 · `flowchart.md` 11 · `schema.md` B.8 · `design-system-modules.md` 11.
