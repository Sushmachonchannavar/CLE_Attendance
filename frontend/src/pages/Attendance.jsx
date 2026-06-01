import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Calendar, Clock, MapPin, CheckCircle, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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

    const getStatusBadgeClass = (isLate, status) => {
        const checkStatus = status ? status.toLowerCase() : (isLate ? 'late' : 'present');
        switch (checkStatus) {
            case 'present':
                return 'bg-green-100 text-green-800 border border-green-200';
            case 'late':
                return 'bg-amber-100 text-amber-800 border border-amber-200';
            case 'od':
                return 'bg-blue-100 text-blue-800 border border-blue-200';
            case 'leave':
                return 'bg-red-100 text-red-800 border border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border border-gray-200';
        }
    };

    const formatDistance = (meters) => {
        if (meters === undefined || meters === null) return '-';
        return `${Math.round(meters)}m`;
    };

    return (
        <Layout>
            <div className="mb-6 p-6 rounded-2xl text-white shadow-lg bg-gradient-to-r from-[#0a93ad] to-[#007b8a]">
                <h2 className="text-3xl font-bold">Attendance History</h2>
                <p className="text-sm opacity-90 mt-1 uppercase tracking-wider font-semibold">
                    Review and track your daily punch-in and punch-out records
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-150 p-6">
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0a93ad] mr-3"></div>
                        <span className="text-gray-500 font-semibold">Loading attendance logs...</span>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 italic">
                        No attendance records found for your account.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full leading-normal border-collapse">
                            <thead>
                                <tr>
                                    <th className="px-5 py-4 text-xs font-bold tracking-wider text-left text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            Date
                                        </div>
                                    </th>
                                    <th className="px-5 py-4 text-xs font-bold tracking-wider text-left text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                                            Punch In Time
                                        </div>
                                    </th>
                                    <th className="px-5 py-4 text-xs font-bold tracking-wider text-left text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <ArrowDownRight className="w-4 h-4 text-red-500" />
                                            Punch Out Time
                                        </div>
                                    </th>
                                    <th className="px-5 py-4 text-xs font-bold tracking-wider text-left text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            Geofence Distance (In / Out)
                                        </div>
                                    </th>
                                    <th className="px-5 py-4 text-xs font-bold tracking-wider text-left text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            Status
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200 font-semibold text-gray-800">
                                            {record.date}
                                        </td>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200 text-gray-700">
                                            {record.punch_in_time || '-'}
                                        </td>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200 text-gray-700 font-medium">
                                            {record.punch_out_time ? (
                                                <span className="text-gray-900">{record.punch_out_time}</span>
                                            ) : (
                                                <span className="text-amber-500 italic text-xs">In Progress</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200 text-gray-700">
                                            <div className="flex flex-col text-xs font-mono">
                                                <span>In: {formatDistance(record.distance)}</span>
                                                {record.punch_out_time && (
                                                    <span className="text-gray-400">Out: {formatDistance(record.distance_out)}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                            <span className={`inline-block px-3 py-1 text-xs font-bold uppercase rounded-full ${getStatusBadgeClass(record.is_late, record.status)}`}>
                                                {record.status ? record.status : (record.is_late ? 'LATE' : 'ON TIME')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Attendance;
