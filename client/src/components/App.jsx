import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ThemeProvider, createTheme, styled } from '@mui/material/styles';
import {
    CircularProgress, CssBaseline, Alert,
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
    useMediaQuery,
    AlertTitle,
    Button,
} from '@mui/material';
import { checkNetworkSpeed } from '../utils/networkCheck';
import { ScheduledJobsProvider, useScheduledJobs } from '../contexts/ScheduledJobsContext';
import MenuIcon from '@mui/icons-material/Menu';
import SendIcon from '@mui/icons-material/Send';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ListAltIcon from '@mui/icons-material/ListAlt';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import api from '../utils/axiosConfig';
import { showToast } from './toast';
import { supabaseClient } from '../utils/supabaseClientConfig';
import Login from './Login';

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
    components: {
        MuiPaper: {
            defaultProps: {
                elevation: 0,
            },
        },
    },
});


const StyledContainer = styled(Container)(({ theme }) => ({
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(4),
    maxWidth: '100%!important', // Override MUI's default maxWidth
    padding: theme.spacing(0, 4), // Add some horizontal padding
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3),
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'none'
}));

function AppContent() {
    const [tabValue, setTabValue] = useState(0);
    const { fetchJobs } = useScheduledJobs();
    const [isServerConnected, setIsServerConnected] = useState(true);
    const [isClientReady, setIsClientReady] = useState(false);
    const [networkStatus, setNetworkStatus] = useState('good');
    const [isLoading, setIsLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
    const [session, setSession] = useState(null);
    const [isWhatsAppAuthenticated, setIsWhatsAppAuthenticated] = useState(false);
    const [lastHeartbeat, setLastHeartbeat] = useState(null);
    const [lastAuthCheck, setLastAuthCheck] = useState(Date.now());

    const AUTH_CHECK_INTERVAL = 5 * 60 * 1000;

    useEffect(() => {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                checkWhatsAppAuthStatus();
            }
            setIsLoading(false);
        });

        const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                checkWhatsAppAuthStatus();
            } else {
                setIsWhatsAppAuthenticated(false);
                setIsClientReady(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const handleAuth = async () => {
            const hash = window.location.hash;
            console.log("Full URL:", window.location.href);
            console.log("Hash:", hash);

            if (hash) {
                const params = new URLSearchParams(hash.substring(1));
                const access_token = params.get('access_token');
                console.log("Parsed access token:", access_token);

                if (access_token) {
                    try {
                        const { data: { user }, error } = await supabaseClient.auth.getUser(access_token);
                        console.log("Supabase getUser response:", { user, error });
                        if (error) throw error;
                        setSession({ user, access_token });
                        checkWhatsAppAuthStatus();
                    } catch (error) {
                        console.error("Error in authentication flow:", error);
                        showToast('error', 'Authentication failed. Please try logging in again.');
                    }
                }
            } else {
                // Check for existing session
                const { data: { session }, error } = await supabaseClient.auth.getSession();
                if (session) {
                    setSession(session);
                    checkWhatsAppAuthStatus();
                } else {
                    setIsLoading(false);
                }
            }
        };

        handleAuth();
    }, []);


    useEffect(() => {
        const checkServerAndFetchData = async () => {
            try {
                const networkSpeed = await checkNetworkSpeed();
                setNetworkStatus(networkSpeed > 1000 ? 'slow' : networkSpeed === Infinity ? 'offline' : 'good');

                if (isWhatsAppAuthenticated && isClientReady) {
                    await fetchJobs();
                }
                setIsServerConnected(true);
            } catch (error) {
                console.error('Server connection error:', error);
                setIsServerConnected(false);
                showToast('error', 'Cannot connect to server. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        checkServerAndFetchData();
        const interval = setInterval(checkServerAndFetchData, 10000);

        return () => clearInterval(interval);
    }, [isWhatsAppAuthenticated, isClientReady, fetchJobs]);

    // log state changes
    useEffect(() => {
        console.log('State changed:', {
            isLoading,
            isWhatsAppAuthenticated,
            isClientReady,
            session: !!session
        });
    }, [isLoading, isWhatsAppAuthenticated, isClientReady, session]);

    const checkWhatsAppAuthStatus = useCallback(async () => {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                setIsWhatsAppAuthenticated(false);
                setIsClientReady(false);
                return;
            }

            const response = await api.get('/auth-status');
            const data = response.data;

            setIsWhatsAppAuthenticated(data.isAuthenticated);
            setIsClientReady(data.isAuthenticated);
            setLastHeartbeat(data.lastHeartbeat ? new Date(data.lastHeartbeat) : null);
            setLastAuthCheck(Date.now());

            if (!data.isAuthenticated && isWhatsAppAuthenticated) {
                showToast('warning', 'WhatsApp connection lost. Please re-authenticate.');
            }

        } catch (error) {
            console.error('Error checking WhatsApp auth status:', error);
            setIsWhatsAppAuthenticated(false);
            setIsClientReady(false);
            showToast('error', 'Failed to check WhatsApp authentication status');
        } finally {
            setIsLoading(false);
        }
    }, [isWhatsAppAuthenticated]);


    const handleLogout = async () => {
        try {
            await supabaseClient.auth.signOut();
            setSession(null);
            setIsWhatsAppAuthenticated(false);
            showToast('success', 'Logged out successfully');
        } catch (error) {
            console.error('Logout error:', error);
            showToast('error', 'Failed to log out. Please try again.');
        }
    };

    const handleUserAction = useCallback(() => {
        const now = Date.now();
        if (now - lastAuthCheck > AUTH_CHECK_INTERVAL) {
            checkWhatsAppAuthStatus();
        }
    }, [lastAuthCheck, checkWhatsAppAuthStatus]);

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
        handleUserAction();
        if (isMobile) {
            setDrawerOpen(false);
        }
    };

    async function handleSubmit(messageData, isScheduled) {
        const endpoint = isScheduled ? `/schedule-message` : `/send-message`;

        try {
            // Send messageData directly, without stringifying
            const response = await api.post(endpoint, messageData);
            const result = response.data;
            console.log('Server response:', result);

            if (isScheduled) {
                showToast('success', 'Message scheduled! It\'ll slide into their DMs right on time.');
                fetchJobs();
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

            if (error.response) {
                if (error.response.status === 429) {
                    showToast('error', 'Rate limit exceeded. Please try again later.');
                } else if (error.response.data && error.response.data.error === 'Validation failed') {
                    const errorMessages = error.response.data.details.join('. ');
                    showToast('error', `Validation error: ${errorMessages}`);
                } else {
                    showToast('error', error.response.data.message || 'An error occurred while processing your request.');
                }
            } else if (error.request) {
                showToast('error', 'No response received from the server. Please check your connection.');
            } else {
                showToast('error', 'An error occurred while sending the request.');
            }
        }
    }

    // render content
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

        if (!session) {
            return <Login />;
        }

        if (!isWhatsAppAuthenticated) {
            return <AuthSection onAuthenticated={() => {
                setIsWhatsAppAuthenticated(true);
                setIsClientReady(true);
            }} />;
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
    // end of rendering main content. TODO: Move to components

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
                    {session && <Button color="inherit" onClick={handleLogout}>Logout</Button>}
                </Toolbar>
            </AppBar>
            {drawer}
            <StyledContainer maxWidth="md">
                {!isServerConnected && (
                    <Alert severity="error" icon={<CloudOffIcon />} sx={{ mb: 2 }}>
                        <AlertTitle>Server Disconnected</AlertTitle>
                        The server is not connected. Some features may not work properly.
                    </Alert>
                )}
                {networkStatus === 'slow' && (
                    <Alert severity="warning" icon={<WifiIcon sx={{ color: 'orange' }} />} sx={{ mb: 2 }}>
                        <AlertTitle>Slow Connection</AlertTitle>
                        Your internet connection seems slow. This may affect the app's performance.
                    </Alert>
                )}
                {networkStatus === 'offline' && (
                    <Alert severity="error" icon={<WifiOffIcon />} sx={{ mb: 2 }}>
                        <AlertTitle>Offline</AlertTitle>
                        You appear to be offline. Please check your internet connection.
                    </Alert>
                )}
                {isWhatsAppAuthenticated && (
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', display: { xs: 'none', sm: 'block' } }}>
                        <Tabs value={tabValue} onChange={handleTabChange} aria-label="basic tabs example">
                            <Tab label="Send Message" icon={<SendIcon />} />
                            <Tab label="Schedule Message" icon={<ScheduleIcon />} />
                            <Tab label="Scheduled Jobs" icon={<ListAltIcon />} />
                        </Tabs>
                    </Box>
                )}
                <Suspense fallback={<CircularProgress />}>
                    {renderContent()}
                </Suspense>
            </StyledContainer>
        </ThemeProvider>
    );
}

function App() {
    return (
        <ScheduledJobsProvider>
            <AppContent />
        </ScheduledJobsProvider>
    );
}


export default App;