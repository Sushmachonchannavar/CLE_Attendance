import React, { useState, useEffect } from 'react';
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
    CheckCircle2, 
    Edit3, 
    Save, 
    X, 
    Loader2, 
    Lock,
    Check
} from 'lucide-react';

const Profile = () => {
    const { user, updateUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        college: '',
        department: ''
    });
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                college: user.college || '',
                department: user.department || ''
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
        setFormData({
            name: user?.name || '',
            college: user?.college || '',
            department: user?.department || ''
        });
        setErrorMsg('');
        setSuccessMsg('');
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setFormData({
            name: user?.name || '',
            college: user?.college || '',
            department: user?.department || ''
        });
        setErrorMsg('');
        setIsEditing(false);
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setErrorMsg('Official Full Name is required.');
            return;
        }

        setIsSaving(true);
        setErrorMsg('');
        try {
            const res = await api.put('/auth/profile', {
                name: formData.name.trim(),
                college: formData.college.trim(),
                department: formData.department.trim()
            });

            if (res.data?.user && updateUser) {
                updateUser(res.data.user);
            }

            setSuccessMsg('Profile updated successfully!');
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
                                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/70 flex items-start gap-3">
                                    <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Official Full Name</p>
                                        <p data-testid="display-profile-name" className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                                            {user?.name || 'N/A'}
                                        </p>
                                    </div>
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

                                {/* College / Institution */}
                                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/70 flex items-start gap-3">
                                    <Landmark className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Institutional College</p>
                                        <p data-testid="display-profile-college" className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                                            {user?.college || 'CLE Society Campus'}
                                        </p>
                                    </div>
                                </div>

                                {/* Department */}
                                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/70 flex items-start gap-3">
                                    <BookOpen className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</p>
                                        <p data-testid="display-profile-department" className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                                            {user?.department || 'Academic Department'}
                                        </p>
                                    </div>
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
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                                        Official Full Name <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="name"
                                            data-testid="profile-name-input"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="Enter your full name"
                                            required
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none transition"
                                        />
                                    </div>
                                </div>

                                {/* College / Institution Input */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                                        Institutional College
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="college"
                                            data-testid="profile-college-input"
                                            value={formData.college}
                                            onChange={handleInputChange}
                                            placeholder="e.g. CLE Society Degree College"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none transition"
                                        />
                                    </div>
                                </div>

                                {/* Department Input */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                                        Academic Department
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="department"
                                            data-testid="profile-department-input"
                                            value={formData.department}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Computer Science & Engineering"
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
        </Layout>
    );
};

export default Profile;
