import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsv } from '../src/services/master-import.service.js';

const header = 'nim,nama,tanggal_lahir,email,angkatan';
const commaRow = '00000001,"Nama, Pertama",2002-01-01,satu@example.test,2020';

test('CSV koma lama dan CSV Excel bertitik koma dipetakan ke kolom yang sama', () => {
  const comma = parseCsv(Buffer.from(`${header}\r\n${commaRow}\r\n`), 'mahasiswa');
  const semicolon = parseCsv(Buffer.from(
    'nim;nama;tanggal_lahir;email;angkatan\r\n00000001;"Nama; Pertama";2002-01-01;satu@example.test;2020\r\n',
  ), 'mahasiswa');
  assert.deepEqual(comma.headers, header.split(','));
  assert.equal(comma.rows[0].values.nim, '00000001');
  assert.equal(comma.rows[0].values.nama, 'Nama, Pertama');
  assert.equal(semicolon.rows[0].values.nim, '00000001');
  assert.equal(semicolon.rows[0].values.nama, 'Nama; Pertama');
  assert.equal(semicolon.rows[0].row, 2);
});

test('petunjuk separator Excel dan BOM UTF-8 tidak dihitung sebagai header', () => {
  const comma = parseCsv(Buffer.from(`\uFEFFsep=,\r\n${header}\r\n${commaRow}\r\n`), 'mahasiswa');
  assert.equal(comma.rows[0].row, 3);
  const semicolon = parseCsv(Buffer.from(
    'sep=;\r\nkode_dosen;nidn;nama;tanggal_lahir;email\r\nD001;00123;"Dosen; Satu";1980-01-01;dosen@example.test\r\n',
  ), 'dosen');
  assert.equal(semicolon.rows[0].values.nama, 'Dosen; Satu');
  assert.equal(semicolon.rows[0].values.nidn, '00123');
  assert.equal(semicolon.rows[0].row, 3);
});

test('separator tidak melonggarkan pemeriksaan header dan struktur CSV', () => {
  assert.throws(() => parseCsv(Buffer.from('nim;nama\r\n00000001;Satu'), 'mahasiswa'),
    { code: 'INVALID_CSV_HEADER' });
  assert.throws(() => parseCsv(Buffer.from(
    'nim;nama;tanggal_lahir;email;angkatan\r\n00000001;"Nama belum ditutup;2002-01-01;satu@example.test;2020',
  ), 'mahasiswa'), { code: 'INVALID_CSV' });
  assert.throws(() => parseCsv(Buffer.from(
    'sep=;\r\nnim;nama;tanggal_lahir;email;angkatan\r\n00000001;Satu;2002-01-01',
  ), 'mahasiswa'), { code: 'INVALID_CSV' });
});
