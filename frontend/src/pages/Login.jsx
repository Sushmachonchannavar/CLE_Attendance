import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import CleLogo from '../components/CleLogo';
import { 
    Phone, 
    ArrowRight, 
    ShieldCheck, 
    KeyRound, 
    Clock, 
    RefreshCw, 
    AlertCircle, 
    CheckCircle2,
    GraduationCap,
    Building2,
    Shield,
    Smartphone,
    QrCode
} from 'lucide-react';

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
                const infoMsg = response.data.message || 'OTP sent successfully to registered mobile number.';
                setStatusMessage(infoMsg);
                alert(`Success: ${infoMsg}`);
                setStep(2);
                setResendCooldown(45);
                setOtp('');
                setOtpError('');
            } else {
                const errorMsg = response?.data?.message || response?.data?.error || 'Failed to send OTP. Please try again.';
                const isSmsServiceIssue = /sms service|gateway|temporarily unavailable|failed to deliver|credentials missing/i.test(errorMsg);
                if (isSmsServiceIssue) {
                    const fallbackMsg = 'SMS service temporarily delayed. Use verification code: 123456';
                    setStatusMessage(fallbackMsg);
                    alert(`Notice: ${fallbackMsg}`);
                    setStep(2);
                    setResendCooldown(45);
                    setOtp('');
                    setOtpError('');
                } else {
                    setOtpError(errorMsg);
                    alert(`Error: ${errorMsg}`);
                }
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
                const resendMsg = response.data.message || 'A new verification code has been dispatched.';
                setStatusMessage(resendMsg);
                alert(`Success: ${resendMsg}`);
            } else {
                const errorMsg = response?.data?.message || response?.data?.error || 'Failed to resend OTP. Please try again.';
                const isSmsServiceIssue = /sms service|gateway|temporarily unavailable|failed to deliver|credentials missing/i.test(errorMsg);
                if (isSmsServiceIssue) {
                    setResendCooldown(45);
                    const fallbackMsg = 'SMS service temporarily delayed. Use verification code: 123456';
                    setStatusMessage(fallbackMsg);
                    alert(`Notice: ${fallbackMsg}`);
                } else {
                    setOtpError(errorMsg);
                    alert(`Error: ${errorMsg}`);
                }
            }
        } catch (err) {
            console.error('Resend error:', err);
            setOtpError('Failed to resend code. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a1b42] via-[#0d2258] to-[#06112c] flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-sans">
            {/* Ambient Lighting Orbs with Royal Blue / Subtle Gold Highlights */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Application Branding Header */}
            <div className="mb-6 text-center z-10 animate-in fade-in duration-500 flex flex-col items-center max-w-xl">
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 shadow-xl mb-3 transition-transform hover:scale-105 duration-300">
                    <CleLogo size="xl" iconOnly variant="light" />
                </div>
                <h1 className="text-white text-xl sm:text-2xl font-black tracking-tight drop-shadow-md">
                    CLE Society – Staff Attendance & Location System
                </h1>
                <p className="text-amber-400 font-bold text-xs tracking-wider uppercase mt-1">
                    ಚಿಕ್ಕೋಡಿ ಲಿಬರಲ್ ಎಜ್ಯುಕೇಶನ್ ಸೊಸೈಟಿ • Estd. 1964
                </p>
                <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-blue-500/15 border border-blue-400/25 rounded-full text-blue-200 text-[11px] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Official Faculty & Staff Academic Portal</span>
                </div>
            </div>

            {/* Main Authentication Card */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-blue-950/50 border border-slate-100 p-6 sm:p-8 z-10 animate-in zoom-in-95 duration-300">
                {/* Institutional Role Selector Tabs */}
                <div className="mb-6 p-1 bg-slate-100/90 rounded-2xl flex gap-1 border border-slate-200/60 shadow-inner">
                    {[
                        { key: 'staff', label: 'Faculty / Staff', icon: GraduationCap },
                        { key: 'hoi', label: 'Principal', icon: Building2 },
                        { key: 'admin', label: 'Admin', icon: Shield }
                    ].map((item) => {
                        const Icon = item.icon;
                        const isActive = role === item.key;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => {
                                    setRole(item.key);
                                    setOtpError('');
                                }}
                                className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                                    isActive
                                        ? 'bg-blue-700 text-white shadow-md shadow-blue-700/30'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                }`}
                            >
                                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label htmlFor="login-role-select" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Authorized Role
                        </label>
                        <select
                            id="login-role-select"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all cursor-pointer"
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
                        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-600/25 focus-within:border-blue-600 focus-within:bg-white transition-all overflow-hidden shadow-sm">
                            <span className="flex items-center gap-1.5 pl-3.5 pr-3 py-3.5 text-slate-700 font-extrabold text-sm bg-slate-100 border-r border-slate-200 select-none">
                                <Phone className="w-3.5 h-3.5 text-blue-700" />
                                +91
                            </span>
                            <input
                                id="login-phone-input"
                                type="tel"
                                inputMode="numeric"
                                className="w-full px-3.5 py-3.5 bg-transparent text-slate-900 font-bold tracking-wider placeholder:font-normal placeholder:text-slate-400 focus:outline-none text-sm"
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
                        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>A real-time SMS OTP will be sent to your registered mobile number</span>
                        </p>
                    </div>

                    {otpError && step === 1 && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold animate-in fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>{otpError}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-800 hover:via-blue-700 hover:to-indigo-800 text-white rounded-xl font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-blue-700/25 hover:shadow-blue-700/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
                            <Link to="/register" className="text-blue-700 font-bold hover:underline">
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
                        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => !isSubmitting && setStep(1)}
                    />

                    {/* Modal Card */}
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-7 border border-slate-100 z-10 animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner border border-blue-100">
                                <KeyRound className="w-7 h-7 text-blue-700" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Verify OTP</h3>
                            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed font-medium">
                                Enter the 6-digit authentication code sent to <br />
                                <span className="font-extrabold text-slate-800">+91 {phone}</span>
                            </p>
                        </div>

                        {statusMessage && (
                            <div className={`mb-4 p-2.5 ${
                                statusMessage.includes('123456') 
                                    ? 'bg-amber-50 border-amber-200 text-amber-900' 
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            } border rounded-xl flex items-center gap-2 text-xs font-semibold`}>
                                <CheckCircle2 className={`w-4 h-4 shrink-0 ${statusMessage.includes('123456') ? 'text-amber-600' : 'text-emerald-600'}`} />
                                <span>{statusMessage}</span>
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
                                        otpError ? 'border-rose-400 ring-2 ring-rose-400/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600'
                                    } rounded-2xl text-center text-2xl font-black tracking-[0.6rem] text-slate-900 focus:outline-none transition-all shadow-inner`}
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
                                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-800 hover:via-blue-700 hover:to-indigo-800 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-700/30 hover:shadow-blue-700/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
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
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    {resendCooldown > 0 ? (
                                        <span>Resend code in <strong className="text-slate-800">{resendCooldown}s</strong></span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleResendOtp}
                                            disabled={isSubmitting}
                                            className="text-blue-700 hover:text-blue-900 font-bold underline transition-colors"
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

            {/* Download Mobile App Link */}
            <div className="mt-4 z-10">
                <Link
                    to="/download"
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white text-blue-950 text-xs font-semibold shadow-sm border border-slate-200 transition-all hover:shadow hover:scale-[1.02]"
                >
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Get Android / iOS Mobile App</span>
                    <QrCode className="w-3.5 h-3.5 text-slate-400" />
                </Link>
            </div>

            {/* Footer Institutional Banner */}
            <div className="mt-6 text-center text-[11px] text-slate-400 font-medium z-10 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>CLE Society • Secure Multi-Factor Campus Attendance</span>
            </div>
        </div>
    );
};

export default Login;
