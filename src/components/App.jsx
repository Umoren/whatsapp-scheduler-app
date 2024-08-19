import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ThemeProvider, createTheme, styled } from '@mui/material/styles';
import {
    CircularProgress, Alert, CssBaseline,
    Container,
    Typography,
    Box,
    Paper,
    Tabs,
    Tab,
    AppBar,
    Toolbar,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    useMediaQuery
} from '@mui/material';
import { checkNetworkSpeed } from '../utils/networkCheck';
import { ScheduledJobsProvider } from '../contexts/ScheduledJobsContext';
import MenuIcon from '@mui/icons-material/Menu';
import SendIcon from '@mui/icons-material/Send';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { showToast } from './toast';

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
        background: {
            default: '#f0f2f5',
        },
    },
});


const StyledContainer = styled(Container)(({ theme }) => ({
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(4),
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3),
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'none'
}));

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
    const [drawerOpen, setDrawerOpen] = useState(false);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

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
                showToast('error', 'Error', 'Cannot connect to server. Please try again later.');
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
                showToast('info', 'Scan this QR code with WhatsApp. It\'s like Snapchat, but for login!');
            } else if (response.status === 200 && data.authenticated) {
                showToast('success', 'You\'re in! Ready to slide into those DMs?');
                setIsAuthenticated(true);
                checkAuthStatus();
            } else if (response.status === 202) {
                showToast('info', data.message);
                setTimeout(getQRCode, 3000);
            } else {
                throw new Error(data.error || 'Failed to get QR code');
            }
        } catch (error) {
            console.error('Error getting QR code:', error);
            showToast('error', 'Oops! QR code ghosted us. Wanna try again?');
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

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
        if (isMobile) {
            setDrawerOpen(false);
        }
    };

    async function handleSubmit(messageData, isScheduled) {
        const endpoint = isScheduled ? `/schedule-message` : `/send-message`;

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                showToast('success', 'Message scheduled! It\'ll slide into their DMs right on time.');
                fetchScheduledJobs();
            } else {
                const successes = result.details.filter(d => d.status === 'fulfilled').length;
                const failures = result.details.filter(d => d.status === 'rejected').length;

                if (successes > 0 && failures === 0) {
                    showToast('success', `Message sent to ${successes} peeps! You're on fire!`);
                } else if (successes > 0 && failures > 0) {
                    showToast('warning', `Message reached ${successes} but missed ${failures}. Partial win?`);
                } else if (successes === 0 && failures > 0) {
                    showToast('error', `Oof! Message ghosted all ${failures} recipients. Let's try again?`);
                }

                result.details.forEach(detail => {
                    if (detail.status === 'rejected') {
                        showToast('error', `Failed to slide into ${detail.recipient}'s DMs: ${detail.error}`);
                    }
                });
            }
        } catch (error) {
            console.error(`Error ${isScheduled ? 'scheduling' : 'sending'} message:`, error);
            showToast('error', error.message);
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
                <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
                    <CircularProgress />
                    <Typography variant="h6" style={{ marginLeft: '20px' }}>
                        Initializing WhatsApp client...
                    </Typography>
                </Box>
            );
        }

        return (
            <ScheduledJobsProvider>
                <StyledPaper>
                    {tabValue === 0 && <MessageForm onSubmit={(data) => handleSubmit(data, false)} onError={(error) => showToast('error', 'Message failed to send. The internet gremlins are at it again!')} />}
                    {tabValue === 1 && <MessageForm onSubmit={(data) => handleSubmit(data, true)} isScheduled onError={(error) => showToast('error', 'Message failed to send. The internet gremlins are at it again!')} />}
                    {tabValue === 2 && <ScheduledJobs />}
                </StyledPaper>
            </ScheduledJobsProvider>
        );
    };

    const drawer = (
        <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <List>
                {['Send Message', 'Schedule Message', 'Scheduled Jobs'].map((text, index) => (
                    <ListItem button key={text} onClick={() => handleTabChange(null, index)}>
                        <ListItemIcon>
                            {index === 0 ? <SendIcon /> : index === 1 ? <ScheduleIcon /> : <ListAltIcon />}
                        </ListItemIcon>
                        <ListItemText primary={text} />
                    </ListItem>
                ))}
            </List>
        </Drawer>
    );

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AppBar position="static">
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        onClick={() => setDrawerOpen(true)}
                        sx={{ mr: 2, display: { sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        WhatsApp Scheduler
                    </Typography>
                </Toolbar>
            </AppBar>
            {drawer}
            <StyledContainer maxWidth="md">
                {!isServerConnected && (
                    <Box mb={2}>
                        <Typography color="error">Server is not connected. Some features may not work.</Typography>
                    </Box>
                )}
                {networkStatus === 'slow' && (
                    <Box mb={2}>
                        <Typography color="warning">Your internet connection seems slow. This may affect the app's performance.</Typography>
                    </Box>
                )}
                {networkStatus === 'offline' && (
                    <Box mb={2}>
                        <Typography color="error">You appear to be offline. Please check your internet connection.</Typography>
                    </Box>
                )}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', display: { xs: 'none', sm: 'block' } }}>
                    <Tabs value={tabValue} onChange={handleTabChange} aria-label="basic tabs example">
                        <Tab label="Send Message" icon={<SendIcon />} />
                        <Tab label="Schedule Message" icon={<ScheduleIcon />} />
                        <Tab label="Scheduled Jobs" icon={<ListAltIcon />} />
                    </Tabs>
                </Box>
                <Suspense fallback={<CircularProgress />}>
                    {renderContent()}
                </Suspense>
            </StyledContainer>
        </ThemeProvider>
    );
}

export default App;