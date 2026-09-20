import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import CleLogo from '../components/CleLogo';
import { Phone, ArrowRight, ShieldCheck, KeyRound, Clock, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

const Login = () => {
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [role, setRole] = useState('staff'); // 'staff', 'hoi', 'admin'
    const [step, setStep] = useState(1);
    const [otpError, setOtpError] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const { login, verifyOtp } = useAuth();
    const navigate = useNavigate();

    // Timer countdown for resend OTP
    useEffect(() => {
        let timer;
        if (resendCooldown > 0) {
            timer = setInterval(() => {
                setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            setOtpError('Please enter a valid 10-digit mobile number.');
            return;
        }

        setIsSubmitting(true);
        setOtpError('');
        setStatusMessage('');

        try {
            const response = await login(cleanPhone, role);
            if (response && response.data && response.data.success) {
                // Keep compatibility with dialog tests while also setting in-app status
                setStatusMessage('Verification code sent to registered mobile number.');
                // Trigger alert for existing automated test suite dialog listeners
                alert('Success: Verification code has been sent to your registered mobile number.');
                setStep(2);
                setResendCooldown(45);
                setOtp('');
                setOtpError('');
            } else {
                const errorMsg = response?.data?.message || 'Failed to send OTP. Please try again.';
                setOtpError(errorMsg);
                alert(`Error: ${errorMsg}`);
            }
        } catch (err) {
            console.error('Login error:', err);
            setOtpError('Unable to connect to authentication service. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const cleanPhone = phone.replace(/\D/g, '');
        const cleanOtp = otp.replace(/\D/g, '');

        if (cleanOtp.length !== 6) {
            setOtpError('Please enter a complete 6-digit OTP.');
            return;
        }

        setIsSubmitting(true);
        setOtpError('');

        try {
            const result = await verifyOtp(cleanPhone, cleanOtp, role);
            if (result.success) {
                navigate('/dashboard');
            } else {
                setOtpError(result.error || 'Invalid OTP. Please try again.');
            }
        } catch (err) {
            console.error('Verify error:', err);
            setOtpError('Unable to verify code. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendCooldown > 0 || isSubmitting) return;

        setIsSubmitting(true);
        setOtpError('');

        try {
            const cleanPhone = phone.replace(/\D/g, '');
            const response = await login(cleanPhone, role);
            if (response && response.data && response.data.success) {
                setResendCooldown(45);
                setOtp('');
                setStatusMessage('A new verification code has been dispatched.');
                alert('Success: Verification code has been sent to your registered mobile number.');
            } else {
                const errorMsg = response?.data?.message || 'Failed to resend OTP. Please try again.';
                setOtpError(errorMsg);
                alert(`Error: ${errorMsg}`);
            }
        } catch (err) {
            console.error('Resend error:', err);
            setOtpError('Failed to resend code. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0c1938] to-[#081026] flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-sans">
            {/* Ambient Lighting Orbs */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Application Branding Banner */}
            <div className="mb-6 text-center z-10 animate-in fade-in duration-500">
                <CleLogo size="lg" variant="light" className="justify-center mb-2" />
                <h1 className="text-white text-lg font-bold tracking-tight sm:text-xl drop-shadow-sm">
                    CLE Society – Staff Attendance & Location System
                </h1>
                <p className="text-blue-200/80 text-xs mt-1 font-medium">
                    Official Faculty & Staff Academic Portal
                </p>
            </div>

            {/* Main Authentication Card */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100/90 p-6 sm:p-8 z-10 animate-in zoom-in-95 duration-300">
                {/* Role Tabs */}
                <div className="mb-6 bg-slate-100 p-1.5 rounded-2xl flex gap-1">
                    {[
                        { key: 'staff', label: 'Faculty / Staff' },
                        { key: 'hoi', label: 'Principal' },
                        { key: 'admin', label: 'Admin' }
                    ].map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                                setRole(item.key);
                                setOtpError('');
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                                role === item.key
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Quick Demo Login Credentials Box */}
                <div className="mb-5 p-3.5 bg-gradient-to-br from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-200/80 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                            Demo Accounts (OTP: 123456)
                        </span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200/60">
                            Tap to Fill
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                        {/* Staff */}
                        <button
                            type="button"
                            onClick={() => {
                                setRole('staff');
                                setPhone('9876543210');
                                setOtpError('');
                            }}
                            className={`p-2 rounded-xl border text-left transition-all ${
                                role === 'staff' && phone === '9876543210'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                                    : 'bg-white hover:bg-blue-50/50 text-slate-800 border-slate-200/80 hover:border-blue-300'
                            }`}
                        >
                            <div className={`text-[10px] font-extrabold uppercase ${role === 'staff' && phone === '9876543210' ? 'text-blue-100' : 'text-blue-600'}`}>Staff</div>
                            <div className="text-xs font-mono font-bold tracking-tight mt-0.5">9876543210</div>
                        </button>

                        {/* Principal */}
                        <button
                            type="button"
                            onClick={() => {
                                setRole('hoi');
                                setPhone('8888888888');
                                setOtpError('');
                            }}
                            className={`p-2 rounded-xl border text-left transition-all ${
                                role === 'hoi' && phone === '8888888888'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                                    : 'bg-white hover:bg-blue-50/50 text-slate-800 border-slate-200/80 hover:border-blue-300'
                            }`}
                        >
                            <div className={`text-[10px] font-extrabold uppercase ${role === 'hoi' && phone === '8888888888' ? 'text-blue-100' : 'text-indigo-600'}`}>Principal</div>
                            <div className="text-xs font-mono font-bold tracking-tight mt-0.5">8888888888</div>
                        </button>

                        {/* Admin */}
                        <button
                            type="button"
                            onClick={() => {
                                setRole('admin');
                                setPhone('9999999999');
                                setOtpError('');
                            }}
                            className={`p-2 rounded-xl border text-left transition-all ${
                                role === 'admin' && phone === '9999999999'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                                    : 'bg-white hover:bg-blue-50/50 text-slate-800 border-slate-200/80 hover:border-blue-300'
                            }`}
                        >
                            <div className={`text-[10px] font-extrabold uppercase ${role === 'admin' && phone === '9999999999' ? 'text-blue-100' : 'text-emerald-600'}`}>Admin</div>
                            <div className="text-xs font-mono font-bold tracking-tight mt-0.5">9999999999</div>
                        </button>
                    </div>
                </div>

                {/* Step 1: Request Mobile Number */}
                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label htmlFor="login-role-select" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Authorized Role
                        </label>
                        <select
                            id="login-role-select"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                            <option value="staff">Staff Portal</option>
                            <option value="hoi">Principal / HOI Portal</option>
                            <option value="admin">System Administrator</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="login-phone-input" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Registered Mobile Number
                        </label>
                        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white transition-all overflow-hidden">
                            <span className="flex items-center gap-1.5 pl-3.5 pr-2.5 py-3 text-slate-500 font-bold text-sm bg-slate-100 border-r border-slate-200 select-none">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                +91
                            </span>
                            <input
                                id="login-phone-input"
                                type="tel"
                                inputMode="numeric"
                                className="w-full px-3 py-3 bg-transparent text-slate-900 font-bold tracking-wider placeholder:font-normal placeholder:text-slate-400 focus:outline-none text-sm"
                                value={phone}
                                onChange={(e) => {
                                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                                    setOtpError('');
                                }}
                                placeholder="Enter 10-digit number"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {otpError && step === 1 && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-semibold animate-in fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{otpError}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white rounded-xl font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Sending OTP...</span>
                            </>
                        ) : (
                            <>
                                <span>SEND OTP</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>

                    <div className="pt-4 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-500 font-medium">
                            New staff member?{' '}
                            <Link to="/register" className="text-blue-600 font-bold hover:underline">
                                Register Institution Profile
                            </Link>
                        </p>
                    </div>
                </form>
            </div>

            {/* Step 2: OTP Verification Modal */}
            {step === 2 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Darkened Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => !isSubmitting && setStep(1)}
                    />

                    {/* Modal Card */}
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-7 border border-slate-100 z-10 animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                                <KeyRound className="w-7 h-7" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Verify OTP</h3>
                            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                                Enter the 6-digit authentication code sent to <br />
                                <span className="font-bold text-slate-700">+91 {phone}</span>
                            </p>
                        </div>

                        {statusMessage && (
                            <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>{statusMessage}</span>
                            </div>
                        )}

                        {/* Demo Mode Helper Banner */}
                        {['9999999999', '8888888888', '9876543210', '1234567890'].includes(phone.replace(/\D/g, '').slice(-10)) && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-2xl text-center animate-in fade-in">
                                <p className="text-xs font-bold text-blue-900">
                                    Demo Account Active • Code: <strong className="font-mono text-sm underline decoration-blue-500">123456</strong>
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOtp('123456');
                                        setOtpError('');
                                    }}
                                    className="mt-2 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5"
                                >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    <span>Click to Auto-fill Demo OTP (123456)</span>
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleVerify} className="space-y-5">
                            <div>
                                <label htmlFor="otp-verification-input" className="block mb-2 text-xs font-bold text-slate-600 uppercase text-center tracking-wider">
                                    6-Digit Verification Code
                                </label>
                                <input
                                    id="otp-verification-input"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    className={`w-full px-4 py-3.5 bg-slate-50 border ${
                                        otpError ? 'border-rose-400 ring-2 ring-rose-400/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                    } rounded-2xl text-center text-2xl font-black tracking-[0.6rem] text-slate-900 focus:outline-none transition-all`}
                                    value={otp}
                                    onChange={(e) => {
                                        setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                                        setOtpError('');
                                    }}
                                    placeholder="------"
                                    required
                                    autoFocus
                                    disabled={isSubmitting}
                                />

                                {otpError && (
                                    <p className="mt-2 text-xs text-rose-600 font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>{otpError}</span>
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || otp.length !== 6}
                                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Verifying OTP...</span>
                                    </>
                                ) : (
                                    <span>Verify & Continue</span>
                                )}
                            </button>

                            {/* Resend & Edit Number Controls */}
                            <div className="flex flex-col items-center gap-3 pt-2">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    {resendCooldown > 0 ? (
                                        <span>Resend code in <strong className="text-slate-800">{resendCooldown}s</strong></span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleResendOtp}
                                            disabled={isSubmitting}
                                            className="text-blue-600 hover:text-blue-800 font-bold underline transition-colors"
                                        >
                                            Didn't receive code? Resend OTP
                                        </button>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep(1);
                                        setOtpError('');
                                    }}
                                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                >
                                    ← Change Mobile Number
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Footer Copyright */}
            <div className="mt-8 text-center text-[11px] text-slate-400 font-medium z-10 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>CLE Society • Secure Multi-Factor Campus Attendance</span>
            </div>
        </div>
    );
};

export default Login;
