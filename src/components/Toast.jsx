import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

/**
 * Floating toast notifications
 */
export default function Toast({ toasts, onDismiss }) {
    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onDismiss }) {
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setExiting(true);
            setTimeout(() => onDismiss(toast.id), 300);
        }, toast.duration || 3000);

        return () => clearTimeout(timer);
    }, [toast, onDismiss]);

    const Icon = toast.type === 'success' ? CheckCircle : AlertCircle;

    return (
        <div className={`toast toast-${toast.type || 'success'} ${exiting ? 'exiting' : ''}`}>
            <Icon size={16} />
            <span>{toast.message}</span>
        </div>
    );
}

// Toast helper
let toastCounter = 0;
export function createToast(message, type = 'success', duration = 3000) {
    return {
        id: ++toastCounter,
        message,
        type,
        duration,
    };
}
