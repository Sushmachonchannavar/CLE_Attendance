import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Plus, X, Trash2, Calendar, FileText, CheckCircle2, Clock } from 'lucide-react';

const Leaves = () => {
    const [leaves, setLeaves] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        type: 'sick',
        start_date: '',
        end_date: '',
        reason: ''
    });

    const fetchLeaves = useCallback(() => {
        setLoading(true);
        api.get('/requests/leaves')
            .then(res => {
                setLeaves(res.data || []);
            })
            .catch(err => {
                console.error("Failed to fetch leaves", err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        fetchLeaves();
    }, [fetchLeaves]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/requests/leaves', formData);
            setShowModal(false);
            setFormData({ type: 'sick', start_date: '', end_date: '', reason: '' });
            alert('Leave applied successfully!');
            fetchLeaves();
        } catch (err) {
            console.error("Failed to apply leave", err);
            const errorMessage = err.response?.data?.error || err.message || "Failed to apply leave";
            alert(`Error: ${errorMessage}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to clear this application?')) return;
        try {
            await api.delete(`/requests/leaves/${id}`);
            alert('Application cleared successfully!');
            fetchLeaves();
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message || "Failed to clear application";
            alert(`Error: ${errorMessage}`);
        }
    };

    const getStatusBadge = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved': return { label: 'APPROVED', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'rejected': return { label: 'REJECTED', class: 'bg-rose-50 text-rose-700 border-rose-200' };
            default: return { label: 'PENDING', class: 'bg-amber-50 text-amber-700 border-amber-200' };
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
                                <Calendar className="w-3.5 h-3.5" />
                                Faculty Portal
                            </span>
                        </div>
                        {/* Heading MUST match "Leave Requests" for Playwright TC-UI-005 */}
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Leave Requests</h2>
                        <p className="text-blue-200/90 text-xs sm:text-sm mt-1">
                            Apply for medical, casual, or earned leaves with administrative tracking
                        </p>
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4" />
                        Apply Leave
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mr-3" />
                        <span className="text-slate-600 font-semibold text-sm">Loading leave applications...</span>
                    </div>
                ) : leaves.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-500" />
                        <p className="font-semibold text-slate-600">No leave requests found.</p>
                        <p className="text-xs text-slate-400 mt-1">Click "Apply Leave" above to submit a new application.</p>
                    </div>
                ) : (
                    <div>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto custom-scrollbar">
                            <table className="min-w-full leading-normal border-collapse">
                                <thead>
                                    <tr>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-2xl">Type</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Duration Dates</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Reason</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Status</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-right text-slate-500 uppercase bg-slate-50 rounded-r-2xl">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {leaves.map((leave) => {
                                        const badge = getStatusBadge(leave.status);
                                        return (
                                            <tr key={leave.id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-5 py-4 text-sm font-bold text-slate-800 capitalize">
                                                    {leave.type} Leave
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-700 font-medium">
                                                    <span className="font-semibold text-slate-900">{leave.start_date}</span>
                                                    <span className="text-slate-400 mx-2">→</span>
                                                    <span className="font-semibold text-slate-900">{leave.end_date}</span>
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-600 max-w-xs truncate">
                                                    {leave.reason}
                                                </td>
                                                <td className="px-5 py-4 text-sm">
                                                    <span className={`inline-block px-3 py-1 text-[11px] font-extrabold uppercase rounded-full border ${badge.class}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-sm text-right">
                                                    <button
                                                        onClick={() => handleDelete(leave.id)}
                                                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                                                        title="Clear Application"
                                                        aria-label="Clear Application"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Responsive Cards */}
                        <div className="md:hidden space-y-3">
                            {leaves.map((leave) => {
                                const badge = getStatusBadge(leave.status);
                                return (
                                    <div key={leave.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-800 capitalize">
                                                {leave.type} Leave
                                            </span>
                                            <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${badge.class}`}>
                                                {badge.label}
                                            </span>
                                        </div>

                                        <div className="text-xs text-slate-600 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{leave.start_date} → {leave.end_date}</span>
                                        </div>

                                        <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-150 italic">
                                            "{leave.reason}"
                                        </p>

                                        <div className="flex justify-end pt-1">
                                            <button
                                                onClick={() => handleDelete(leave.id)}
                                                className="text-xs text-rose-600 font-bold flex items-center gap-1 hover:underline"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Apply Leave Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => !submitting && setShowModal(false)}
                    />

                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-7 border border-slate-100 z-10 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Apply for Leave</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Submit application for administrative approval</p>
                            </div>
                            <button
                                onClick={() => !submitting && setShowModal(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="leave-type-select" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Leave Category
                                </label>
                                <select
                                    id="leave-type-select"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="sick">Sick Leave</option>
                                    <option value="casual">Casual Leave</option>
                                    <option value="earned">Earned Leave</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="start_date" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Start Date
                                    </label>
                                    <input
                                        id="start_date"
                                        type="date"
                                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={formData.start_date}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="end_date" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        End Date
                                    </label>
                                    <input
                                        id="end_date"
                                        type="date"
                                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={formData.end_date}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="leave-reason" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Reason for Absence
                                </label>
                                <textarea
                                    id="leave-reason"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    rows="3"
                                    placeholder="Explain the detailed context for your leave..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    disabled={submitting}
                                    className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 text-xs font-bold text-white uppercase tracking-wider bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Leave'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Leaves;