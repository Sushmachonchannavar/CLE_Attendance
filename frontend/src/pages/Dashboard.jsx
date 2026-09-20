import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import AttendancePanel from '../components/AttendancePanel';
import api from '../utils/api';
import {
    Users,
    FileClock,
    ClipboardCheck,
    ClipboardX,
    ShieldAlert,
    ArrowRight,
    BookOpen,
    Clock,
    Calendar,
    CheckCircle2,
    CheckCircle,
    XCircle,
    FileText,
    Sparkles,
    X,
    Phone,
    UserCog
} from 'lucide-react';

const isAdminRole = (role) => {
    if (!role) return false;
    const r = role.toString().toLowerCase();
    return r === 'admin' || r === 'hoi' || r === 'principal';
};

const Dashboard = () => {
    const { user } = useAuth();
    const [dailyReport, setDailyReport] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [ods, setOds] = useState([]);
    const [actionLoading, setActionLoading] = useState({});
    const [activeCardModal, setActiveCardModal] = useState(null);
    const [activeStaffFilter, setActiveStaffFilter] = useState('all');

    const loadDashboardData = React.useCallback(async () => {
        if (!user || !isAdminRole(user.role)) return;
        try {
            const [r1, r2, r3] = await Promise.allSettled([
                api.get('/reports/daily'),
                api.get('/requests/leaves/all'),
                api.get('/requests/od/all')
            ]);
            if (r1.status === 'fulfilled') setDailyReport(r1.value.data.report || []);
            if (r2.status === 'fulfilled') setLeaves(r2.value.data || []);
            if (r3.status === 'fulfilled') setOds(r3.value.data || []);
        } catch (err) {
            console.error('Failed to fetch admin dashboard data', err);
        }
    }, [user]);

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 10000);
        return () => clearInterval(interval);
    }, [loadDashboardData]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setActiveCardModal(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleUpdateLeaveStatus = async (id, newStatus) => {
        setActionLoading(prev => ({ ...prev, [`leave-${id}`]: true }));
        try {
            await api.put(`/requests/leaves/${id}`, { status: newStatus });
            setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
            await loadDashboardData();
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Failed to update leave status';
            alert(`Error: ${msg}`);
            console.error('Failed to update leave status', err);
        } finally {
            setActionLoading(prev => ({ ...prev, [`leave-${id}`]: false }));
        }
    };

    const handleUpdateODStatus = async (id, newStatus) => {
        setActionLoading(prev => ({ ...prev, [`od-${id}`]: true }));
        try {
            await api.put(`/requests/od/${id}`, { status: newStatus });
            setOds(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
            await loadDashboardData();
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Failed to update OD status';
            alert(`Error: ${msg}`);
            console.error('Failed to update OD status', err);
        } finally {
            setActionLoading(prev => ({ ...prev, [`od-${id}`]: false }));
        }
    };

    const getStatusBadge = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved':
                return { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'rejected':
                return { label: 'Rejected', className: 'bg-rose-50 text-rose-700 border-rose-200' };
            default:
                return { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' };
        }
    };

    const handleCardClick = (cardType) => {
        if (cardType === 'total_staff') {
            setActiveStaffFilter('all');
            setActiveCardModal('total_staff');
        } else if (cardType === 'present_today') {
            setActiveStaffFilter('present');
            setActiveCardModal('present_today');
        } else if (cardType === 'absent_today') {
            setActiveStaffFilter('absent');
            setActiveCardModal('absent_today');
        } else if (cardType === 'pending_leaves') {
            setActiveCardModal('pending_leaves');
        } else if (cardType === 'pending_ods') {
            setActiveCardModal('pending_ods');
        }
    };

    // Admin role calculations
    const totalStaffAdmin = dailyReport.length;
    const pendingLeavesAdmin = leaves.filter(l => !l.status || l.status.toLowerCase() === 'pending').length;
    const pendingODsAdmin = ods.filter(o => !o.status || o.status.toLowerCase() === 'pending').length;
    const approvedRequestsAdmin = leaves.filter(l => l.status?.toLowerCase() === 'approved').length +
                             ods.filter(o => o.status?.toLowerCase() === 'approved').length;
    const rejectedRequestsAdmin = leaves.filter(l => l.status?.toLowerCase() === 'rejected').length +
                             ods.filter(o => o.status?.toLowerCase() === 'rejected').length;

    // Principal (hoi) role calculations - STAFF statistics only
    const staffReport = dailyReport.filter(u => u.role?.toLowerCase() === 'staff');
    const totalStaffPrincipal = staffReport.length;
    const presentStaffPrincipal = staffReport.filter(u => u.status === 'present' || u.status === 'late').length;
    const absentStaffPrincipal = staffReport.filter(u => u.status === 'absent').length;
    const leaveStaffPrincipal = staffReport.filter(u => u.status === 'leave').length;
    const odStaffPrincipal = staffReport.filter(u => u.status === 'od').length;

    const pendingLeavesPrincipal = leaves.filter(l => l.role?.toUpperCase() === 'STAFF' && (!l.status || l.status.toLowerCase() === 'pending')).length;
    const pendingODsPrincipal = ods.filter(o => o.role?.toUpperCase() === 'STAFF' && (!o.status || o.status.toLowerCase() === 'pending')).length;

    const displayedStaffReport = staffReport.filter(staff => {
        if (activeStaffFilter === 'present') return staff.status === 'present' || staff.status === 'late';
        if (activeStaffFilter === 'absent') return staff.status === 'absent';
        return true;
    });

    // Formatted current date
    const todayFormatted = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const roleName = user?.role === 'hoi' ? 'Principal' : user?.role === 'admin' ? 'Administrator' : 'Faculty Member';

    return (
        <Layout>
            {/* Top Welcome Card */}
            <div className="mb-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white shadow-xl shadow-blue-950/20 border border-blue-700/30 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                <Sparkles className="w-3.5 h-3.5" />
                                {roleName} Portal
                            </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                            Welcome back, {user?.name || 'Authorized User'}
                        </h2>
                        <p className="text-blue-200 text-xs sm:text-sm mt-1 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-blue-300" />
                            {todayFormatted} • CLE Society Campus
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/profile"
                            data-testid="dashboard-edit-profile-btn"
                            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md rounded-2xl border border-white/15 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                            title="Edit Profile"
                        >
                            <UserCog className="w-4 h-4 text-amber-300" />
                            <span>Edit Profile</span>
                        </Link>
                        <div className="px-4 py-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-right">
                            <span className="block text-[10px] text-blue-200 uppercase tracking-widest font-semibold">Active Session</span>
                            <span className="text-xs font-bold text-white flex items-center justify-end gap-1.5 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                Live GPS Connected
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Heading (Must be visible for automated test expectations) */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">Dashboard</h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Overview of real-time attendance and administrative activity</p>
                </div>
            </div>

            {user?.role === 'hoi' ? (
                /* ----------------- PRINCIPAL DASHBOARD ----------------- */
                <div className="space-y-8">
                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Total Staff */}
                        <div
                            role="button"
                            tabIndex={0}
                            data-testid="card-total-staff"
                            onClick={() => handleCardClick('total_staff')}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('total_staff')}
                            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 hover:shadow-md hover:border-blue-400 active:scale-[0.99] transition-all cursor-pointer"
                        >
                            <div className="p-3.5 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800">{totalStaffPrincipal}</h4>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Total Staff</div>
                            </div>
                        </div>

                        {/* Today's Present Staff */}
                        <div
                            role="button"
                            tabIndex={0}
                            data-testid="card-present-today"
                            onClick={() => handleCardClick('present_today')}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('present_today')}
                            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 hover:shadow-md hover:border-emerald-400 active:scale-[0.99] transition-all cursor-pointer"
                        >
                            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                                <ClipboardCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800">{presentStaffPrincipal}</h4>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Present Today</div>
                            </div>
                        </div>

                        {/* Today's Absent Staff */}
                        <div
                            role="button"
                            tabIndex={0}
                            data-testid="card-absent-today"
                            onClick={() => handleCardClick('absent_today')}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('absent_today')}
                            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 hover:shadow-md hover:border-rose-400 active:scale-[0.99] transition-all cursor-pointer"
                        >
                            <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
                                <ClipboardX className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800">{absentStaffPrincipal}</h4>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Absent Today</div>
                            </div>
                        </div>

                        {/* Pending Leave Requests */}
                        <div
                            role="button"
                            tabIndex={0}
                            data-testid="card-pending-leaves"
                            onClick={() => handleCardClick('pending_leaves')}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('pending_leaves')}
                            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 hover:shadow-md hover:border-amber-400 active:scale-[0.99] transition-all cursor-pointer"
                        >
                            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                                <FileClock className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800">{pendingLeavesPrincipal}</h4>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Pending Leaves</div>
                            </div>
                        </div>

                        {/* Pending OD Requests */}
                        <div
                            role="button"
                            tabIndex={0}
                            data-testid="card-pending-ods"
                            onClick={() => handleCardClick('pending_ods')}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('pending_ods')}
                            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 hover:shadow-md hover:border-indigo-400 active:scale-[0.99] transition-all cursor-pointer"
                        >
                            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800">{pendingODsPrincipal}</h4>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Pending ODs</div>
                            </div>
                        </div>
                    </div>

                    {/* Attendance Summary Breakdown & Today's Attendance Table */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Attendance Summary Panel */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 lg:col-span-1">
                            <h4 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                                <Clock className="text-blue-600 w-5 h-5" />
                                Attendance Distribution
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1.5">
                                        <span className="text-slate-600">Present (On Time / Late)</span>
                                        <span className="text-emerald-600">{presentStaffPrincipal} / {totalStaffPrincipal}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                                            style={{ width: `${totalStaffPrincipal > 0 ? (presentStaffPrincipal / totalStaffPrincipal) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1.5">
                                        <span className="text-slate-600">Absent</span>
                                        <span className="text-rose-600">{absentStaffPrincipal} / {totalStaffPrincipal}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-rose-500 h-2.5 rounded-full transition-all duration-500"
                                            style={{ width: `${totalStaffPrincipal > 0 ? (absentStaffPrincipal / totalStaffPrincipal) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1.5">
                                        <span className="text-slate-600">Approved Leave</span>
                                        <span className="text-amber-600">{leaveStaffPrincipal} / {totalStaffPrincipal}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                                            style={{ width: `${totalStaffPrincipal > 0 ? (leaveStaffPrincipal / totalStaffPrincipal) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1.5">
                                        <span className="text-slate-600">On Duty (OD)</span>
                                        <span className="text-blue-600">{odStaffPrincipal} / {totalStaffPrincipal}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                                            style={{ width: `${totalStaffPrincipal > 0 ? (odStaffPrincipal / totalStaffPrincipal) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Today's Staff Status Table */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 lg:col-span-2 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        <BookOpen className="text-blue-600 w-5 h-5" />
                                        Today's Staff Status
                                        {activeStaffFilter !== 'all' && (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                Filtered: {activeStaffFilter === 'present' ? 'Present Only' : 'Absent Only'}
                                            </span>
                                        )}
                                    </h4>
                                    {activeStaffFilter !== 'all' && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveStaffFilter('all')}
                                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                                        >
                                            Show All ({totalStaffPrincipal})
                                        </button>
                                    )}
                                </div>
                                <div className="overflow-x-auto max-h-72 custom-scrollbar">
                                    <table className="min-w-full leading-normal border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-xl">Name</th>
                                                <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Department</th>
                                                <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Status</th>
                                                <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-r-xl">Punch In</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {displayedStaffReport.map((staff, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{staff.name}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-500">{staff.department}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${
                                                            staff.status === 'present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                            staff.status === 'late' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                            staff.status === 'leave' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                            staff.status === 'od' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {staff.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-600 font-medium">{staff.punch_in || '—'}</td>
                                                </tr>
                                            ))}
                                            {displayedStaffReport.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="px-4 py-10 text-center text-slate-400 italic">
                                                        {staffReport.length === 0 ? 'No staff users registered.' : 'No staff users matching filter.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Staff Leave Applications Approval Desk */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
                            <div>
                                <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <Calendar className="text-blue-600 w-5 h-5" />
                                    Staff Leave Applications
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">Review and authorize faculty & staff leave requests</p>
                            </div>
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full self-start sm:self-auto">
                                {leaves.filter(l => l.user_id !== user?.id && (!l.role || l.role.toUpperCase() === 'STAFF') && (!l.status || l.status.toLowerCase() === 'pending')).length} Pending Review
                            </span>
                        </div>

                        {leaves.filter(l => l.user_id !== user?.id && (!l.role || l.role.toUpperCase() === 'STAFF')).length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-500" />
                                <p className="text-xs font-semibold text-slate-600">No staff leave applications submitted.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="min-w-full leading-normal border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-xl">Staff Member</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Leave Type</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Dates</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Reason</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Status</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-right text-slate-500 uppercase bg-slate-50 rounded-r-xl">Decision</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {leaves.filter(l => l.user_id !== user?.id && (!l.role || l.role.toUpperCase() === 'STAFF')).map((leave) => {
                                            const badge = getStatusBadge(leave.status);
                                            const isActing = actionLoading[`leave-${leave.id}`];
                                            return (
                                                <tr key={leave.id} data-testid={`staff-leave-row-${leave.id}`} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                                        <div>{leave.name || 'Staff Member'}</div>
                                                        <div className="text-xs text-slate-400 font-normal">{leave.department || 'Academic'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-700 capitalize">
                                                        {leave.type}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                                                        <span>{leave.start_date}</span>
                                                        {leave.start_date !== leave.end_date && (
                                                            <span> → {leave.end_date}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={leave.reason}>
                                                        {leave.reason || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase border ${badge.className}`}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {leave.status !== 'approved' && (
                                                                <button
                                                                    type="button"
                                                                    data-testid={`approve-leave-${leave.id}`}
                                                                    disabled={isActing}
                                                                    onClick={() => handleUpdateLeaveStatus(leave.id, 'approved')}
                                                                    className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                                                                    title="Approve Leave"
                                                                >
                                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                                    Approve
                                                                </button>
                                                            )}
                                                            {leave.status !== 'rejected' && (
                                                                <button
                                                                    type="button"
                                                                    data-testid={`reject-leave-${leave.id}`}
                                                                    disabled={isActing}
                                                                    onClick={() => handleUpdateLeaveStatus(leave.id, 'rejected')}
                                                                    className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                                                                    title="Reject Leave"
                                                                >
                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                    Reject
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Staff OD Requests Approval Desk */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
                            <div>
                                <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <FileText className="text-blue-600 w-5 h-5" />
                                    Staff OD Requests
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">Review and authorize official duty submissions</p>
                            </div>
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full self-start sm:self-auto">
                                {ods.filter(o => o.user_id !== user?.id && (!o.role || o.role.toUpperCase() === 'STAFF') && (!o.status || o.status.toLowerCase() === 'pending')).length} Pending Review
                            </span>
                        </div>

                        {ods.filter(o => o.user_id !== user?.id && (!o.role || o.role.toUpperCase() === 'STAFF')).length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-500" />
                                <p className="text-xs font-semibold text-slate-600">No staff OD requests submitted.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="min-w-full leading-normal border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-xl">Staff Member</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Date</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Place</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Purpose</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Status</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-right text-slate-500 uppercase bg-slate-50 rounded-r-xl">Decision</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {ods.filter(o => o.user_id !== user?.id && (!o.role || o.role.toUpperCase() === 'STAFF')).map((od) => {
                                            const badge = getStatusBadge(od.status);
                                            const isActing = actionLoading[`od-${od.id}`];
                                            return (
                                                <tr key={od.id} data-testid={`staff-od-row-${od.id}`} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                                        <div>{od.name || 'Staff Member'}</div>
                                                        <div className="text-xs text-slate-400 font-normal">{od.department || 'Academic'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                                                        {od.date}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-700">
                                                        {od.place}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={od.purpose}>
                                                        {od.purpose || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase border ${badge.className}`}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {od.status !== 'approved' && (
                                                                <button
                                                                    type="button"
                                                                    data-testid={`approve-od-${od.id}`}
                                                                    disabled={isActing}
                                                                    onClick={() => handleUpdateODStatus(od.id, 'approved')}
                                                                    className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                                                                    title="Approve OD"
                                                                >
                                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                                    Approve
                                                                </button>
                                                            )}
                                                            {od.status !== 'rejected' && (
                                                                <button
                                                                    type="button"
                                                                    data-testid={`reject-od-${od.id}`}
                                                                    disabled={isActing}
                                                                    onClick={() => handleUpdateODStatus(od.id, 'rejected')}
                                                                    className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                                                                    title="Reject OD"
                                                                >
                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                    Reject
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Principal Dashboard Card Details Modal */}
                    {activeCardModal && (
                        <div
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6"
                            onClick={() => setActiveCardModal(null)}
                            data-testid="principal-details-modal"
                        >
                            <div
                                className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                                            {activeCardModal === 'total_staff' && <Users className="w-6 h-6" />}
                                            {activeCardModal === 'present_today' && <ClipboardCheck className="w-6 h-6 text-emerald-600" />}
                                            {activeCardModal === 'absent_today' && <ClipboardX className="w-6 h-6 text-rose-600" />}
                                            {activeCardModal === 'pending_leaves' && <FileClock className="w-6 h-6 text-amber-600" />}
                                            {activeCardModal === 'pending_ods' && <ShieldAlert className="w-6 h-6 text-indigo-600" />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg sm:text-xl font-black text-slate-800" data-testid="modal-title">
                                                {activeCardModal === 'total_staff' && 'Total Staff Members'}
                                                {activeCardModal === 'present_today' && "Today's Present Staff"}
                                                {activeCardModal === 'absent_today' && "Today's Absent Staff"}
                                                {activeCardModal === 'pending_leaves' && 'Pending Staff Leave Applications'}
                                                {activeCardModal === 'pending_ods' && 'Pending Staff OD Requests'}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {activeCardModal === 'total_staff' && `Full roster of ${totalStaffPrincipal} registered staff members`}
                                                {activeCardModal === 'present_today' && `${presentStaffPrincipal} staff members reported present today`}
                                                {activeCardModal === 'absent_today' && `${absentStaffPrincipal} staff members marked absent today`}
                                                {activeCardModal === 'pending_leaves' && `${pendingLeavesPrincipal} staff leave submissions awaiting your approval`}
                                                {activeCardModal === 'pending_ods' && `${pendingODsPrincipal} staff official duty submissions awaiting your authorization`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        data-testid="modal-close-btn"
                                        onClick={() => setActiveCardModal(null)}
                                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                        title="Close modal"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
                                    {/* 1. TOTAL STAFF TABLE */}
                                    {activeCardModal === 'total_staff' && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full leading-normal border-collapse" data-testid="modal-total-staff-table">
                                                <thead>
                                                    <tr>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-xl">Staff Member</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Contact</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Today's Status</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Punch In</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-right text-slate-500 uppercase bg-slate-50 rounded-r-xl">Punch Out</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {staffReport.map((staff, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                                            <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                                                <div>{staff.name}</div>
                                                                <div className="text-xs text-slate-400 font-normal">{staff.department || 'Academic'}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs font-medium text-slate-600">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                                    {staff.phone || '—'}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">
                                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${
                                                                    staff.status === 'present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                                    staff.status === 'late' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                                    staff.status === 'leave' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                                    staff.status === 'od' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                                }`}>
                                                                    {staff.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs font-medium text-slate-600">{staff.punch_in || '—'}</td>
                                                            <td className="px-4 py-3 text-xs font-medium text-slate-600 text-right">{staff.punch_out || '—'}</td>
                                                        </tr>
                                                    ))}
                                                    {staffReport.length === 0 && (
                                                        <tr>
                                                            <td colSpan="5" className="px-4 py-10 text-center text-slate-400 italic">No staff records found.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* 2. PRESENT TODAY TABLE */}
                                    {activeCardModal === 'present_today' && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full leading-normal border-collapse" data-testid="modal-present-staff-table">
                                                <thead>
                                                    <tr>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-xl">Staff Member</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Contact</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Status</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Punch In</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-right text-slate-500 uppercase bg-slate-50 rounded-r-xl">Punch Out</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {staffReport.filter(u => u.status === 'present' || u.status === 'late').map((staff, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                                            <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                                                <div>{staff.name}</div>
                                                                <div className="text-xs text-slate-400 font-normal">{staff.department || 'Academic'}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs font-medium text-slate-600">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                                    {staff.phone || '—'}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">
                                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${
                                                                    staff.status === 'present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                }`}>
                                                                    {staff.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs font-bold text-emerald-700">{staff.punch_in || '—'}</td>
                                                            <td className="px-4 py-3 text-xs font-medium text-slate-600 text-right">{staff.punch_out || '—'}</td>
                                                        </tr>
                                                    ))}
                                                    {staffReport.filter(u => u.status === 'present' || u.status === 'late').length === 0 && (
                                                        <tr>
                                                            <td colSpan="5" className="px-4 py-10 text-center text-slate-400 italic">No staff members marked present today.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* 3. ABSENT TODAY TABLE */}
                                    {activeCardModal === 'absent_today' && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full leading-normal border-collapse" data-testid="modal-absent-staff-table">
                                                <thead>
                                                    <tr>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-xl">Staff Member</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Department</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Contact</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-right text-slate-500 uppercase bg-slate-50 rounded-r-xl">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {staffReport.filter(u => u.status === 'absent').map((staff, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                                            <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                                                <div>{staff.name}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs text-slate-500">{staff.department || 'Academic'}</td>
                                                            <td className="px-4 py-3 text-xs font-medium text-slate-600">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                                    {staff.phone || '—'}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-right">
                                                                <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                                                                    Absent
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {staffReport.filter(u => u.status === 'absent').length === 0 && (
                                                        <tr>
                                                            <td colSpan="4" className="px-4 py-10 text-center text-slate-400 italic">No staff members absent today.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* 4. PENDING LEAVES TABLE WITH APPROVE / REJECT */}
                                    {activeCardModal === 'pending_leaves' && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full leading-normal border-collapse" data-testid="modal-pending-leaves-table">
                                                <thead>
                                                    <tr>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-xl">Staff Member</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Type</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Dates</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Reason</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Status</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-right text-slate-500 uppercase bg-slate-50 rounded-r-xl">Decision</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {leaves.filter(l => l.user_id !== user?.id && (!l.role || l.role.toUpperCase() === 'STAFF') && (!l.status || l.status.toLowerCase() === 'pending')).map((leave) => {
                                                        const isActing = actionLoading[`leave-${leave.id}`];
                                                        return (
                                                            <tr key={leave.id} data-testid={`modal-staff-leave-row-${leave.id}`} className="hover:bg-slate-50/70 transition-colors">
                                                                <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                                                    <div>{leave.name || 'Staff Member'}</div>
                                                                    <div className="text-xs text-slate-400 font-normal">{leave.department || 'Academic'}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm font-medium text-slate-700 capitalize">
                                                                    {leave.type}
                                                                </td>
                                                                <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                                                                    <span>{leave.start_date}</span>
                                                                    {leave.start_date !== leave.end_date && (
                                                                        <span> → {leave.end_date}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={leave.reason}>
                                                                    {leave.reason || '—'}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase border bg-amber-50 text-amber-700 border-amber-200">
                                                                        Pending
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            data-testid={`modal-approve-leave-${leave.id}`}
                                                                            disabled={isActing}
                                                                            onClick={() => handleUpdateLeaveStatus(leave.id, 'approved')}
                                                                            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                                                                            title="Approve Leave"
                                                                        >
                                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                                            Approve
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            data-testid={`modal-reject-leave-${leave.id}`}
                                                                            disabled={isActing}
                                                                            onClick={() => handleUpdateLeaveStatus(leave.id, 'rejected')}
                                                                            className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                                                                            title="Reject Leave"
                                                                        >
                                                                            <XCircle className="w-3.5 h-3.5" />
                                                                            Reject
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {leaves.filter(l => l.user_id !== user?.id && (!l.role || l.role.toUpperCase() === 'STAFF') && (!l.status || l.status.toLowerCase() === 'pending')).length === 0 && (
                                                        <tr>
                                                            <td colSpan="6" className="px-4 py-10 text-center text-slate-400 italic">No pending staff leave applications.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* 5. PENDING ODS TABLE WITH APPROVE / REJECT */}
                                    {activeCardModal === 'pending_ods' && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full leading-normal border-collapse" data-testid="modal-pending-ods-table">
                                                <thead>
                                                    <tr>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-xl">Staff Member</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Date</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Place</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Purpose</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Status</th>
                                                        <th className="px-4 py-3 text-xs font-bold tracking-wider text-right text-slate-500 uppercase bg-slate-50 rounded-r-xl">Decision</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {ods.filter(o => o.user_id !== user?.id && (!o.role || o.role.toUpperCase() === 'STAFF') && (!o.status || o.status.toLowerCase() === 'pending')).map((od) => {
                                                        const isActing = actionLoading[`od-${od.id}`];
                                                        return (
                                                            <tr key={od.id} data-testid={`modal-staff-od-row-${od.id}`} className="hover:bg-slate-50/70 transition-colors">
                                                                <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                                                    <div>{od.name || 'Staff Member'}</div>
                                                                    <div className="text-xs text-slate-400 font-normal">{od.department || 'Academic'}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{od.date}</td>
                                                                <td className="px-4 py-3 text-sm font-medium text-slate-700">{od.place}</td>
                                                                <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={od.purpose}>
                                                                    {od.purpose || '—'}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase border bg-amber-50 text-amber-700 border-amber-200">
                                                                        Pending
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            data-testid={`modal-approve-od-${od.id}`}
                                                                            disabled={isActing}
                                                                            onClick={() => handleUpdateODStatus(od.id, 'approved')}
                                                                            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                                                                            title="Approve OD"
                                                                        >
                                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                                            Approve
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            data-testid={`modal-reject-od-${od.id}`}
                                                                            disabled={isActing}
                                                                            onClick={() => handleUpdateODStatus(od.id, 'rejected')}
                                                                            className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                                                                            title="Reject OD"
                                                                        >
                                                                            <XCircle className="w-3.5 h-3.5" />
                                                                            Reject
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {ods.filter(o => o.user_id !== user?.id && (!o.role || o.role.toUpperCase() === 'STAFF') && (!o.status || o.status.toLowerCase() === 'pending')).length === 0 && (
                                                        <tr>
                                                            <td colSpan="6" className="px-4 py-10 text-center text-slate-400 italic">No pending staff OD requests.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setActiveCardModal(null)}
                                        className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition shadow-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : user?.role === 'admin' ? (
                /* ----------------- ADMIN DASHBOARD ----------------- */
                <div className="space-y-8">
                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Total Users */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className="p-3.5 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800">{totalStaffAdmin}</h4>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Total Users</div>
                            </div>
                        </div>

                        {/* Pending Leave Requests */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                                <FileClock className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800">{pendingLeavesAdmin}</h4>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Pending Leaves</div>
                            </div>
                        </div>

                        {/* Pending OD Requests */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800">{pendingODsAdmin}</h4>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Pending ODs</div>
                            </div>
                        </div>

                        {/* Approved Requests */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                                <ClipboardCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800">{approvedRequestsAdmin}</h4>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Approved</div>
                            </div>
                        </div>

                        {/* Rejected Requests */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
                                <ClipboardX className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800">{rejectedRequestsAdmin}</h4>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Rejected</div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Navigation Section */}
                    <div>
                        <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-blue-600" />
                            Quick Management Modules
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
                            {/* Leave Requests Quick Nav */}
                            <Link to="/leave-requests" className="group bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 hover:shadow-lg hover:border-blue-300 transition-all duration-200 flex flex-col justify-between h-44">
                                <div>
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <h5 className="font-bold text-base text-slate-800 group-hover:text-blue-600 transition-colors">Leave Requests</h5>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Review and manage staff leave applications.</p>
                                </div>
                                <div className="flex items-center text-xs font-bold text-blue-600 gap-1 self-end group-hover:gap-2 transition-all">
                                    Manage <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>

                            {/* OD Requests Quick Nav */}
                            <Link to="/od-requests" className="group bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 hover:shadow-lg hover:border-blue-300 transition-all duration-200 flex flex-col justify-between h-44">
                                <div>
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <h5 className="font-bold text-base text-slate-800 group-hover:text-blue-600 transition-colors">OD Requests</h5>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Review and authorize on-duty request submissions.</p>
                                </div>
                                <div className="flex items-center text-xs font-bold text-blue-600 gap-1 self-end group-hover:gap-2 transition-all">
                                    Manage <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>

                            {/* Location Tracking Quick Nav */}
                            <Link to="/admin/tracking" className="group bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 hover:shadow-lg hover:border-blue-300 transition-all duration-200 flex flex-col justify-between h-44">
                                <div>
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <h5 className="font-bold text-base text-slate-800 group-hover:text-blue-600 transition-colors">Location Tracking</h5>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Track punched-in staff live positions in real time.</p>
                                </div>
                                <div className="flex items-center text-xs font-bold text-blue-600 gap-1 self-end group-hover:gap-2 transition-all">
                                    Track Live <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>

                            {/* Reports Quick Nav */}
                            <Link to="/reports" className="group bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 hover:shadow-lg hover:border-blue-300 transition-all duration-200 flex flex-col justify-between h-44">
                                <div>
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <h5 className="font-bold text-base text-slate-800 group-hover:text-blue-600 transition-colors">Reports & Logs</h5>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Access daily/monthly analytics and export Excel sheets.</p>
                                </div>
                                <div className="flex items-center text-xs font-bold text-blue-600 gap-1 self-end group-hover:gap-2 transition-all">
                                    View Reports <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            ) : (
                /* ----------------- STAFF DASHBOARD ----------------- */
                <div className="mt-2">
                    <AttendancePanel />
                </div>
            )}
        </Layout>
    );
};

export default Dashboard;
