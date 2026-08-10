import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [role, setRole] = useState('staff'); // 'staff', 'hoi', 'admin'
    const [step, setStep] = useState(1);
    const [otpError, setOtpError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);

    const { login, verifyOtp } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        // Remove non-numeric characters before submitting
        const cleanPhone = phone.replace(/\D/g, '');
        const response = await login(cleanPhone, role);
        if (response && response.data && response.data.success) {
            if (response.data.debug) {
                alert(`[DEMO MODE] ${response.data.debug}`);
            } else {
                alert(`Success: Verification code has been sent to your registered mobile number.`);
            }
            setStep(2);
            setOtpError('');
            setOtp('');
        } else {
            const errorMsg = response?.data?.message || 'Failed to send OTP. Please try again.';
            alert(`Error: ${errorMsg}`);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        const cleanPhone = phone.replace(/\D/g, '');
        const result = await verifyOtp(cleanPhone, otp, role);
        if (result.success) {
            navigate('/dashboard');
        } else {
            setOtpError(result.error || 'Invalid OTP. Please try again.');
        }
    };

    const handleResendOtp = async () => {
        setResendCooldown(30);
        const timer = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        const cleanPhone = phone.replace(/\D/g, '');
        const response = await login(cleanPhone, role);
        if (response && response.data && response.data.success) {
            if (response.data.debug) {
                alert(`[DEMO MODE] ${response.data.debug}`);
            } else {
                alert(`Success: Verification code has been sent to your registered mobile number.`);
            }
            setOtpError('');
            setOtp('');
        } else {
            const errorMsg = response?.data?.message || 'Failed to send OTP. Please try again.';
            alert(`Error: ${errorMsg}`);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0a1128] via-[#101f42] to-[#0a1128]">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-72 h-72 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl opacity-10"></div>
                <div className="absolute bottom-[-10%] right-[-5%] w-80 h-80 bg-indigo-500 rounded-full mix-blend-screen filter blur-3xl opacity-10"></div>
            </div>

            <div className="relative p-10 bg-white rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.04)] w-full max-w-[420px] border border-gray-100">
                <div className="text-center mb-8">
                    <p className="text-gray-500 text-sm font-semibold tracking-wide">
                        Welcome back to {role === 'admin' ? 'Admin' : role === 'hoi' ? 'Principal' : 'Staff'} Portal
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {/* Login As Dropdown */}
                    <div>
                        <label className="block mb-2 text-sm font-bold text-slate-700 ml-1">Login As</label>
                        <div className="relative">
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full px-4 py-4 bg-[#f6f8fd] border border-gray-150 rounded-2xl appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400/50 transition-all font-semibold text-gray-700 cursor-pointer pr-10"
                            >
                                <option value="staff">Staff</option>
                                <option value="hoi">Principal</option>
                                <option value="admin">Admin</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Phone Number Field */}
                    <div>
                        <label className="block mb-2 text-sm font-bold text-slate-700 ml-1">Phone Number</label>
                        <div className="flex items-center bg-[#f6f8fd] border border-gray-150 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-400/50 transition-all">
                            <span className="pl-4 pr-3 text-gray-400 font-bold text-base border-r border-gray-200 select-none">
                                +91
                            </span>
                            <input
                                type="tel"
                                className="w-full pl-3 pr-4 py-4 bg-transparent focus:outline-none font-bold tracking-wider text-gray-700 placeholder:text-gray-300 placeholder:font-normal"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                placeholder="Enter mobile number"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4.5 bg-[#f15e19] text-white rounded-2xl font-black text-base shadow-xl shadow-orange-600/20 hover:bg-[#e04f0d] active:scale-[0.98] transition-all duration-200 uppercase tracking-widest mt-2"
                    >
                        SEND OTP
                    </button>

                    <div className="mt-8 text-center border-t border-gray-100 pt-6">
                        <p className="text-sm text-gray-500 font-medium">
                            Don't have an account?{' '}
                            <Link to="/register" className="text-blue-600 font-bold hover:underline transition-all">
                                Register Now
                            </Link>
                        </p>
                    </div>
                </form>
            </div>

            {/* OTP Modal (Pop-up) */}
            {step === 2 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-md animate-in fade-in duration-300"></div>

                    {/* Modal Content */}
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-300 border border-white/20">
                        <button
                            onClick={() => setStep(1)}
                            className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-all"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800">Verify OTP</h3>
                            <p className="text-gray-500 text-sm mt-2">
                                We've sent a code to the registered mobile <span className="font-bold text-gray-700">{phone}</span>
                            </p>
                        </div>

                        <form onSubmit={handleVerify}>
                            <div className="mb-6 text-center">
                                <input
                                    type="text"
                                    className={`w-full px-4 py-4 bg-gray-50 border ${otpError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200 focus:ring-4 focus:ring-blue-500/10'} rounded-2xl text-center text-3xl font-black tracking-[0.5rem] focus:outline-none transition-all`}
                                    value={otp}
                                    onChange={(e) => {
                                        setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                                        setOtpError('');
                                    }}
                                    placeholder="------"
                                    required
                                    autoFocus
                                />
                                {otpError && (
                                    <p className="mt-3 text-sm text-red-500 font-bold flex items-center justify-center gap-2">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        {otpError}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
                            >
                                Verify & Continue
                            </button>

                            <div className="mt-6 flex flex-col items-center gap-4">
                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    disabled={resendCooldown > 0}
                                    className={`text-sm font-bold transition-all ${resendCooldown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'}`}
                                >
                                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Didn\'t receive code? Resend'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-sm font-bold text-gray-500 hover:text-gray-700 underline underline-offset-4"
                                >
                                    Change Mobile Number
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
