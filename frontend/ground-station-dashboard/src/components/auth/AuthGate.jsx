import React, { useEffect, useState } from 'react';
import Login from '../Login';
import { login, setLoginPrompt } from '../../auth';

// Montado uma vez no App. Fica invisível até um authFetch precisar de login.
export default function AuthGate() {
  const [request, setRequest] = useState(null); // { resolve, reject }
  const [error, setError] = useState('');

  useEffect(() => {
    return setLoginPrompt((req) => {
      setError('');
      setRequest(req);
    });
  }, []);

  if (!request) return null;

  const handleLogin = async (username, password) => {
    const result = await login(username, password);
    if (result.success) {
      request.resolve();
      setRequest(null);
    } else {
      setError(result.error);
    }
  };

  const handleCancel = () => {
    request.reject(new Error('login cancelado'));
    setRequest(null);
  };

  return (
    <div className="fixed inset-0 z-[3000]">
      <Login overlay onLogin={handleLogin} onCancel={handleCancel} error={error} />
    </div>
  );
}
