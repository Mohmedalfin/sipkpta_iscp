import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getKpApplicationDetail } from '../services/pengajuanKp.js';

export default function useLiveKpDetail(application, onUpdate) {
  const enabled = Boolean(application && application.status_pengajuan !== 'DRAFT' &&
    application.status_pemeriksaan_berkas !== 'BELUM_OK' && application.status_pemeriksaan_akademik !== 'BELUM_OK');
  const query = useQuery({ queryKey: ['kp-detail', application?.id], enabled,
    queryFn: ({ signal }) => getKpApplicationDetail(application.id, { signal }),
    initialData: application ?? undefined, refetchInterval: 120000, refetchIntervalInBackground: false });
  useEffect(() => {
    if (enabled && query.data && query.data.id === application.id) onUpdate(query.data);
  }, [enabled, query.data, application?.id, onUpdate]);
}
