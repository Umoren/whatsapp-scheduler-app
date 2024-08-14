import React from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

function AuthSection({ qrCode, getQRCode }) {
    return (
        <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
                Authentication
            </Typography>
            {qrCode ? (
                <img src={qrCode} alt="QR Code" style={{ maxWidth: '100%', height: 'auto' }} />
            ) : (
                <Button variant="contained" color="primary" onClick={getQRCode}>
                    Get QR Code
                </Button>
            )}
        </Box>
    );
}


export default AuthSection;