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

        // 1. If running on local development machine, relative /api uses Vite proxy to local backend (port 5001)
        if (isLocalhost) {
            if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '' && !rawUrl.startsWith('/')) {
                const trimmed = rawUrl.trim().replace(/\/+$/, '');
                return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
            }
            return '/api';
        }

        // 2. If an explicit remote HTTPS API URL is provided in env (e.g. VITE_API_URL)
        if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '' && !rawUrl.startsWith('/')) {
            const trimmed = rawUrl.trim().replace(/\/+$/, '');
            const finalUrl = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
            if (!finalUrl.includes('localhost') && !finalUrl.includes('127.0.0.1')) {
                return finalUrl;
            }
        }

        // 3. If accessed via local network LAN IP (e.g. mobile phone testing on Wi-Fi at 192.168.x.x)
        const isLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
        if (isLanIp) {
            if (rawUrl && typeof rawUrl === 'string' && rawUrl.startsWith('https://')) {
                const trimmed = rawUrl.trim().replace(/\/+$/, '');
                return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
            }
            // Point to backend on the same LAN host machine
            return `http://${hostname}:5001/api`;
        }

        // 4. If running on Vercel with configured serverless proxy rewrites in vercel.json
        if (hostname.endsWith('.vercel.app')) {
            return '/api';
        }

        // 5. On Cloudflare Pages (e.g. cle-attendance.pages.dev) or remote production hosts:
        // Cloudflare Pages cannot proxy POST requests via static redirects (returns 405 Method Not Allowed).
        // Therefore, connect directly to the live secure HTTPS backend.
        return LIVE_BACKEND_URL;
    }

    return LIVE_BACKEND_URL;
};

const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 30000, // 30s timeout to allow cold-start handling without hanging indefinitely
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
        return Promise.reject(error);
    }
);

export default api;
