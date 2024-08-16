import React, { useState } from 'react';
import { Box, Typography, Button, Paper, Container, CircularProgress } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';

function AuthSection({ qrCode, getQRCode }) {
    const [isLoading, setIsLoading] = useState(false);

    const handleGetQRCode = async () => {
        setIsLoading(true);
        try {
            await getQRCode();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container maxWidth="sm">
            <Paper elevation={3} sx={{ p: 4, mt: 4, textAlign: 'center' }}>
                <Typography variant="h4" gutterBottom color="primary">
                    Login
                </Typography>
                <Typography variant="subtitle1" gutterBottom color="text.secondary">
                    Scan the QR code with your WhatsApp to authenticate
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
                            onError={(e) => {
                                console.error('QR code image failed to load', e);
                                console.log('QR code data:', qrCode.substring(0, 100) + '...');
                            }}
                        />
                    ) : (
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <QrCode2Icon />}
                            onClick={handleGetQRCode}
                            disabled={isLoading}
                            sx={{ py: 1.5, px: 4 }}
                        >
                            {isLoading ? 'Generating...' : 'Generate QR Code'}
                        </Button>
                    )}
                </Box>

                {!qrCode && !isLoading && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Click the button above to generate a new QR code
                    </Typography>
                )}
            </Paper>
        </Container>
    );
}

export default AuthSection;