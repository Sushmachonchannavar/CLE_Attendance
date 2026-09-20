import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, CheckCircle, XCircle, Trash2, Clock, User, Filter, AlertCircle } from 'lucide-react';

const LeaveRequests = () => {
    const { user } = useAuth();
    const userRole = user?.role?.toLowerCase();
    const isPrincipal = userRole === 'hoi' || userRole === 'principal';
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeRoleFilter, setActiveRoleFilter] = useState('STAFF');

    const fetchLeaves = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/requests/leaves/all?role=${activeRoleFilter}`);
            setLeaves(res.data || []);
        } catch (err) {
            console.error('Failed to fetch leaves', err);
            setLeaves([]);
        } finally {
            setLoading(false);
        }
    }, [activeRoleFilter]);

    useEffect(() => {
        fetchLeaves();
    }, [fetchLeaves]);

    const updateLeaveStatus = async (id, status) => {
        try {
            await api.put(`/requests/leaves/${id}`, { status });
            alert('Leave status updated successfully!');
            fetchLeaves();
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message || 'Failed to update leave status';
            alert(`Error: ${errorMessage}`);
            console.error('Leave update error:', err);
        }
    };

    const handleDeleteRequest = async (id, startDate) => {
        const applyDate = new Date(startDate);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        if (applyDate > oneMonthAgo) {
            alert('Admin/Principal can only clear applications older than 1 month');
            return;
        }

        if (!window.confirm('Are you sure you want to clear this application?')) return;

        try {
            await api.delete(`/requests/leaves/${id}`);
            alert('Application cleared!');
            fetchLeaves();
        } catch (err) {
            alert(`Error: ${err.response?.data?.error || err.message}`);
        }
    };


    const getStatusBadgeClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'rejected': return 'bg-rose-50 text-rose-700 border-rose-200';
            default: return 'bg-amber-50 text-amber-700 border-amber-200';
        }
    };

    return (
        <Layout>
            {/* Header Banner */}
            <div className="mb-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white shadow-xl shadow-blue-950/20 border border-blue-700/30 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                            <Calendar className="w-3.5 h-3.5" />
                            {isPrincipal ? 'Staff Leave Authorization' : 'Administrative Authorization'}
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                        {isPrincipal ? 'Staff Leave Requests' : 'Leave Approval Management'}
                    </h2>
                    <p className="text-blue-200/90 text-xs sm:text-sm mt-1">
                        {isPrincipal ? 'Review and authorize faculty and staff leave applications' : 'Review, authorize, reject, or archive institutional leave requests'}
                    </p>
                </div>
            </div>

            {/* Role Filter Tabs - Admin Only */}
            {!isPrincipal && (
                <div className="mb-6 bg-white p-1.5 rounded-2xl border border-slate-200 inline-flex shadow-sm">
                    <button
                        onClick={() => setActiveRoleFilter('STAFF')}
                        className={`py-2.5 px-6 font-bold text-xs rounded-xl transition-all duration-200 ${
                            activeRoleFilter === 'STAFF'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        Faculty & Staff Leaves
                    </button>
                    <button
                        onClick={() => setActiveRoleFilter('PRINCIPAL')}
                        className={`py-2.5 px-6 font-bold text-xs rounded-xl transition-all duration-200 ${
                            activeRoleFilter === 'PRINCIPAL'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        Principal / HOI Leaves
                    </button>
                </div>
            )}

            {/* Main Leave Request Container */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mr-3" />
                        <span className="text-slate-600 font-semibold text-sm">Retrieving leave submissions...</span>
                    </div>
                ) : leaves.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-500" />
                        <p className="font-semibold text-slate-600">No leave requests found for this category.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {leaves.map((l) => {
                            return (
                                <div
                                    key={l.id}
                                    data-testid={`leave-row-${l.id}`}
                                    className="p-5 sm:p-6 border border-slate-200/80 bg-slate-50/60 rounded-2xl hover:bg-white hover:border-slate-300 transition-all duration-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 shadow-sm"
                                >
                                    <div className="flex-1 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <span className="font-bold text-base text-slate-900">{l.name}</span>
                                            <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                                                {l.department || 'Academic'}
                                            </span>
                                            <span className="text-xs font-semibold px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full capitalize">
                                                {l.type} Leave
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Duration: <strong>{l.start_date}</strong> to <strong>{l.end_date}</strong></span>
                                        </div>

                                        <div className="text-xs text-slate-700 italic bg-white p-3.5 rounded-xl border border-slate-200/70 max-w-2xl leading-relaxed">
                                            "{l.reason}"
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Status:</span>
                                            <span className={`text-[11px] font-extrabold uppercase px-3 py-0.5 rounded-full border ${getStatusBadgeClass(l.status)}`}>
                                                {l.status || 'PENDING'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-200">
                                        {l.status !== 'approved' && (
                                            <button
                                                data-testid={`approve-leave-${l.id}`}
                                                onClick={() => updateLeaveStatus(l.id, 'approved')}
                                                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm hover:shadow active:scale-95 transition whitespace-nowrap flex items-center gap-1.5"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Approve
                                            </button>
                                        )}
                                        {l.status !== 'rejected' && (
                                            <button
                                                data-testid={`reject-leave-${l.id}`}
                                                onClick={() => updateLeaveStatus(l.id, 'rejected')}
                                                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow active:scale-95 transition whitespace-nowrap flex items-center gap-1.5"
                                            >
                                                <XCircle className="w-3.5 h-3.5" />
                                                Reject
                                            </button>
                                        )}
                                        <button
                                            data-testid={`clear-leave-${l.id}`}
                                            onClick={() => handleDeleteRequest(l.id, l.start_date)}
                                            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl active:scale-95 transition whitespace-nowrap flex items-center gap-1.5"
                                            title="Clear Application"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default LeaveRequests;
