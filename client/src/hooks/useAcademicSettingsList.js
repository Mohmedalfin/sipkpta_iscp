import { useCallback, useEffect, useState } from 'react';
import { listSettings, settingsError } from '../services/academicSettings.js';

export function useAcademicSettingsList(resource, params = {}) {
  const [result, setResult] = useState({ data: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const query = JSON.stringify(params);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    listSettings(resource, JSON.parse(query), { signal: controller.signal })
      .then((value) => {
        if (!active) return;
        setResult(Array.isArray(value) ? { data: value, pagination: null } : value);
      })
      .catch((reason) => { if (active) setError(settingsError(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [resource, query, revision]);

  return { ...result, loading, error, refresh };
}
