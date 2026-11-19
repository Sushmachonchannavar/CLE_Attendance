import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { getDeviceId } from './device';

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

        // 2. If an explicit remote HTTPS API URL or relative path is configured via VITE_API_URL, use it directly.
        if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '') {
            const trimmed = rawUrl.trim();
            if (trimmed.startsWith('/')) {
                return trimmed.replace(/\/+$/, '') || '/api';
            }
            const cleanUrl = trimmed.replace(/\/+$/, '');
            const finalUrl = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
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
            return `http://${hostname}:5001/api`;
        }

        // 4. If running on Vercel (production or preview deployments, *.vercel.app):
        //    vercel.json rewrites /api/* → Render backend.
        if (hostname.endsWith('.vercel.app')) {
            return '/api';
        }

        // 5. On Cloudflare Pages or any other remote production host:
        return LIVE_BACKEND_URL;
    }

    return LIVE_BACKEND_URL;
};

const resolvedBaseURL = getBaseURL();
console.log(`[API] Base URL resolved to: ${resolvedBaseURL}`);

const api = axios.create({
    baseURL: resolvedBaseURL,
    timeout: 60000, // 60s timeout to allow Render free-tier cold-start (30-50s) to finish without aborting
    withCredentials: true // Transmit HTTP-only session cookies with all cross-site & same-site requests
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach trusted device ID and mobile refresh token fallback headers
    const deviceId = getDeviceId();
    if (deviceId) {
        config.headers['x-device-id'] = deviceId;
    }

    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
        config.headers['x-refresh-token'] = refreshToken;
    }

    return config;
});

// Guard against concurrent refresh loops and queue pending requests during token refresh
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(subscriber) {
    refreshSubscribers.push(subscriber);
}

function onRefreshed(newToken) {
    refreshSubscribers.forEach(sub => {
        if (typeof sub === 'function') {
            sub(newToken);
        } else if (sub && typeof sub.resolve === 'function') {
            sub.resolve(newToken);
        }
    });
    refreshSubscribers = [];
}

function onRefreshFailed(error) {
    refreshSubscribers.forEach(sub => {
        if (sub && typeof sub.reject === 'function') {
            sub.reject(error);
        }
    });
    refreshSubscribers = [];
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If a protected API route returns 401 Unauthorized, attempt silent refresh token rotation
        if (error.response && error.response.status === 401 && originalRequest && !originalRequest._retry) {
            const requestUrl = originalRequest.url || '';
            const isAuthEndpoint = requestUrl.includes('/auth/login') || 
                                   requestUrl.includes('/auth/send-otp') ||
                                   requestUrl.includes('/auth/verify') || 
                                   requestUrl.includes('/auth/verify-otp') ||
                                   requestUrl.includes('/auth/refresh-token');

            const storedRefresh = localStorage.getItem('refreshToken');

            // If the failure occurred on an auth endpoint itself or if NO refresh token is available,
            // do not attempt refresh (avoids doomed refresh calls that print 401s for unauthenticated users)
            if (isAuthEndpoint || !storedRefresh || !storedRefresh.trim()) {
                if (!storedRefresh && localStorage.getItem('token')) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }
                return Promise.reject(error);
            }

            originalRequest._retry = true;

            // If a refresh is already in flight, queue this request until the new token arrives
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    subscribeTokenRefresh({
                        resolve: (newToken) => {
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            resolve(api(originalRequest));
                        },
                        reject: (refreshErr) => {
                            reject(refreshErr);
                        }
                    });
                });
            }

            isRefreshing = true;

            try {
                const deviceId = getDeviceId();
                const refreshRes = await axios.post(`${resolvedBaseURL}/auth/refresh-token`, {
                    deviceId,
                    refreshToken: storedRefresh.trim()
                }, {
                    withCredentials: true,
                    headers: {
                        'x-device-id': deviceId,
                        'x-refresh-token': storedRefresh.trim()
                    }
                });

                if (refreshRes.data && refreshRes.data.token) {
                    const newToken = refreshRes.data.token;
                    localStorage.setItem('token', newToken);
                    if (refreshRes.data.refreshToken) {
                        localStorage.setItem('refreshToken', refreshRes.data.refreshToken);
                    }
                    if (refreshRes.data.user) {
                        localStorage.setItem('user', JSON.stringify(refreshRes.data.user));
                    }
                    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                    
                    isRefreshing = false;
                    onRefreshed(newToken);

                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return api(originalRequest);
                } else {
                    throw new Error('Refresh response did not contain new access token.');
                }
            } catch (refreshErr) {
                isRefreshing = false;
                onRefreshFailed(refreshErr);

                console.warn('[AUTH SESSION] Silent refresh failed or session revoked.');
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                delete api.defaults.headers.common['Authorization'];

                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('auth:session_expired', {
                        detail: {
                            reason: refreshErr.response?.data?.error || 'Your session has expired. Please log in again.'
                        }
                    }));
                }
                return Promise.reject(refreshErr);
            }
        }

        // Diagnostic console logging: suppress expected 401s for unauthenticated session probes
        if (error.response) {
            const isUnauthenticatedProbe = error.response.status === 401 && (
                (error.config?.url?.includes('/auth/verify-token') && !localStorage.getItem('refreshToken')) ||
                error.config?.url?.includes('/auth/refresh-token')
            );

            if (!isUnauthenticatedProbe) {
                console.error(
                    `[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} → HTTP ${error.response.status}:`,
                    error.response.data
                );
            }
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
