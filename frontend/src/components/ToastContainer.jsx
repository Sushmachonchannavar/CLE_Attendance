import React from 'react';
import { useToast } from '../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContainer = () => {
    const { toasts, removeToast } = useToast();

    if (!toasts || toasts.length === 0) return null;

    const iconMap = {
        success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
        error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
        info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
    };

    const borderMap = {
        success: 'border-emerald-200 bg-white shadow-emerald-500/5',
        error: 'border-rose-200 bg-white shadow-rose-500/5',
        warning: 'border-amber-200 bg-white shadow-amber-500/5',
        info: 'border-blue-200 bg-white shadow-blue-500/5',
    };

    return (
        <div 
            aria-live="polite" 
            className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        >
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${borderMap[toast.type] || borderMap.info}`}
                >
                    {iconMap[toast.type] || iconMap.info}
                    <div className="flex-1 text-sm font-medium text-slate-800 leading-snug">
                        {toast.message}
                    </div>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg hover:bg-slate-100 transition-colors"
                        aria-label="Dismiss notification"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
