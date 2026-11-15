import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { authErrorMessage } from '../../services/auth.js';

export default function SignOutButton({ className = '' }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (requestError) {
      setError(authErrorMessage(requestError, 'Gagal keluar. Coba lagi.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <button type="button" onClick={handleSignOut} disabled={pending} className="shell-signout">
        {pending ? 'Sedang keluar…' : 'Keluar'}
      </button>
      {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
