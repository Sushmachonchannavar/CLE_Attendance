import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Calendar, Clock, MapPin, ArrowUpRight, ArrowDownRight, FileText, CheckCircle2 } from 'lucide-react';

const Attendance = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await api.get('/attendance/history');
            setHistory(res.data || []);
        } catch (err) {
            console.error('Failed to fetch attendance history', err);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const getStatusBadge = (isLate, status) => {
        const checkStatus = status ? status.toLowerCase() : (isLate ? 'late' : 'present');
        switch (checkStatus) {
            case 'present':
                return { label: 'PRESENT', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'late':
                return { label: 'LATE', class: 'bg-amber-50 text-amber-700 border-amber-200' };
            case 'od':
                return { label: 'ON DUTY', class: 'bg-blue-50 text-blue-700 border-blue-200' };
            case 'leave':
                return { label: 'LEAVE', class: 'bg-rose-50 text-rose-700 border-rose-200' };
            default:
                return { label: (status || 'RECORDED').toUpperCase(), class: 'bg-slate-100 text-slate-700 border-slate-200' };
        }
    };

    const formatDistance = (meters) => {
        if (meters === undefined || meters === null) return '—';
        return `${Math.round(meters)}m`;
    };

    return (
        <Layout>
            {/* Header Banner */}
            <div className="mb-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white shadow-xl shadow-blue-950/20 border border-blue-700/30 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                            <Clock className="w-3.5 h-3.5" />
                            Attendance Logs
                        </span>
                    </div>
                    {/* Preserved exact heading name for Playwright TC-UI-005 */}
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Attendance History</h2>
                    <p className="text-blue-200/90 text-xs sm:text-sm mt-1">
                        Comprehensive ledger of daily shifts, geofenced timestamps, and status logs
                    </p>
                </div>
            </div>

            {/* Main Log Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mr-3" />
                        <span className="text-slate-600 font-semibold text-sm">Retrieving attendance logs...</span>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-500" />
                        <p className="font-semibold text-slate-600">No attendance records found.</p>
                        <p className="text-xs text-slate-400 mt-1">Records will appear once you complete your first campus punch.</p>
                    </div>
                ) : (
                    <div>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto custom-scrollbar">
                            <table className="min-w-full leading-normal border-collapse">
                                <thead>
                                    <tr>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-2xl">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                Date
                                            </div>
                                        </th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">
                                            <div className="flex items-center gap-2">
                                                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                                                Punch In
                                            </div>
                                        </th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">
                                            <div className="flex items-center gap-2">
                                                <ArrowDownRight className="w-4 h-4 text-rose-500" />
                                                Punch Out
                                            </div>
                                        </th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-slate-400" />
                                                Geofence Accuracy
                                            </div>
                                        </th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-r-2xl">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {history.map((record) => {
                                        const badge = getStatusBadge(record.is_late, record.status);
                                        return (
                                            <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-5 py-4 text-sm font-bold text-slate-800">
                                                    {record.date}
                                                </td>
                                                <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                                                    {record.punch_in_time || '—'}
                                                </td>
                                                <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                                                    {record.punch_out_time ? (
                                                        <span>{record.punch_out_time}</span>
                                                    ) : (
                                                        <span className="text-amber-600 font-medium italic text-xs bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">In Progress</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-xs font-mono text-slate-600">
                                                    <div>In: {formatDistance(record.distance)}</div>
                                                    {record.punch_out_time && (
                                                        <div className="text-slate-400">Out: {formatDistance(record.distance_out)}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-sm">
                                                    <span className={`inline-block px-3 py-1 text-[11px] font-extrabold uppercase rounded-full border ${badge.class}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Responsive Card List (Guarantees zero horizontal overflow on 360-430px) */}
                        <div className="md:hidden space-y-3">
                            {history.map((record) => {
                                const badge = getStatusBadge(record.is_late, record.status);
                                return (
                                    <div key={record.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                                <Calendar className="w-4 h-4 text-blue-600" />
                                                {record.date}
                                            </span>
                                            <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${badge.class}`}>
                                                {badge.label}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                                            <div>
                                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Punch In</span>
                                                <span className="font-bold text-slate-700">{record.punch_in_time || '—'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Punch Out</span>
                                                <span className="font-bold text-slate-700">
                                                    {record.punch_out_time || <em className="text-amber-600 font-normal">In Progress</em>}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-[11px] text-slate-500 font-mono pt-1">
                                            Distance: In {formatDistance(record.distance)}
                                            {record.punch_out_time && ` • Out ${formatDistance(record.distance_out)}`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Attendance;
