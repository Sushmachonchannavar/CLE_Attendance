import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const LIVE_BACKEND_URL = 'https://cle-attendance-1.onrender.com/api';

export const getBaseURL = () => {
    const rawUrl = import.meta.env.VITE_API_URL;

    // Check if on native mobile (Capacitor)
    if (Capacitor.isNativePlatform()) {
        if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '' && !rawUrl.startsWith('/')) {
            const trimmed = rawUrl.trim().replace(/\/+$/, '');
            const finalUrl = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
            if (!finalUrl.includes('localhost') && !finalUrl.includes('127.0.0.1')) {
                return finalUrl;
            }
        }
        return LIVE_BACKEND_URL;
    }

    // In web browser (Desktop, Android Chrome, iPhone Safari):
    if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

        // 1. If running on local development machine, use VITE_API_URL if set to a remote URL,
        //    otherwise use Vite proxy via relative /api (points to local backend on port 5001).
        if (isLocalhost) {
            if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '' && !rawUrl.startsWith('/')) {
                const trimmed = rawUrl.trim().replace(/\/+$/, '');
                return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
            }
            return '/api';
        }

        // 2. If an explicit remote HTTPS API URL is configured via VITE_API_URL, use it directly.
        //    This takes priority for any non-localhost deployed environment.
        if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '' && !rawUrl.startsWith('/')) {
            const trimmed = rawUrl.trim().replace(/\/+$/, '');
            const finalUrl = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
            if (!finalUrl.includes('localhost') && !finalUrl.includes('127.0.0.1')) {
                return finalUrl;
            }
        }

        // 3. If accessed via local network LAN IP (e.g. mobile phone testing on Wi-Fi at 192.168.x.x)
        const isLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)\d+\.\d+$/.test(hostname);
        if (isLanIp) {
            if (rawUrl && typeof rawUrl === 'string' && rawUrl.startsWith('https://')) {
                const trimmed = rawUrl.trim().replace(/\/+$/, '');
                return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
            }
            // Point to backend on the same LAN host machine
            return `http://${hostname}:5001/api`;
        }

        // 4. If running on Vercel (production or any preview deployment, e.g. *.vercel.app):
        //    vercel.json rewrites /api/* → Render backend, so use relative /api path.
        //    This avoids cross-origin preflight by keeping requests on the same Vercel origin.
        if (hostname.endsWith('.vercel.app')) {
            return '/api';
        }

        // 5. On Cloudflare Pages (e.g. cle-attendance.pages.dev) or any other remote production host:
        //    Cloudflare Pages static redirects cannot proxy POST requests (405 Method Not Allowed).
        //    Connect directly to the live HTTPS backend instead.
        return LIVE_BACKEND_URL;
    }

    return LIVE_BACKEND_URL;
};

const resolvedBaseURL = getBaseURL();

// Log the resolved API base URL in the browser's DevTools console on page load.
// In production, open DevTools → Console and verify this matches the expected backend URL.
console.log(`[API] Base URL resolved to: ${resolvedBaseURL}`);

const api = axios.create({
    baseURL: resolvedBaseURL,
    timeout: 30000, // 30s timeout to handle Render free-tier cold-start without hanging
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Log actionable diagnostic information in browser console for production debugging.
        // Open DevTools → Console to see exact HTTP status, URL, and error body.
        if (error.response) {
            console.error(
                `[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} → HTTP ${error.response.status}:`,
                error.response.data
            );
        } else if (error.request) {
            console.error(
                '[API Error] No response received — possible network error or CORS block:',
                error.message,
                '| URL:', error.config?.url
            );
        } else {
            console.error('[API Error]', error.message);
        }
        return Promise.reject(error);
    }
);

export default api;
