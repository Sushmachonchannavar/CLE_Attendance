import { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

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
                        // Verify token with backend by making a test request
                        try {
                            const res = await api.get('/auth/verify-token');
                            // res.data.user now contains the full DB profile (including name)
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

    const login = async (phone) => {
        try {
            const res = await api.post('/auth/login', { phone });
            if (res.data.debug) {
                alert(`[DEMO MODE] ${res.data.debug}`);
            } else {
                alert(`Success: Verification code has been sent to your mobile number.`);
            }
            return true;
        } catch (error) {
            const errorMsg = error.response?.data?.error || "Failed to connect to authentication service.";
            alert(`Error: ${errorMsg}`);
            console.error("Auth Login Error:", error);
            return false;
        }
    };

    const register = async (userData) => {
        try {
            const res = await api.post('/auth/register', userData);
            return { success: true, message: res.data.message };
        } catch (error) {
            console.error("API Error, falling back to demo mode", error);
            // Fallback for demo: Save registered user info
            localStorage.setItem(`demo_user_${userData.mobile}`, JSON.stringify({
                name: `${userData.firstName} ${userData.lastName}`,
                phone: userData.mobile,
                college: userData.collegeName,
                department: userData.departmentName
            }));
            return { success: true };
        }
    };

    const verifyOtp = async (phone, otp) => {
        try {
            const res = await api.post('/auth/verify', { phone, otp });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            setUser(res.data.user);
            return { success: true };
        } catch (error) {
            console.error("API Error, checking for demo OTP", error);
            // Fallback Mock Login
            if (otp === '123456') {
                let role = 'staff';
                let userId = 100; // Default staff ID
                let name = 'Demo Staff';
                let college = '';
                let department = '';

                // Default specialized demo roles
                if (phone === '9999999999') {
                    role = 'admin';
                    userId = 1;
                    name = 'Admin User';
                } else if (phone === '8888888888') {
                    role = 'hoi';
                    userId = 2;
                    name = 'Principal User';
                } else if (phone === '9876543210') {
                    userId = 101;
                    name = 'Demo Staff 2';
                }

                // Override with registered demo data if exists
                const registeredUser = localStorage.getItem(`demo_user_${phone}`);
                if (registeredUser) {
                    const data = JSON.parse(registeredUser);
                    name = data.name;
                    college = data.college || '';
                    department = data.department || '';
                }

                const mockUser = { id: userId, phone, role, name, college, department };
                localStorage.setItem('token', 'mock-jwt-token');
                localStorage.setItem('user', JSON.stringify(mockUser));
                setUser(mockUser);
                return { success: true };
            }
            const errorMsg = error.response?.data?.error || "Network Error. Try OTP '123456' for demo.";
            return { success: false, error: errorMsg };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, verifyOtp, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
