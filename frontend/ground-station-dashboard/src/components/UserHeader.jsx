import React from 'react';
import { LogOut } from 'lucide-react';

export default function UserHeader({ user, onLogout }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
      <div className="flex items-center gap-3">
        <span className="text-white font-semibold">Bem-vindo, {user?.username || 'Usuário'}!</span>
        {user?.role && (
          <span className="text-xs bg-blue-700 text-white px-2 py-1 rounded ml-2">{user.role}</span>
        )}
      </div>
      <button
        onClick={onLogout}
        className="flex items-center gap-2 text-gray-300 hover:text-red-400 transition"
        title="Sair"
      >
        <LogOut size={20} />
        <span>Sair</span>
      </button>
    </header>
  );
}
