import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CircularProgress, Alert, Button } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { toast } from 'react-toastify';
import { checkNetworkSpeed } from '../utils/networkCheck';

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
    const [isClientReady, setIsClientReady] = useState(false);
    const [networkStatus, setNetworkStatus] = useState('good');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkServerAndFetchData = async () => {
            try {
                const networkSpeed = await checkNetworkSpeed();
                if (networkSpeed > 1000) {
                    setNetworkStatus('slow');
                } else if (networkSpeed === Infinity) {
                    setNetworkStatus('offline');
                } else {
                    setNetworkStatus('good');
                }

                await checkAuthStatus();
                if (isAuthenticated && isClientReady) {
                    await fetchScheduledJobs();
                }
                setIsServerConnected(true);
            } catch (error) {
                console.error('Server connection error:', error);
                setIsServerConnected(false);
                toast.error('Cannot connect to server. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        checkServerAndFetchData();
        const interval = setInterval(checkServerAndFetchData, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [isAuthenticated, isClientReady]);


    async function checkAuthStatus() {
        try {
            const response = await fetch(`${API_URL}/auth-status`, { timeout: 5000 });
            const data = await response.json();
            console.log('Auth status response:', data);
            setIsAuthenticated(data.authenticated);
            setIsClientReady(data.clientReady);
            if (data.authenticated && !data.clientReady) {
                console.log('Client authenticated but not ready. This should be temporary.');
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            setIsAuthenticated(false);
            setIsClientReady(false);
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
                checkAuthStatus();
            } else if (response.status === 202) {
                toast.info(data.message);
                // Retry after a short delay
                setTimeout(getQRCode, 3000);
            } else {
                throw new Error(data.error || 'Failed to get QR code');
            }
        } catch (error) {
            console.error('Error getting QR code:', error);
            toast.error('Error getting QR code: ' + error.message);
            // Retry after a longer delay
            setTimeout(getQRCode, 5000);
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

    /* disabled temporarily
    const handleLogout = async () => {
        try {
            const response = await fetch(`${API_URL}/logout`, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                setIsAuthenticated(false);
                setIsClientReady(false);
                setQrCode('');
                setScheduledJobs([]);
                toast.success('Logged out successfully');
                // Immediately try to get a new QR code after logout
                getQRCode();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error('Failed to logout. Please try again.');
        }
    };
    */

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
                if (result.error === 'Validation failed') {
                    const errorMessages = result.details.map(err => err.message).join('. ');
                    throw new Error(`Validation error: ${errorMessages}`);
                } else if (response.status === 429) {
                    throw new Error(result.message);
                } else {
                    throw new Error(result.error || `HTTP error! status: ${response.status}`);
                }
            }

            if (isScheduled) {
                toast.success('Message scheduled successfully');
                fetchScheduledJobs();
            } else {
                const successes = result.details.filter(d => d.status === 'fulfilled').length;
                const failures = result.details.filter(d => d.status === 'rejected').length;

                if (successes > 0 && failures === 0) {
                    toast.success(`Message sent successfully to all ${successes} recipient(s)`);
                } else if (successes > 0 && failures > 0) {
                    toast.warning(`Message sent to ${successes} recipient(s), failed for ${failures} recipient(s)`);
                } else if (successes === 0 && failures > 0) {
                    toast.error(`Failed to send message to all ${failures} recipient(s)`);
                }

                result.details.forEach(detail => {
                    if (detail.status === 'rejected') {
                        toast.error(`Failed to send to ${detail.recipient}: ${detail.error}`);
                    }
                });
            }
        } catch (error) {
            console.error(`Error ${isScheduled ? 'scheduling' : 'sending'} message:`, error);
            toast.error(error.message);
        }
    }

    const renderContent = () => {
        if (isLoading) {
            return (
                <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                    <CircularProgress />
                    <Typography variant="h6" style={{ marginLeft: '20px' }}>
                        Initializing...
                    </Typography>
                </Box>
            );
        }

        if (!isAuthenticated) {
            return <AuthSection qrCode={qrCode} getQRCode={getQRCode} />;
        }

        if (!isClientReady) {
            return (
                <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                    <CircularProgress />
                    <Typography variant="h6" style={{ marginLeft: '20px' }}>
                        Initializing WhatsApp client...
                    </Typography>
                </Box>
            );
        }

        return (
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
        );
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Container maxWidth="md">
                {!isServerConnected && (
                    <Alert severity="error" sx={{ my: 2 }}>
                        Server is not connected. Some features may not work.
                    </Alert>
                )}
                {networkStatus === 'slow' && (
                    <Alert severity="warning" sx={{ my: 2 }}>
                        Your internet connection seems slow. This may affect the app's performance.
                    </Alert>
                )}
                {networkStatus === 'offline' && (
                    <Alert severity="error" sx={{ my: 2 }}>
                        You appear to be offline. Please check your internet connection.
                    </Alert>
                )}
                <Box sx={{ my: 4 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Schedule a WhatsApp Message
                    </Typography>
                    <Suspense fallback={<CircularProgress />}>
                        {renderContent()}
                    </Suspense>
                </Box>
            </Container>
        </ThemeProvider>
    );
}

export default App;