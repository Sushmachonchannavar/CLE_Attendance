import axios from 'axios';
import { Capacitor } from '@capacitor/core';

export const getBaseURL = () => {
    const rawUrl = import.meta.env.VITE_API_URL;

    // Check if on native mobile (Capacitor)
    if (Capacitor.isNativePlatform()) {
        if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '') {
            const trimmed = rawUrl.trim().replace(/\/+$/, '');
            const finalUrl = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
            if (!finalUrl.includes('localhost') && !finalUrl.includes('127.0.0.1')) {
                return finalUrl;
            }
        }
        // Native fallback: use live Render backend URL
        return 'https://cle-attendance-1.onrender.com/api';
    }

    // In web browser (Desktop, Android Chrome, iPhone Safari):
    // 1. If accessed through browser, relative /api is always preferred
    // This allows Vite dev proxy, Cloudflare Tunnels, and Nginx reverse proxies to handle routing seamlessly
    if (typeof window !== 'undefined' && window.location) {
        // If VITE_API_URL is an explicit remote origin and not localhost, respect it
        if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '') {
            const trimmed = rawUrl.trim().replace(/\/+$/, '');
            const finalUrl = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
            if (!finalUrl.includes('localhost') && !finalUrl.includes('127.0.0.1')) {
                return finalUrl;
            }
        }
        return '/api';
    }

    return 'https://cle-attendance-1.onrender.com/api';
};

const api = axios.create({
    baseURL: getBaseURL(),
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
