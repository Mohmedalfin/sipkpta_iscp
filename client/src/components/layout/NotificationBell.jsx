import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBell } from '../common/Icons.jsx';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const destinations = {
  '/mahasiswa/pengajuan/kp': 'MAHASISWA',
  '/admin-prodi/verifikasi-pengajuan-kp': 'ADMIN_PRODI',
  '/kaprodi/kp/penugasan-reviewer': 'KAPRODI',
  '/reviewer/review-kp': 'REVIEWER',
};

function NotificationItem({ item, onOpen, busy }) {
  return <button type="button" disabled={busy} onClick={() => onOpen(item)}
    className={`w-full rounded-lg p-2 text-left transition-colors disabled:opacity-60 ${
      item.status_dibaca ? 'hover:bg-subtle' : 'bg-blue-50/50 hover:bg-blue-50'
    }`}>
    <span className="block text-xs font-semibold text-ink">{item.judul}</span>
    <span className="mt-0.5 block text-[11px] leading-4 text-muted">{item.pesan}</span>
    <span className="mt-1 block text-[10px] text-secondary">
      {new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
      {!item.status_dibaca && ' ? Belum dibaca'}
    </span>
  </button>;
}

export default function NotificationBell({ session }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const reference = useRef(null);
  const navigate = useNavigate();
  const { chooseRole } = useAuth();
  const toast = useToast();
  const { count, list, readOne, readAll } = useNotifications(open, page);
  useClickOutside(reference, () => setOpen(false));
  const unread = count.data ?? 0;

  async function openItem(item) {
    const role = destinations[item.tautan_internal];
    if (!role || !session?.user?.roles?.includes(role)) {
      toast.error('Halaman notifikasi ini tidak tersedia untuk akun Anda.');
      return;
    }
    setBusy(true);
    try {
      if (role !== session.user.activeRole) await chooseRole(role);
      if (!item.status_dibaca) await readOne(item.id);
      setOpen(false);
      navigate(item.tautan_internal);
    } catch {
      toast.error('Notifikasi belum dapat dibuka. Coba lagi.');
    } finally { setBusy(false); }
  }

  async function readEveryItem() {
    setBusy(true);
    try { await readAll(); }
    catch { toast.error('Gagal menandai notifikasi. Coba lagi.'); }
    finally { setBusy(false); }
  }

  return <div ref={reference} className="relative">
    <button type="button" onClick={() => { setOpen((value) => !value); setPage(1); }}
      className="relative flex size-9 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
      aria-label="Lihat notifikasi akademik" aria-expanded={open} aria-controls="notification-panel">
      <IconBell className="size-5" />
      {unread > 0 && <span className="absolute right-0 top-0 flex min-w-4 h-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white shadow-2xs"
        aria-label={`${unread} notifikasi belum dibaca`}>{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div id="notification-panel" role="region" aria-label="Notifikasi akademik"
      className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[calc(100dvh-5.5rem)] overflow-hidden rounded-xl border border-line bg-white p-3 text-ink shadow-lg sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80 sm:max-h-[min(32rem,calc(100dvh-5.5rem))]">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
        <span className="text-xs font-bold">Notifikasi Akademik</span>
        {unread > 0 && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-brand">
          {unread} Baru</span>}
      </div>
      <div className="mt-2 max-h-[calc(100dvh-13rem)] space-y-1 overflow-y-auto text-xs sm:max-h-96">
        {list.isPending && <p role="status" className="p-3 text-center text-muted">Memuat notifikasi?</p>}
        {list.isError && <div className="p-3 text-center text-muted">
          <p>Notifikasi belum dapat dimuat.</p>
          <button type="button" onClick={() => list.refetch()} className="mt-1 font-medium text-brand">Coba lagi</button>
        </div>}
        {list.isSuccess && list.data.items.length === 0 && <p className="p-3 text-center text-muted">Belum ada notifikasi.</p>}
        {list.data?.items.map((item) => <NotificationItem key={item.id} item={item} onOpen={openItem} busy={busy} />)}
      </div>
      {list.data?.pagination.total_pages > 1 && <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[11px]">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}
          className="font-medium text-brand disabled:opacity-40">Sebelumnya</button>
        <span>{page} / {list.data.pagination.total_pages}</span>
        <button type="button" disabled={page >= list.data.pagination.total_pages}
          onClick={() => setPage((value) => value + 1)} className="font-medium text-brand disabled:opacity-40">Berikutnya</button>
      </div>}
      {unread > 0 && <div className="mt-2 border-t border-line pt-2 text-center">
        <button type="button" disabled={busy} onClick={readEveryItem}
          className="text-[11px] font-medium text-brand hover:underline disabled:opacity-50">Tandai semua telah dibaca</button>
      </div>}
    </div>}
  </div>;
}
