import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Send user role and ID for proper authorization
    if (user) {
        try {
            const userData = JSON.parse(user);
            config.headers['X-User-Role'] = userData.role;
            config.headers['X-User-Id'] = userData.id;
        } catch {
            console.error('Error parsing user data from localStorage');
        }
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Log detailed error information for debugging
        console.error('API Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        return Promise.reject(error);
    }
);

export default api;
