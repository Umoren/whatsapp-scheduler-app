import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MessageForm from './MessageForm';
import AuthSection from './AuthSection';
import ScheduledJobs from './ScheduledJobs';

const theme = createTheme({
    palette: {
        primary: {
            main: '#075e54',
        },
        secondary: {
            main: '#128c7e',
        },
    },
});

const API_URL = '';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [qrCode, setQrCode] = useState('');
    const [status, setStatus] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const [scheduledJobs, setScheduledJobs] = useState([]);

    useEffect(() => {
        checkAuthStatus();
        fetchScheduledJobs();
        const interval = setInterval(() => {
            checkAuthStatus();
            fetchScheduledJobs();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    async function checkAuthStatus() {
        try {
            const response = await fetch(`${API_URL}/auth-status`);
            const data = await response.json();
            setIsAuthenticated(data.authenticated);
        } catch (error) {
            console.error('Error checking auth status:', error);
            setStatus('Error checking authentication status');
        }
    }

    async function getQRCode() {
        try {
            const response = await fetch(`${API_URL}/qr`);
            if (response.ok) {
                const blob = await response.blob();
                setQrCode(URL.createObjectURL(blob));
                setStatus('Scan this QR code with WhatsApp');
            } else {
                setStatus('Failed to get QR code. Try again later.');
            }
        } catch (error) {
            console.error('Error getting QR code:', error);
            setStatus('Error getting QR code');
        }
    }

    async function fetchScheduledJobs() {
        try {
            const response = await fetch(`${API_URL}/scheduled-jobs`);
            if (response.ok) {
                const jobs = await response.json();
                setScheduledJobs(jobs);
            }
        } catch (error) {
            console.error('Error fetching scheduled jobs:', error);
        }
    }

    async function handleCancelJob(id) {
        try {
            const response = await fetch(`${API_URL}/cancel-schedule/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setStatus('Job cancelled successfully');
                fetchScheduledJobs();
            } else {
                throw new Error('Failed to cancel job');
            }
        } catch (error) {
            console.error('Error cancelling job:', error);
            setStatus('Error cancelling job. Please try again.');
        }
    }

    async function handleSubmit(messageData, isScheduled) {
        const endpoint = isScheduled ? `/schedule-message` : `/send-message`;

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messageData),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.text();
            setStatus(result);
            if (isScheduled) {
                fetchScheduledJobs();
            }
        } catch (error) {
            console.error(`Error ${isScheduled ? 'scheduling' : 'sending'} message:`, error);
            setStatus(`Error ${isScheduled ? 'scheduling' : 'sending'} message. Please try again.`);
        }
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Container maxWidth="md">
                <Box sx={{ my: 4 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        WhatsApp Bot UI
                    </Typography>
                    {status && (
                        <Typography color="error" sx={{ mb: 2 }}>
                            {status}
                        </Typography>
                    )}
                    {!isAuthenticated ? (
                        <AuthSection qrCode={qrCode} getQRCode={getQRCode} />
                    ) : (
                        <>
                            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
                                <Tab label="Send Immediate Message" />
                                <Tab label="Schedule Message" />
                                <Tab label="Scheduled Jobs" />
                            </Tabs>
                            {tabValue === 0 && <MessageForm onSubmit={(data) => handleSubmit(data, false)} />}
                            {tabValue === 1 && <MessageForm onSubmit={(data) => handleSubmit(data, true)} isScheduled />}
                            {tabValue === 2 && <ScheduledJobs jobs={scheduledJobs} onCancelJob={handleCancelJob} />}
                        </>
                    )}
                </Box>
            </Container>
        </ThemeProvider>
    );
}

export default App;