import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { transformSync } from 'esbuild';

const filesToCheck = [
  'client/src/components/common/TableEmptyState.jsx',
  'client/src/components/common/ErrorBanner.jsx',
  'client/src/services/kaprodiFinalisasiKp.js',
  'client/src/hooks/useKaprodiFinalisasiKpList.js',
  'client/src/components/kaprodi/finalisasi-kp/FinalisasiKpStatusBadge.jsx',
  'client/src/components/kaprodi/finalisasi-kp/FinalisasiKpSummaryCards.jsx',
  'client/src/components/kaprodi/finalisasi-kp/FinalisasiKpToolbar.jsx',
  'client/src/components/kaprodi/finalisasi-kp/FinalisasiKpTable.jsx',
  'client/src/components/kaprodi/finalisasi-kp/KelayakanChecklist.jsx',
  'client/src/components/kaprodi/finalisasi-kp/AssignSupervisorForm.jsx',
  'client/src/components/kaprodi/finalisasi-kp/SupervisorManagementCard.jsx',
  'client/src/components/kaprodi/finalisasi-kp/FinalisasiWorkspaceModal.jsx',
  'client/src/components/kaprodi/finalisasi-kp/BulkAssignSupervisorModal.jsx',
  'client/src/components/kaprodi/finalisasi-kp/index.js',
  'client/src/pages/kaprodi/FinalisasiPembimbingKpPage.jsx',
  'client/src/pages/kaprodi/PenugasanReviewerKpPage.jsx',
  'client/src/components/kaprodi/penugasan-reviewer-kp/ReviewerKpTable.jsx',
  'client/src/pages/reviewer/ReviewKpPage.jsx',
  'client/src/components/reviewer/review-kp/ReviewTaskTable.jsx',
  'client/src/pages/admin-prodi/VerifikasiPengajuanKpPage.jsx',
  'client/src/components/admin-prodi/verifikasi-pengajuan-kp/KpAdminTable.jsx',
  'client/src/pages/admin-prodi/VerifikasiDataDiriPage.jsx',
  'client/src/pages/admin-prodi/MasterDosenPage.jsx',
  'client/src/components/admin-prodi/master-dosen/DosenTable.jsx',
  'client/src/pages/admin-prodi/MasterMahasiswaPage.jsx',
  'client/src/components/admin-prodi/master-mahasiswa/MahasiswaTable.jsx',
  'client/src/pages/admin-prodi/AcademicSettingsPage.jsx',
  'client/src/pages/admin-prodi/DashboardAdminProdiPage.jsx',
  'client/src/pages/mahasiswa/DashboardMahasiswaPage.jsx',
  'client/src/pages/mahasiswa/ProfilMahasiswaPage.jsx',
  'client/src/pages/mahasiswa/DokumenMahasiswaPage.jsx',
  'client/src/pages/mahasiswa/PengajuanKpPage.jsx',
  'client/src/components/mahasiswa/pengajuan-kp/KpApplicationTracker.jsx',
  'client/src/services/bimbinganMahasiswa.js',
  'client/src/hooks/useBimbinganMahasiswaList.js',
  'client/src/components/mahasiswa/bimbingan/BimbinganStatusBadge.jsx',
  'client/src/components/mahasiswa/bimbingan/BimbinganSupervisorCard.jsx',
  'client/src/components/mahasiswa/bimbingan/BimbinganProgressCard.jsx',
  'client/src/components/mahasiswa/bimbingan/BimbinganLockedState.jsx',
  'client/src/components/mahasiswa/bimbingan/BimbinganToolbar.jsx',
  'client/src/components/mahasiswa/bimbingan/BimbinganTable.jsx',
  'client/src/components/mahasiswa/bimbingan/BimbinganFormModal.jsx',
  'client/src/components/mahasiswa/bimbingan/BimbinganDetailModal.jsx',
  'client/src/components/mahasiswa/bimbingan/index.js',
  'client/src/pages/mahasiswa/BimbinganKpPage.jsx',
  'client/src/pages/PlaceholderPage.jsx',
  'client/src/config/navigation.js',
  'client/src/components/common/WhatsAppFloatingButton.jsx',
  'client/src/layouts/AppShell.jsx',
  'client/src/App.jsx',
];

for (const relPath of filesToCheck) {
  test(`Syntax dan JSX transform valid untuk ${relPath}`, () => {
    const fullPath = path.resolve(relPath);
    assert.ok(fs.existsSync(fullPath), `File ${relPath} harus ada di disk`);

    const source = fs.readFileSync(fullPath, 'utf8');
    const isJsx = relPath.endsWith('.jsx');

    const result = transformSync(source, {
      loader: isJsx ? 'jsx' : 'js',
      jsx: 'automatic',
    });

    assert.ok(result.code, `Transformasi esbuild harus menghasilkan kode valid untuk ${relPath}`);
  });
}

test('Icons.jsx mengekspor IconClock dan seluruh ikon yang dipakai di komponen finalisasi-kp', async () => {
  const iconsPath = path.resolve('client/src/components/common/Icons.jsx');
  const iconsSource = fs.readFileSync(iconsPath, 'utf8');

  // Cari semua named export function Icon*
  const exportedIcons = new Set();
  const exportRegex = /export\s+function\s+(Icon[A-Za-z0-9_]+)/g;
  let match;
  while ((match = exportRegex.exec(iconsSource)) !== null) {
    exportedIcons.add(match[1]);
  }

  assert.ok(exportedIcons.has('IconClock'), 'IconClock harus diekspor oleh Icons.jsx');

  // Periksa semua import dari Icons.jsx di komponen finalisasi-kp
  for (const relPath of filesToCheck) {
    if (!relPath.endsWith('.jsx')) continue;
    const fullPath = path.resolve(relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"][^'"]*Icons(?:\.jsx)?['"]/g;
    let impMatch;
    while ((impMatch = importRegex.exec(content)) !== null) {
      const importedNames = impMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const name of importedNames) {
        assert.ok(
          exportedIcons.has(name),
          `Komponen ${relPath} mengimpor '${name}' yang tidak diekspor oleh Icons.jsx`
        );
      }
    }
  }
});

test('Seluruh relative import pada filesToCheck harus mengarah ke file yang ada di disk', () => {
  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const dir = path.dirname(fullPath);

    const importRegex = /(?:import|export)\s+(?:(?:\{[^}]*\}|[\w$]+|\*\s+as\s+[\w$]+)\s+from\s+)?['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importTarget = match[1];
      const resolved = path.resolve(dir, importTarget);
      let exists = fs.existsSync(resolved);
      if (!exists) {
        for (const ext of ['.jsx', '.js', '/index.js', '/index.jsx']) {
          if (fs.existsSync(resolved + ext)) {
            exists = true;
            break;
          }
        }
      }
      assert.ok(
        exists,
        `File ${relPath} mengimpor relative path '${importTarget}' yang tidak ditemukan di disk`
      );
    }
  }
});

