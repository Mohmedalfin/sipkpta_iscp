import { useState } from 'react';
import ConfirmDialog from '../../common/ConfirmDialog.jsx';
import { settingsError, toggleSetting, updateSetting } from '../../../services/academicSettings.js';
import { IconCheckCircle, IconLockClosed } from '../../common/Icons.jsx';

export default function StatusAction({ resource, row, refresh, toast, label }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isActive = resource === 'periods' ? row.status_periode === 'AKTIF' : row.is_aktif;
  const next = !isActive;
  const actionLabel = isActive ? 'Nonaktifkan' : 'Aktifkan';

  const apply = async () => {
    setBusy(true);
    try {
      if (resource === 'periods' || resource === 'schedules') {
        await toggleSetting(resource, row.id, next);
      } else {
        await updateSetting(resource, row.id, { is_aktif: next });
      }
      toast.success(`${label} berhasil ${isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      setOpen(false);
      refresh();
    } catch (error) {
      toast.error(settingsError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
          isActive
            ? 'text-amber-700 hover:text-amber-800 hover:bg-amber-50 active:bg-amber-100'
            : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100'
        }`}
        title={`${actionLabel} ${label}`}
      >
        {isActive ? (
          <IconLockClosed className="size-3.5 shrink-0 opacity-80" />
        ) : (
          <IconCheckCircle className="size-3.5 shrink-0 opacity-80" />
        )}
        <span>{actionLabel}</span>
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={apply}
        loading={busy}
        variant={isActive ? 'warning' : 'primary'}
        title={`${actionLabel} ${label}?`}
        description={
          resource === 'curriculum'
            ? 'Kurikulum adalah master informasi dan tidak membatalkan atau mengubah Pengajuan yang sudah ada.'
            : `Perubahan status ${label.toLowerCase()} dapat memengaruhi opsi pengajuan baru. Seluruh riwayat pengajuan sebelumnya tetap tersimpan aman.`
        }
        confirmLabel={actionLabel}
      />
    </>
  );
}
