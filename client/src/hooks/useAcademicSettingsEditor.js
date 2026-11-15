import { useState } from 'react';
import { createSetting, settingsError, updateSetting } from '../services/academicSettings.js';

export function useAcademicSettingsEditor(resource, refresh, toast) {
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const openCreate = (values) => { setError(''); setEditor({ id: null, values }); };
  const openEdit = (id, values) => { setError(''); setEditor({ id, values }); };
  const close = () => { if (!busy) setEditor(null); };
  const change = (event) => {
    const { name, value, type, checked } = event.target;
    setEditor((current) => ({ ...current, values: {
      ...current.values, [name]: type === 'checkbox' ? checked : value,
    } }));
  };
  const save = async (event, prepare = (values) => values) => {
    event.preventDefault();
    if (!editor || busy) return;
    setBusy(true);
    setError('');
    try {
      const payload = prepare(editor.values);
      if (editor.id === null) await createSetting(resource, payload);
      else await updateSetting(resource, editor.id, payload);
      toast.success('Konfigurasi berhasil disimpan.');
      setEditor(null);
      refresh();
    } catch (reason) { setError(settingsError(reason)); }
    finally { setBusy(false); }
  };
  return { editor, busy, error, openCreate, openEdit, close, change, save };
}
