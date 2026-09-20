import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CleLogo from '../components/CleLogo';
import { User, Phone, Landmark, BookOpen, ArrowRight, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

const Register = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        collegeName: '',
        departmentName: '',
        mobile: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const { register } = useAuth();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setError('');
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const cleanMobile = formData.mobile.replace(/\D/g, '');
        if (cleanMobile.length < 10) {
            setError('Please enter a valid 10-digit mobile number.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const result = await register({
                ...formData,
                mobile: cleanMobile
            });
            if (result.success) {
                alert(result.message || 'Registration successful! Redirecting to login.');
                navigate('/login');
            } else {
                setError(result.error || 'Registration failed. Please try again.');
                alert(`Error: ${result.error || 'Registration failed.'}`);
            }
        } catch (err) {
            console.error('Registration failed', err);
            setError('Unable to submit registration. Please check your network.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0c1938] to-[#081026] flex flex-col justify-center items-center px-4 py-10 font-sans relative overflow-hidden">
            {/* Ambient Lighting Orbs */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header Branding */}
            <div className="mb-6 text-center z-10 animate-in fade-in duration-300">
                <CleLogo size="lg" variant="light" className="justify-center mb-2" />
                <h1 className="text-white text-lg font-bold sm:text-xl drop-shadow-sm">
                    Staff Member Registration
                </h1>
                <p className="text-blue-200/80 text-xs mt-1 font-medium">
                    Register faculty or staff credentials for campus attendance
                </p>
            </div>

            {/* Registration Card */}
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 z-10 animate-in zoom-in-95 duration-300">
                <form onSubmit={handleRegister} className="space-y-4">
                    {/* First & Last Name Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="firstName" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                First Name
                            </label>
                            <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white transition-all">
                                <span className="pl-3.5 pr-2 text-slate-400">
                                    <User className="w-4 h-4" />
                                </span>
                                <input
                                    id="firstName"
                                    type="text"
                                    name="firstName"
                                    className="w-full pr-3 py-3 bg-transparent text-slate-800 text-sm font-medium focus:outline-none placeholder:text-slate-400"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    placeholder="Enter first name"
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="lastName" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Last Name
                            </label>
                            <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white transition-all">
                                <span className="pl-3.5 pr-2 text-slate-400">
                                    <User className="w-4 h-4" />
                                </span>
                                <input
                                    id="lastName"
                                    type="text"
                                    name="lastName"
                                    className="w-full pr-3 py-3 bg-transparent text-slate-800 text-sm font-medium focus:outline-none placeholder:text-slate-400"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    placeholder="Enter last name"
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                    </div>

                    {/* College Name */}
                    <div>
                        <label htmlFor="collegeName" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                            College / Institution Name
                        </label>
                        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white transition-all">
                            <span className="pl-3.5 pr-2 text-slate-400">
                                <Landmark className="w-4 h-4" />
                            </span>
                            <input
                                id="collegeName"
                                type="text"
                                name="collegeName"
                                className="w-full pr-3 py-3 bg-transparent text-slate-800 text-sm font-medium focus:outline-none placeholder:text-slate-400"
                                value={formData.collegeName}
                                onChange={handleChange}
                                placeholder="e.g. CLE Society Institute of Technology"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Department Name */}
                    <div>
                        <label htmlFor="departmentName" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Academic / Admin Department
                        </label>
                        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white transition-all">
                            <span className="pl-3.5 pr-2 text-slate-400">
                                <BookOpen className="w-4 h-4" />
                            </span>
                            <input
                                id="departmentName"
                                type="text"
                                name="departmentName"
                                className="w-full pr-3 py-3 bg-transparent text-slate-800 text-sm font-medium focus:outline-none placeholder:text-slate-400"
                                value={formData.departmentName}
                                onChange={handleChange}
                                placeholder="e.g. Computer Science & Engineering"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Mobile Number */}
                    <div>
                        <label htmlFor="mobile" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Official Mobile Number
                        </label>
                        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white transition-all overflow-hidden">
                            <span className="flex items-center gap-1.5 pl-3.5 pr-2.5 py-3 text-slate-500 font-bold text-sm bg-slate-100 border-r border-slate-200 select-none">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                +91
                            </span>
                            <input
                                id="mobile"
                                type="tel"
                                name="mobile"
                                className="w-full px-3 py-3 bg-transparent text-slate-900 font-bold tracking-wider placeholder:font-normal placeholder:text-slate-400 focus:outline-none text-sm"
                                value={formData.mobile}
                                onChange={(e) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        mobile: e.target.value.replace(/\D/g, '').slice(0, 10)
                                    }));
                                    setError('');
                                }}
                                placeholder="10-digit mobile number"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-semibold animate-in fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Submitting Profile...</span>
                            </>
                        ) : (
                            <>
                                <span>Complete Registration</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>

                    <div className="pt-4 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-500 font-medium">
                            Already registered?{' '}
                            <Link to="/login" className="text-blue-600 font-bold hover:underline">
                                Return to Login
                            </Link>
                        </p>
                    </div>
                </form>
            </div>

            <div className="mt-6 text-center text-[11px] text-slate-400 font-medium z-10 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>CLE Society Institutional Faculty Network</span>
            </div>
        </div>
    );
};

export default Register;
