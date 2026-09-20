import axios from 'axios';

export const getBaseURL = () => {
    const rawUrl = import.meta.env.VITE_API_URL;
    if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '') {
        const trimmed = rawUrl.trim().replace(/\/+$/, '');
        return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
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
