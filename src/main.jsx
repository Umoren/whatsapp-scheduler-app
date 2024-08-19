import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './components/App';
import ErrorBoundary from './components/ErrorBoundary';
import { errorHandler } from './components/toast';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary onError={errorHandler}>
            <App />
            <Toaster position="top-right" />
        </ErrorBoundary>
    </React.StrictMode>
);