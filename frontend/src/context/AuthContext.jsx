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

    const login = async (phone, role) => {
        try {
            const res = await api.post('/attendance/send-otp', { phone, role });
            return res;
        } catch (error) {
            console.error("Auth Login Error:", error);
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.response?.data?.details || "Failed to connect to authentication service.";
            return {
                data: {
                    success: false,
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

    const verifyOtp = async (phone, otp, targetRole) => {
        try {
            const res = await api.post('/attendance/verify-otp', { phone, otp, role: targetRole });
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
                let name = 'Demo Staff 1';
                let college = '';
                let department = 'Engineering';
                let activePhone = phone || '1234567890';
                let employeeId = 'EMP100';

                // Default specialized demo roles
                if (activePhone === '9999999999' || activePhone === 'EMP000') {
                    role = 'admin';
                    userId = 1;
                    name = 'Admin User';
                    activePhone = '9999999999';
                    employeeId = 'EMP000';
                    department = 'Administration';
                } else if (activePhone === '8888888888' || activePhone === 'EMP001') {
                    role = 'hoi';
                    userId = 2;
                    name = 'Principal User';
                    activePhone = '8888888888';
                    employeeId = 'EMP001';
                    department = 'Principal Office';
                } else if (activePhone === '9876543210' || activePhone === 'EMP101') {
                    userId = 101;
                    name = 'Demo Staff 2';
                    activePhone = '9876543210';
                    employeeId = 'EMP101';
                    department = 'HR';
                } else if (activePhone === '1234567890' || activePhone === 'EMP100') {
                    userId = 100;
                    name = 'Demo Staff 1';
                    activePhone = '1234567890';
                    employeeId = 'EMP100';
                    department = 'Engineering';
                }

                if (targetRole) {
                    const dbRole = role.toLowerCase();
                    const reqRole = targetRole.toLowerCase();
                    const rolesMatch = dbRole === reqRole || 
                                       ((dbRole === 'hoi' || dbRole === 'principal') && 
                                        (reqRole === 'hoi' || reqRole === 'principal'));
                    if (!rolesMatch) {
                        const displayRole = reqRole === 'hoi' || reqRole === 'principal' ? 'Principal' : reqRole.charAt(0).toUpperCase() + reqRole.slice(1);
                        return { success: false, error: `Unauthorized: User is not registered as ${displayRole}.` };
                    }
                }

                const mockUser = { id: userId, employee_id: employeeId, phone: activePhone, role, name, college, department };
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
