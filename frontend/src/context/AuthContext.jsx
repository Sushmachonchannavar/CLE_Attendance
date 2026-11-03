import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../utils/api';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const cachedUser = localStorage.getItem('user');
            return cachedUser ? JSON.parse(cachedUser) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(true);

    /**
     * Centralized session verification callback.
     * Verifies current session with backend using both HTTP-only cookies and Bearer token.
     */
    const checkSession = useCallback(async () => {
        try {
            const res = await api.get('/auth/verify-token');
            if (res.data && res.data.user) {
                const verifiedUser = res.data.user;
                setUser(verifiedUser);
                localStorage.setItem('user', JSON.stringify(verifiedUser));
                return { authenticated: true, user: verifiedUser };
            }
            throw new Error('Invalid user payload');
        } catch (err) {
            const status = err.response?.status;
            // Only clear session on actual authentication failure (401 / 403)
            // Preserve cached state on transient network offline errors for offline mobile queueing
            if (status === 401 || status === 403) {
                console.warn('[AUTH SESSION] Session invalid or expired. Resetting session state.');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setUser(null);
                return { authenticated: false, error: 'Session expired' };
            }
            // For network errors, keep cached user if present
            const cachedUser = localStorage.getItem('user');
            if (!cachedUser) {
                setUser(null);
            }
            return { authenticated: Boolean(user), offline: true };
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Initial session verification on startup
    useEffect(() => {
        checkSession();

        // Listen for session expired events dispatched by API response interceptor
        const handleSessionExpired = () => {
            console.warn('[AUTH SESSION] Received session expiration event.');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
        };

        window.addEventListener('auth:session_expired', handleSessionExpired);
        return () => {
            window.removeEventListener('auth:session_expired', handleSessionExpired);
        };
    }, [checkSession]);

    const login = async (phone, role) => {
        try {
            const res = await api.post('/auth/login', { phone, role });
            return res;
        } catch (error) {
            console.error("Auth Login Error:", error.message || error);
            let errorMsg;
            if (error.response?.data) {
                errorMsg = error.response.data.error || error.response.data.message || "Failed to process login request.";
            } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                errorMsg = "Server is waking up (Render free tier cold start). Please wait a few seconds and try again.";
            } else {
                errorMsg = "Unable to connect to authentication service. The server may be waking up from sleep — please wait a moment and retry.";
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
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
            }
            if (res.data.user) {
                localStorage.setItem('user', JSON.stringify(res.data.user));
                setUser(res.data.user);
            }
            return { success: true, user: res.data.user };
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

    const logout = async () => {
        try {
            // Invalidate server session and clear HTTP-only cookie
            await api.post('/auth/logout').catch(() => {});
        } finally {
            // Always purge client-side tokens and state
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            login, 
            register, 
            verifyOtp, 
            logout, 
            loading, 
            updateUser, 
            checkSession,
            isAuthenticated: Boolean(user)
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
