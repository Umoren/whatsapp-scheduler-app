import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Container, CircularProgress } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { showToast } from './toast';
import api from '../utils/axiosConfig';

function AuthSection({ onAuthenticated }) {
    const [qrCode, setQrCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const getQRCode = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/qr');
            const data = await response.data;

            if (data.authenticated) {
                showToast('success', 'WhatsApp authenticated successfully');
                onAuthenticated();
            } else if (data.qrCode) {
                setQrCode(data.qrCode);
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

    useEffect(() => {
        getQRCode();  // Automatically try to get QR code on component mount
    }, []);

    useEffect(() => {
        const checkAuthAndGetQR = async () => {
            try {
                const response = await api.get('/auth-status');
                if (response.data.isAuthenticated) {
                    showToast('success', 'WhatsApp already authenticated');
                    onAuthenticated();
                } else {
                    getQRCode();
                }
            } catch (error) {
                console.error('Error checking auth status:', error);
                getQRCode();
            }
        };

        checkAuthAndGetQR();
    }, []);

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
            </Paper>
        </Container>
    );
}

export default AuthSection;