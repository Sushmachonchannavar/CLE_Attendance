import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import AttendancePanel from '../components/AttendancePanel';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { 
    User, 
    Phone, 
    Shield, 
    Landmark, 
    BookOpen, 
    Briefcase,
    CheckCircle2, 
    Edit3, 
    Save, 
    X, 
    Loader2, 
    Lock,
    Check,
    Laptop,
    Smartphone,
    Tablet,
    Trash2,
    RefreshCw,
    Globe,
    Clock,
    ShieldCheck
} from 'lucide-react';

const Profile = () => {
    const { user, updateUser, getSessions, revokeSession, revokeOtherSessions } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        college: '',
        department: '',
        designation: ''
    });
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Trusted Devices & Active Sessions State
    const [sessions, setSessions] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [sessionFeedback, setSessionFeedback] = useState(null);
    const [revokingId, setRevokingId] = useState(null);

    const loadSessions = async () => {
        if (!getSessions) return;
        setLoadingSessions(true);
        try {
            const list = await getSessions();
            setSessions(Array.isArray(list) ? list : []);
        } catch (err) {
            console.error('Failed to load sessions:', err);
        } finally {
            setLoadingSessions(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, []);

    const handleRevokeSession = async (sessionId) => {
        if (!sessionId) return;
        setRevokingId(sessionId);
        setSessionFeedback(null);
        try {
            await revokeSession(sessionId);
            setSessionFeedback({ type: 'success', text: 'Device session revoked successfully.' });
            await loadSessions();
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Failed to revoke device session.';
            setSessionFeedback({ type: 'error', text: msg });
        } finally {
            setRevokingId(null);
            setTimeout(() => setSessionFeedback(null), 5000);
        }
    };

    const handleRevokeOtherSessions = async () => {
        const otherCount = sessions.filter(s => !s.isCurrent).length;
        if (otherCount === 0) return;
        if (!window.confirm(`Are you sure you want to log out from all other ${otherCount} device(s)?`)) {
            return;
        }

        setRevokingId('all');
        setSessionFeedback(null);
        try {
            await revokeOtherSessions();
            setSessionFeedback({ type: 'success', text: 'Logged out of all other devices successfully.' });
            await loadSessions();
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Failed to log out of other devices.';
            setSessionFeedback({ type: 'error', text: msg });
        } finally {
            setRevokingId(null);
            setTimeout(() => setSessionFeedback(null), 5000);
        }
    };

    const formatSessionTime = (isoString) => {
        if (!isoString) return 'Active now';
        try {
            const normalized = isoString.includes('T') ? isoString : isoString.replace(' ', 'T');
            const d = new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z');
            if (isNaN(d.getTime())) return isoString;
            return d.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return isoString;
        }
    };

    // Ref tracks real-time editing state across asynchronous promises and effects
    const isEditingRef = useRef(false);

    // Keep ref in sync with state
    useEffect(() => {
        isEditingRef.current = isEditing;
    }, [isEditing]);

    // Fetch freshest user profile directly from SQLite on mount without overwriting active edits
    useEffect(() => {
        let isMounted = true;
        api.get('/auth/verify-token').then(res => {
            if (isMounted && res.data?.user) {
                if (updateUser) {
                    updateUser(res.data.user, res.data.token);
                }
                // Only populate form data if user is not actively typing in the form
                if (!isEditingRef.current) {
                    setFormData({
                        name: res.data.user.name || '',
                        college: res.data.user.college || '',
                        department: res.data.user.department || '',
                        designation: res.data.user.designation || ''
                    });
                }
            }
        }).catch(err => {
            console.warn('[PROFILE] Could not refresh profile from database:', err.message);
        });
        return () => { isMounted = false; };
    }, []);

    // Sync form data with user state only when not actively editing
    useEffect(() => {
        if (user && !isEditingRef.current) {
            setFormData({
                name: user.name || '',
                college: user.college || '',
                department: user.department || '',
                designation: user.designation || ''
            });
        }
    }, [user]);

    const roleTitle = user?.role === 'hoi' 
        ? 'Principal / Head of Institution' 
        : user?.role === 'admin' 
            ? 'System Administrator' 
            : 'Faculty / Academic Staff';

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errorMsg) setErrorMsg('');
    };

    const handleStartEdit = () => {
        isEditingRef.current = true;
        setFormData({
            name: user?.name || '',
            college: user?.college || '',
            department: user?.department || '',
            designation: user?.designation || ''
        });
        setErrorMsg('');
        setSuccessMsg('');
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        isEditingRef.current = false;
        setFormData({
            name: user?.name || '',
            college: user?.college || '',
            department: user?.department || '',
            designation: user?.designation || ''
        });
        setErrorMsg('');
        setIsEditing(false);
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        const trimmedName = formData.name ? formData.name.trim() : '';
        if (!trimmedName) {
            setErrorMsg('Official Full Name is required.');
            return;
        }

        setIsSaving(true);
        setErrorMsg('');
        try {
            const res = await api.put('/auth/profile', {
                name: trimmedName,
                college: formData.college ? formData.college.trim() : '',
                department: formData.department ? formData.department.trim() : '',
                designation: formData.designation ? formData.designation.trim() : ''
            });

            if (res.data?.token) {
                localStorage.setItem('token', res.data.token);
            }

            if (res.data?.user) {
                if (updateUser) {
                    updateUser(res.data.user, res.data.token);
                }
                setFormData({
                    name: res.data.user.name || '',
                    college: res.data.user.college || '',
                    department: res.data.user.department || '',
                    designation: res.data.user.designation || ''
                });
            }

            setSuccessMsg('Profile updated successfully!');
            isEditingRef.current = false;
            setIsEditing(false);

            setTimeout(() => {
                setSuccessMsg('');
            }, 4000);
        } catch (err) {
            console.error('Failed to update profile:', err);
            const msg = err.response?.data?.error || err.message || 'Failed to update profile. Please try again.';
            setErrorMsg(msg);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Layout>
            {/* Header Banner */}
            <div className="mb-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white shadow-xl shadow-blue-950/20 border border-blue-700/30 relative overflow-hidden">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                                <User className="w-3.5 h-3.5" />
                                Account Settings
                            </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">User Profile & Geofence Desk</h2>
                        <p className="text-blue-200/90 text-xs sm:text-sm mt-1">
                            Manage your institutional faculty credentials and perform daily punch verifications
                        </p>
                    </div>

                    {!isEditing && (
                        <button
                            type="button"
                            data-testid="header-edit-profile-btn"
                            onClick={handleStartEdit}
                            className="self-start sm:self-auto px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md rounded-2xl border border-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                        >
                            <Edit3 className="w-4 h-4 text-amber-300" />
                            <span>Edit Profile</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Notification messages */}
            {successMsg && (
                <div 
                    data-testid="profile-success-alert"
                    className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-fadeIn shadow-sm"
                >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span>{successMsg}</span>
                </div>
            )}

            {errorMsg && (
                <div 
                    data-testid="profile-error-alert"
                    className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold animate-fadeIn shadow-sm"
                >
                    <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                        <X className="w-3.5 h-3.5 text-rose-600" />
                    </div>
                    <span>{errorMsg}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Information Card */}
                <div className="lg:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white font-extrabold text-xl flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0">
                                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-slate-900 leading-snug truncate">
                                        {user?.name || 'Authorized Personnel'}
                                    </h3>
                                    <span className="inline-block mt-0.5 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 rounded-full truncate max-w-full">
                                        {roleTitle}
                                    </span>
                                </div>
                            </div>

                            {!isEditing ? (
                                <button
                                    type="button"
                                    data-testid="edit-profile-btn"
                                    onClick={handleStartEdit}
                                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 active:scale-95 rounded-xl border border-slate-200/70 transition-all cursor-pointer shrink-0"
                                    title="Edit Profile"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    data-testid="cancel-edit-icon-btn"
                                    onClick={handleCancelEdit}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 rounded-xl border border-slate-200/70 transition-all cursor-pointer shrink-0"
                                    title="Cancel Editing"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {!isEditing ? (
                            /* READ-ONLY VIEW */
                            <div className="space-y-3.5">
                                {/* Full Name */}
                                <div 
                                    onClick={handleStartEdit}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleStartEdit()}
                                    title="Click to edit Official Full Name"
                                    className="p-3.5 bg-slate-50/80 hover:bg-blue-50/60 hover:border-blue-300 rounded-2xl border border-slate-200/70 flex items-start justify-between gap-3 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <User className="w-4 h-4 text-slate-400 group-hover:text-blue-600 mt-0.5 shrink-0 transition-colors" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Official Full Name</p>
                                            <p data-testid="display-profile-name" className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                                                {user?.name || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="p-1 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0">
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </span>
                                </div>

                                {/* Mobile Number */}
                                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/70 flex items-start gap-3">
                                    <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Contact</p>
                                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                                                <Lock className="w-2.5 h-2.5" /> OTP Verified
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 mt-0.5">+91 {user?.phone || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Access Role */}
                                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/70 flex items-start gap-3">
                                    <Shield className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Role Level</p>
                                        <p className="text-xs font-bold text-slate-800 mt-0.5 capitalize">{user?.role || 'Staff'}</p>
                                    </div>
                                </div>

                                {/* Official Designation */}
                                <div 
                                    onClick={handleStartEdit}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleStartEdit()}
                                    title="Click to edit Official Designation"
                                    className="p-3.5 bg-slate-50/80 hover:bg-blue-50/60 hover:border-blue-300 rounded-2xl border border-slate-200/70 flex items-start justify-between gap-3 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <Briefcase className="w-4 h-4 text-slate-400 group-hover:text-blue-600 mt-0.5 shrink-0 transition-colors" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Official Designation</p>
                                            <p data-testid="display-profile-designation" className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                                                {user?.designation || 'Faculty Member'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="p-1 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0">
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </span>
                                </div>

                                {/* College / Institution */}
                                <div 
                                    onClick={handleStartEdit}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleStartEdit()}
                                    title="Click to edit Institutional College"
                                    className="p-3.5 bg-slate-50/80 hover:bg-blue-50/60 hover:border-blue-300 rounded-2xl border border-slate-200/70 flex items-start justify-between gap-3 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <Landmark className="w-4 h-4 text-slate-400 group-hover:text-blue-600 mt-0.5 shrink-0 transition-colors" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Institutional College</p>
                                            <p data-testid="display-profile-college" className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                                                {user?.college || 'CLE Society Campus'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="p-1 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0">
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </span>
                                </div>

                                {/* Department */}
                                <div 
                                    onClick={handleStartEdit}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleStartEdit()}
                                    title="Click to edit Academic Department"
                                    className="p-3.5 bg-slate-50/80 hover:bg-blue-50/60 hover:border-blue-300 rounded-2xl border border-slate-200/70 flex items-start justify-between gap-3 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-blue-600 mt-0.5 shrink-0 transition-colors" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Department</p>
                                            <p data-testid="display-profile-department" className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                                                {user?.department || 'Academic Department'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="p-1 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0">
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </span>
                                </div>
                            </div>
                        ) : (
                            /* EDIT MODE FORM */
                            <form onSubmit={handleSaveProfile} className="space-y-4">
                                <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center justify-between">
                                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                        Edit Profile Information
                                    </span>
                                    <span className="text-[10px] text-blue-600 font-semibold">Active Edit</span>
                                </div>

                                {/* Full Name Input */}
                                <div className="space-y-1">
                                    <label htmlFor="profile-name-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                                        Official Full Name <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            id="profile-name-input"
                                            name="name"
                                            data-testid="profile-name-input"
                                            value={formData.name || ''}
                                            onChange={handleInputChange}
                                            placeholder="Enter your full name (e.g. Dr. Principal Name)"
                                            autoFocus
                                            autoComplete="name"
                                            required
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none transition"
                                        />
                                    </div>
                                </div>

                                {/* Official Designation Input */}
                                <div className="space-y-1">
                                    <label htmlFor="profile-designation-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                                        Official Designation
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            id="profile-designation-input"
                                            name="designation"
                                            data-testid="profile-designation-input"
                                            value={formData.designation || ''}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Principal / Professor / Lecturer"
                                            autoComplete="organization-title"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none transition"
                                        />
                                    </div>
                                </div>

                                {/* College / Institution Input */}
                                <div className="space-y-1">
                                    <label htmlFor="profile-college-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                                        Institutional College
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            id="profile-college-input"
                                            name="college"
                                            data-testid="profile-college-input"
                                            value={formData.college || ''}
                                            onChange={handleInputChange}
                                            placeholder="e.g. CLE Society Degree College"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none transition"
                                        />
                                    </div>
                                </div>

                                {/* Department Input */}
                                <div className="space-y-1">
                                    <label htmlFor="profile-department-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                                        Academic Department
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            id="profile-department-input"
                                            name="department"
                                            data-testid="profile-department-input"
                                            value={formData.department || ''}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Executive Administration / Physics"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none transition"
                                        />
                                    </div>
                                </div>

                                {/* Read-Only Note for Phone and Role */}
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-600">Registered Contact:</span>
                                        <span className="font-bold text-slate-800">+91 {user?.phone}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-600">Role:</span>
                                        <span className="font-bold text-slate-800 uppercase">{user?.role}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-200/60">
                                        Phone number and role permissions are managed by institutional administrative control.
                                    </p>
                                </div>

                                {/* Inline Error Display */}
                                {errorMsg && (
                                    <div 
                                        data-testid="profile-form-error-alert"
                                        className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold animate-fadeIn"
                                    >
                                        <X className="w-4 h-4 shrink-0 text-rose-600" />
                                        <span>{errorMsg}</span>
                                    </div>
                                )}

                                {/* Form Actions */}
                                <div className="flex items-center gap-2 pt-2">
                                    <button
                                        type="submit"
                                        data-testid="save-profile-btn"
                                        disabled={isSaving}
                                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                <span>Save Changes</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        data-testid="cancel-profile-btn"
                                        disabled={isSaving}
                                        onClick={handleCancelEdit}
                                        className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span>CLE Society Multi-Campus Auth</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                </div>

                {/* Attendance Geofence Panel */}
                <div className="lg:col-span-2">
                    <AttendancePanel />
                </div>
            </div>

            {/* Trusted Devices & Active Sessions Section */}
            <div className="mt-8 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                Trusted Devices & Active Sessions
                                {sessions.length > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700">
                                        {sessions.length}
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Cross-device session authorization. Devices stay authenticated with secure refresh token rotation until revoked or logged out.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={loadSessions}
                            disabled={loadingSessions}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 active:scale-95 rounded-xl border border-slate-200/70 transition cursor-pointer"
                            title="Refresh sessions list"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingSessions ? 'animate-spin text-blue-600' : ''}`} />
                        </button>

                        {sessions.filter(s => !s.isCurrent).length > 0 && (
                            <button
                                type="button"
                                onClick={handleRevokeOtherSessions}
                                disabled={revokingId === 'all'}
                                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {revokingId === 'all' ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Logging out others...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Log Out All Other Devices</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Feedback Banner */}
                {sessionFeedback && (
                    <div
                        className={`mt-4 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-fadeIn ${
                            sessionFeedback.type === 'success'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                                : 'bg-rose-50 border border-rose-200 text-rose-800'
                        }`}
                    >
                        {sessionFeedback.type === 'success' ? (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                            <X className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{sessionFeedback.text}</span>
                    </div>
                )}

                {/* Devices List */}
                <div className="mt-5 space-y-3">
                    {loadingSessions && sessions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            <span>Loading registered device sessions...</span>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            No active sessions found.
                        </div>
                    ) : (
                        sessions.map((sess) => {
                            const isCurrent = sess.isCurrent;
                            const isMobile = sess.deviceType === 'mobile';
                            const isTablet = sess.deviceType === 'tablet';

                            return (
                                <div
                                    key={sess.id}
                                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                        isCurrent
                                            ? 'bg-blue-50/40 border-blue-200/80 shadow-xs'
                                            : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/80'
                                    }`}
                                >
                                    <div className="flex items-start gap-3.5 min-w-0">
                                        <div
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                isCurrent
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                    : 'bg-slate-200/80 text-slate-600'
                                            }`}
                                        >
                                            {isMobile ? (
                                                <Smartphone className="w-5 h-5" />
                                            ) : isTablet ? (
                                                <Tablet className="w-5 h-5" />
                                            ) : (
                                                <Laptop className="w-5 h-5" />
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                                    {sess.deviceName || 'Authorized Device'}
                                                </h4>
                                                {isCurrent && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        This Device (Current Session)
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                                                <span className="capitalize font-semibold text-slate-600">
                                                    {sess.platform || 'Web'} • {sess.browser || 'Browser'}
                                                </span>
                                                {sess.ipAddress && sess.ipAddress !== '—' && (
                                                    <span className="flex items-center gap-1 text-slate-400">
                                                        <Globe className="w-3 h-3" />
                                                        {sess.ipAddress}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <Clock className="w-3 h-3" />
                                                    Active: {formatSessionTime(sess.lastActiveAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 self-end sm:self-auto shrink-0">
                                        {isCurrent ? (
                                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                                Active Now
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleRevokeSession(sess.id)}
                                                disabled={revokingId === sess.id}
                                                className="px-3 py-1.5 bg-white hover:bg-rose-50 active:scale-95 text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                                            >
                                                {revokingId === sess.id ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        <span>Revoking...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Trash2 className="w-3 h-3 text-rose-500" />
                                                        <span>Revoke Access</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default Profile;
