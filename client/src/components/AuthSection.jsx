import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Paper, Container, CircularProgress, Fade } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { showToast } from './toast';
import api from '../utils/axiosConfig';

function AuthSection({ onAuthenticated }) {
    const [qrCode, setQrCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [countdown, setCountdown] = useState(60);

    const getQRCode = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/qr');
            const data = await response.data;

            if (data.authenticated) {
                showToast('success', 'WhatsApp authenticated successfully');
                onAuthenticated();
            } else if (data.qrCode) {
                setQrCode(data.qrCode);
                setCountdown(60); // Reset countdown
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
    }, [onAuthenticated]);

    useEffect(() => {
        getQRCode();
    }, [getQRCode]);

    useEffect(() => {
        let timer;
        if (qrCode && countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        } else if (countdown === 0) {
            getQRCode(); // Automatically refresh when countdown reaches 0
        }
        return () => clearInterval(timer);
    }, [qrCode, countdown, getQRCode]);

    return (
        <Container maxWidth="sm">
            <Paper elevation={3} sx={{ p: 4, mt: 4, textAlign: 'center' }}>
                <Typography variant="h4" gutterBottom color="primary">
                    Connect WhatsApp
                </Typography>
                <Typography variant="subtitle1" gutterBottom color="text.secondary">
                    Scan the QR code with your WhatsApp to use the scheduler
                </Typography>

                <Box sx={{ my: 4 }}>
                    {qrCode ? (
                        <Fade in={true}>
                            <Box sx={{ position: 'relative' }}>
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
                                <Typography variant="caption" sx={{ mt: 2, display: 'block' }}>
                                    QR Code expires in {countdown} seconds
                                </Typography>
                            </Box>
                        </Fade>
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
            </Paper>
        </Container>
    );
}

export default AuthSection;