export const checkNetworkSpeed = async () => {
    const startTime = new Date().getTime();
    try {
        await fetch('https://www.google.com', { mode: 'no-cors' });
        const endTime = new Date().getTime();
        return endTime - startTime;
    } catch (error) {
        console.error('Network check failed:', error);
        return Infinity;
    }
};