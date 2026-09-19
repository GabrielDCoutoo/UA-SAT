import React, { useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
};

const bgColor = { success: 'bg-green-600', error: 'bg-red-600', warning: 'bg-yellow-600' };
const Icon    = { success: CheckCircle,     error: XCircle,      warning: AlertTriangle };

export const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        const ToastIcon = Icon[toast.type] ?? CheckCircle;
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm font-medium pointer-events-auto text-white
              ${bgColor[toast.type] ?? bgColor.success}`}
          >
            <ToastIcon size={18} className="flex-shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="ml-1 opacity-70 hover:opacity-100 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
