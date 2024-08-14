import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import App from './components/App';
import ErrorBoundary from './components/ErrorBoundary';


const errorHandler = (error, errorInfo) => {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    toast.error('Something went wrong. Please try again.');
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
        />
        <ErrorBoundary onError={errorHandler}>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);