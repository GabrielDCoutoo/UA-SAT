import React, { useState } from 'react';

export default function Login({ onLogin, error, overlay = false, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(username, password);
    setLoading(false);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${overlay ? 'bg-black/70' : 'bg-gray-900'}`}>
      <form
        className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-sm"
        onSubmit={handleSubmit}
      >
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Login</h2>
        {overlay && <p className="text-gray-400 text-sm mb-4 text-center">É necessário iniciar sessão para esta ação.</p>}
        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Usuário</label>
          <input
            type="text"
            className="w-full px-3 py-2 rounded bg-gray-700 text-white focus:outline-none"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-300 mb-2">Senha</label>
          <input
            type="password"
            className="w-full px-3 py-2 rounded bg-gray-700 text-white focus:outline-none"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="text-red-400 mb-4 text-center">{error}</div>}
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition"
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full mt-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition"
          >
            Cancelar
          </button>
        )}
      </form>
    </div>
  );
}
