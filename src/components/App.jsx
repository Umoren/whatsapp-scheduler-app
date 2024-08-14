import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CircularProgress } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { toast } from 'react-toastify';

const MessageForm = lazy(() => import('./MessageForm'));
const AuthSection = lazy(() => import('./AuthSection'));
const ScheduledJobs = lazy(() => import('./ScheduledJobs'));

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
    const [tabValue, setTabValue] = useState(0);
    const [scheduledJobs, setScheduledJobs] = useState([]);
    const [isServerConnected, setIsServerConnected] = useState(true);

    useEffect(() => {
        const checkServerAndFetchData = async () => {
            try {
                await checkAuthStatus();
                await fetchScheduledJobs();
                setIsServerConnected(true);
            } catch (error) {
                console.error('Server connection error:', error);
                setIsServerConnected(false);
                toast.error('Cannot connect to server. Please try again later.');
            }
        };

        checkServerAndFetchData();
        const interval = setInterval(checkServerAndFetchData, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, []);

    async function checkAuthStatus() {
        try {
            const response = await fetch(`${API_URL}/auth-status`, { timeout: 5000 });
            const data = await response.json();
            setIsAuthenticated(data.authenticated);
        } catch (error) {
            console.error('Error checking auth status:', error);
            throw error;
        }
    }

    async function getQRCode() {
        try {
            const response = await fetch(`${API_URL}/qr`);
            const data = await response.json();

            if (response.status === 200 && data.qrCode) {
                setQrCode(data.qrCode);
                toast.info('Scan the QR code with WhatsApp');
            } else if (response.status === 200 && data.authenticated) {
                toast.success('Already authenticated');
                setIsAuthenticated(true);
            } else if (response.status === 202) {
                toast.info('QR code is loading. Please try again in a few seconds.');
            } else {
                toast.error('Failed to get QR code. Try again later.');
            }
        } catch (error) {
            console.error('Error getting QR code:', error);
            toast.error('Error getting QR code');
        }
    }

    async function fetchScheduledJobs() {
        try {
            const response = await fetch(`${API_URL}/scheduled-jobs`, { timeout: 5000 });
            if (response.ok) {
                const jobs = await response.json();
                setScheduledJobs(jobs);
            } else {
                throw new Error('Failed to fetch scheduled jobs');
            }
        } catch (error) {
            console.error('Error fetching scheduled jobs:', error);
            throw error;
        }
    }

    async function handleCancelJob(id) {
        try {
            const response = await fetch(`${API_URL}/cancel-schedule/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`Failed to cancel job: ${response.status}`);
            }

            toast.success('Job cancelled successfully');
            fetchScheduledJobs();
        } catch (error) {
            console.error('Error cancelling job:', error);
            toast.error(`Error cancelling job: ${error.message}`);
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

            const result = await response.json();
            console.log('Server response:', result);

            if (!response.ok) {
                if (response.status === 429) {
                    toast.error(result.message);
                } else {
                    throw new Error(result.error || `HTTP error! status: ${response.status}`);
                }
                return;
            }

            toast.success(result?.message ?? 'Message sent succesfully');


            if (isScheduled) {
                fetchScheduledJobs();
            }
        } catch (error) {
            console.error(`Error ${isScheduled ? 'scheduling' : 'sending'} message:`, error);
            toast.error(`Error ${isScheduled ? 'scheduling' : 'sending'} message: ${error.message}`);

        }
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Container maxWidth="md">
                {!isServerConnected && (
                    <Box sx={{ my: 2, p: 2, bgcolor: 'error.main', color: 'error.contrastText' }}>
                        <Typography>Server is not connected. Some features may not work.</Typography>
                    </Box>
                )}
                <Box sx={{ my: 4 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Schedule a Message
                    </Typography>
                    <Suspense fallback={<CircularProgress />}>
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
                    </Suspense>
                </Box>
            </Container>
        </ThemeProvider>
    );
}

export default App;