export const trackEvent = (eventName, eventParams = {}) => {
    if (window.gtag) {
        window.gtag('event', eventName, eventParams);
    } else {
        console.log('Development: Track event', eventName, eventParams);
    }
};

export const trackPageView = (path) => {
    if (window.gtag) {
        window.gtag('config', 'G-92MT0SDGTJ', {
            page_path: path
        });
    } else {
        console.log('Development: Track page view', path);
    }
};