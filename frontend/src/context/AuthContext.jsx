import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../utils/api';
import { getDeviceId, getDeviceInfo } from '../utils/device';

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
     * If access token is expired, transparently attempts refresh token rotation.
     */
    const checkSession = useCallback(async () => {
        try {
            const res = await api.get('/auth/verify-token');
            if (res.data && res.data.user) {
                const verifiedUser = res.data.user;
                if (res.data.token) {
                    localStorage.setItem('token', res.data.token);
                }
                setUser(verifiedUser);
                localStorage.setItem('user', JSON.stringify(verifiedUser));
                return { authenticated: true, user: verifiedUser };
            }
            throw new Error('Invalid user payload');
        } catch (err) {
            const status = err.response?.status;
            // If access token expired or 401, attempt silent refresh token rotation
            if (status === 401) {
                try {
                    const deviceId = getDeviceId();
                    const storedRefresh = localStorage.getItem('refreshToken') || '';
                    const refreshRes = await api.post('/auth/refresh-token', {
                        deviceId,
                        refreshToken: storedRefresh
                    });
                    if (refreshRes.data && refreshRes.data.user) {
                        const freshUser = refreshRes.data.user;
                        if (refreshRes.data.token) {
                            localStorage.setItem('token', refreshRes.data.token);
                        }
                        if (refreshRes.data.refreshToken) {
                            localStorage.setItem('refreshToken', refreshRes.data.refreshToken);
                        }
                        setUser(freshUser);
                        localStorage.setItem('user', JSON.stringify(freshUser));
                        return { authenticated: true, user: freshUser };
                    }
                } catch (refreshErr) {
                    console.warn('[AUTH SESSION] Silent session refresh failed or session revoked.');
                    localStorage.removeItem('token');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('user');
                    setUser(null);
                    return { authenticated: false, error: 'Session expired' };
                }
            }

            if (status === 403) {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                setUser(null);
                return { authenticated: false, error: 'Session forbidden' };
            }

            // For transient network errors, keep cached user if present for offline support
            const cachedUser = localStorage.getItem('user');
            if (!cachedUser) {
                setUser(null);
            }
            return { authenticated: Boolean(cachedUser), offline: true };
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial session verification on startup
    useEffect(() => {
        checkSession();

        // Listen for session expired events dispatched by API response interceptor
        const handleSessionExpired = () => {
            console.warn('[AUTH SESSION] Received session expiration event.');
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
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
            const deviceId = getDeviceId();
            const res = await api.post('/auth/login', { phone, role, deviceId });
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
            const deviceId = getDeviceId();
            const deviceInfo = getDeviceInfo();
            const res = await api.post('/auth/verify', { 
                phone, 
                otp, 
                role: targetRole,
                deviceId,
                deviceInfo
            });
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
            }
            if (res.data.refreshToken) {
                localStorage.setItem('refreshToken', res.data.refreshToken);
            }
            if (res.data.deviceId) {
                localStorage.setItem('cle_device_id', res.data.deviceId);
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

    const updateUser = (updatedUserData, newToken) => {
        if (updatedUserData) {
            setUser(updatedUserData);
            localStorage.setItem('user', JSON.stringify(updatedUserData));
        }
        if (newToken) {
            localStorage.setItem('token', newToken);
        }
    };

    const logout = async () => {
        try {
            const deviceId = getDeviceId();
            // Invalidate server session for this device and clear HTTP-only cookies
            await api.post('/auth/logout', { deviceId }).catch(() => {});
        } finally {
            // Purge client-side tokens and state for this device
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            setUser(null);
        }
    };

    const logoutAll = async () => {
        try {
            await api.post('/auth/logout-all').catch(() => {});
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            setUser(null);
        }
    };

    const getSessions = async () => {
        try {
            const res = await api.get('/auth/sessions');
            return res.data?.sessions || [];
        } catch (e) {
            console.error('Failed to get sessions:', e);
            return [];
        }
    };

    const revokeSession = async (sessionId) => {
        const res = await api.delete(`/auth/sessions/${sessionId}`);
        return res.data;
    };

    const revokeOtherSessions = async () => {
        const res = await api.delete('/auth/sessions');
        return res.data;
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            login, 
            register, 
            verifyOtp, 
            logout, 
            logoutAll,
            getSessions,
            revokeSession,
            revokeOtherSessions,
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
