import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './src/components/App';
import ErrorBoundary from './src/components/ErrorBoundary';
import { errorHandler } from './src/components/toast';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary onError={errorHandler}>
            <App />
            <Toaster position="top-right" />
        </ErrorBoundary>
    </React.StrictMode>
);