import { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const token = localStorage.getItem('token');
                const userJson = localStorage.getItem('user');

                if (token && userJson) {
                    try {
                        const storedUser = JSON.parse(userJson);
                        setUser(storedUser);

                        // Verify token with backend by making a test request
                        try {
                            const res = await api.get('/auth/verify-token');
                            const updatedUser = res.data.user;
                            setUser(updatedUser);
                            localStorage.setItem('user', JSON.stringify(updatedUser));
                        } catch (err) {
                            console.warn('Token verification failed:', err.message);
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            setUser(null);
                        }
                    } catch (parseErr) {
                        console.error('Error parsing user data:', parseErr);
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        setUser(null);
                    }
                }
            } catch (err) {
                console.error('Error loading auth from localStorage:', err);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        initializeAuth();
    }, []);

    const login = async (phone, role) => {
        try {
            const res = await api.post('/auth/login', { phone, role });
            return res;
        } catch (error) {
            console.error("Auth Login Error:", error.message || error);
            let errorMsg;
            if (error.response?.data) {
                errorMsg = error.response.data.error || error.response.data.message || "Failed to process login request.";
            } else if (error.code === 'ECONNABORTED') {
                errorMsg = "Authentication service connection timed out. Please try again shortly.";
            } else {
                errorMsg = "Unable to connect to authentication service. Please verify server status and network connection.";
            }
            return {
                data: {
                    success: false,
                    error: errorMsg,
                    message: errorMsg
                }
            };
        }
    };

    const register = async (userData) => {
        try {
            const res = await api.post('/auth/register', userData);
            return { success: true, message: res.data.message };
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.response?.data?.message || "Registration failed. Please try again.";
            return { success: false, error: errorMsg };
        }
    };

    const verifyOtp = async (phone, otp, targetRole) => {
        try {
            const res = await api.post('/auth/verify', { phone, otp, role: targetRole });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            setUser(res.data.user);
            return { success: true };
        } catch (error) {
            let errorMsg;
            if (error.response?.data) {
                errorMsg = error.response.data.error || error.response.data.message || "Invalid verification code.";
            } else if (error.code === 'ECONNABORTED') {
                errorMsg = "Verification request timed out. Please try again.";
            } else {
                errorMsg = "Unable to connect to authentication service to verify code.";
            }
            return { success: false, error: errorMsg };
        }
    };

    const updateUser = (updatedUserData) => {
        if (updatedUserData) {
            setUser(updatedUserData);
            localStorage.setItem('user', JSON.stringify(updatedUserData));
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, verifyOtp, logout, loading, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
