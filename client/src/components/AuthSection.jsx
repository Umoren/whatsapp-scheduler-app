import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, Paper, Container, CircularProgress, LinearProgress } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { showToast } from './toast';
import api from '../utils/axiosConfig';

function AuthSection({ qrCode, onAuthenticated }) {
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const timerRef = useRef(null);

    const getQRCode = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/qr');
            const data = await response.data;

            if (data.authenticated) {
                setIsInitializing(true);
                initializeClient();
            } else if (data.qrCode) {
                showToast('info', 'Scan this QR code with WhatsApp to authenticate');
            } else {
                throw new Error(data.error || 'Failed to get QR code');
            }
        } catch (error) {
            console.error('Error getting QR code:', error);
            showToast('error', `Failed to get QR code: ${error.message}. Please try again.`);
        } finally {
            setIsLoading(false);
        }
    };

    const initializeClient = async () => {
        setTimeElapsed(0);
        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setTimeElapsed(prev => {
                if (prev >= 60) {
                    clearInterval(timerRef.current);
                    showToast('error', 'Client initialization timed out. Please try again.');
                    setIsInitializing(false);
                    return 0;
                }
                return prev + 1;
            });
        }, 1000);

        try {
            const response = await api.post('/initialize-client');
            if (response.data.isClientReady) {
                clearInterval(timerRef.current);
                showToast('success', 'WhatsApp client is ready');
                onAuthenticated();
            } else {
                throw new Error('Client not ready after initialization');
            }
        } catch (error) {
            console.error('Error initializing client:', error);
            showToast('error', 'Failed to initialize WhatsApp client. Please try again.');
            setIsInitializing(false);
        }
    };

    useEffect(() => {
        if (!qrCode) {
            getQRCode();
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [qrCode]);

    return (
        <Container maxWidth="sm">
            <Paper elevation={3} sx={{ p: 4, mt: 4, textAlign: 'center' }}>
                <Typography variant="h4" gutterBottom color="primary">
                    Connect WhatsApp
                </Typography>
                {isInitializing ? (
                    <Box sx={{ my: 4 }}>
                        <CircularProgress />
                        <Typography variant="subtitle1" sx={{ mt: 2 }}>
                            Initializing WhatsApp client...
                        </Typography>
                        <LinearProgress variant="determinate" value={(timeElapsed / 60) * 100} sx={{ mt: 2 }} />
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            Time elapsed: {timeElapsed} seconds (Max 60 seconds)
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <Typography variant="subtitle1" gutterBottom color="text.secondary">
                            Scan the QR code with your WhatsApp to use the scheduler
                        </Typography>
                        <Box sx={{ my: 4 }}>
                            {qrCode ? (
                                <Box
                                    component="img"
                                    src={qrCode}
                                    alt="QR Code"
                                    sx={{
                                        maxWidth: '100%',
                                        height: 'auto',
                                        borderRadius: 2,
                                        boxShadow: 3,
                                    }}
                                />
                            ) : (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="large"
                                    startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <QrCode2Icon />}
                                    onClick={getQRCode}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Generating...' : 'Refresh QR Code'}
                                </Button>
                            )}
                        </Box>
                        <Typography variant="body2" sx={{ mt: 3 }}>
                            1. Open WhatsApp on your phone<br />
                            2. Tap Menu or Settings and select WhatsApp Web<br />
                            3. Point your phone at this screen to capture the QR code
                        </Typography>
                    </>
                )}
            </Paper>
        </Container>
    );
}

export default AuthSection;