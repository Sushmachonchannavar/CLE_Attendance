import axios from 'axios';

export const getBaseURL = () => {
    const rawUrl = import.meta.env.VITE_API_URL;
    if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '') {
        const trimmed = rawUrl.trim().replace(/\/+$/, '');
        const finalUrl = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
        // Guard against accidental localhost / 127.0.0.1 / development URLs in production
        if (import.meta.env.PROD && (finalUrl.includes('localhost') || finalUrl.includes('127.0.0.1') || finalUrl.includes(':5001'))) {
            return 'https://cle-attendance.onrender.com/api';
        }
        return finalUrl;
    }
    // In production, default directly to the deployed Render backend
    if (import.meta.env.PROD) {
        return 'https://cle-attendance.onrender.com/api';
    }
    return 'http://localhost:5001/api';
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
