import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToastStore } from './useToastStore';

// eslint-disable-next-line react-refresh/only-export-components
export { useToastStore } from './useToastStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-surface-elevated/95 border border-border text-sm text-text-primary shadow-xl backdrop-blur-md animate-fade-up"
          onClick={() => removeToast(toast.id)}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-accent-emerald" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-accent-cyan" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
};
