import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext({
    addToast: () => {},
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
    removeToast: () => {}
});

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((message, type = 'info', duration = 4500) => {
        const id = Date.now() + Math.random().toString(36).substring(2, 6);
        setToasts((prev) => [...prev, { id, message, type }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
        return id;
    }, [removeToast]);

    const success = useCallback((msg, duration) => addToast(msg, 'success', duration), [addToast]);
    const error = useCallback((msg, duration) => addToast(msg, 'error', duration), [addToast]);
    const info = useCallback((msg, duration) => addToast(msg, 'info', duration), [addToast]);
    const warning = useCallback((msg, duration) => addToast(msg, 'warning', duration), [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, success, error, info, warning, removeToast }}>
            {children}
        </ToastContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
export default ToastContext;
