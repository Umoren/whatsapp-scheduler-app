import { toast } from 'react-hot-toast';
import CustomToast from './CustomToast';

const getTitle = (type) => {
    switch (type) {
        case 'success':
            return 'Success';
        case 'error':
            return 'Error';
        case 'info':
            return 'Information';
        case 'warning':
            return 'Warning';
        default:
            return 'Notification';
    }
};

export const showToast = (type, message) => {
    return toast.custom(
        (t) => (
            <CustomToast
                t={t}
                type={type}
                title={getTitle(type)}
                message={message}
                onClose={toast.remove}
            />
        ),
        {
            duration: 4000,
        }
    );
};

export const errorHandler = (error, errorInfo) => {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    showToast('error', error.message || 'An unexpected error occurred. Please try again.');
};