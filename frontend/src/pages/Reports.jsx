import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { BarChart, Calendar, Download, FileSpreadsheet, Clock, User, CheckCircle } from 'lucide-react';

const Reports = () => {
    const [activeTab, setActiveTab] = useState('daily');
    const [reportData, setReportData] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const fetchReport = useCallback(() => {
        setLoading(true);
        if (activeTab === 'daily') {
            api.get(`/reports/daily?date=${date}`)
                .then(res => {
                    setReportData(res.data.report || []);
                })
                .catch(err => {
                    console.error("Failed to fetch report", err);
                    setReportData([]);
                })
                .finally(() => setLoading(false));
        } else {
            api.get(`/reports/monthly?month=${month}&year=${year}`)
                .then(res => {
                    setReportData(res.data || []);
                })
                .catch(err => {
                    console.error("Failed to fetch report", err);
                    setReportData([]);
                })
                .finally(() => setLoading(false));
        }
    }, [activeTab, date, month, year]);

    const downloadExcel = async () => {
        setDownloading(true);
        try {
            const res = await api.get(`/reports/monthly/download?month=${month}&year=${year}`, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Monthly_Report_${month}_${year}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Failed to download report", err);
            alert("Failed to download Excel report.");
        } finally {
            setDownloading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    return (
        <Layout>
            {/* Header Banner */}
            <div className="mb-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white shadow-xl shadow-blue-950/20 border border-blue-700/30 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                            <BarChart className="w-3.5 h-3.5" />
                            Academic Analytics
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Attendance Reports</h2>
                    <p className="text-blue-200/90 text-xs sm:text-sm mt-1">
                        Comprehensive daily roll-call and monthly staff attendance audits
                    </p>
                </div>
            </div>

            {/* Filter Controls Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-150">
                    {/* Tab Switcher */}
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 self-start">
                        <button
                            onClick={() => setActiveTab('daily')}
                            className={`py-2 px-5 text-xs font-bold rounded-xl transition-all duration-200 ${
                                activeTab === 'daily'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Daily Roll-Call
                        </button>
                        <button
                            onClick={() => setActiveTab('monthly')}
                            className={`py-2 px-5 text-xs font-bold rounded-xl transition-all duration-200 ${
                                activeTab === 'monthly'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Monthly Aggregates
                        </button>
                    </div>

                    {/* Controls based on active tab */}
                    {activeTab === 'daily' ? (
                        <div className="flex items-center gap-2">
                            <label htmlFor="report-date" className="text-xs font-bold text-slate-500 uppercase">Select Date:</label>
                            <input
                                id="report-date"
                                type="date"
                                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <label htmlFor="report-month" className="text-xs font-bold text-slate-500 uppercase">Month:</label>
                                <input
                                    id="report-month"
                                    type="number"
                                    min="1"
                                    max="12"
                                    className="w-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <label htmlFor="report-year" className="text-xs font-bold text-slate-500 uppercase">Year:</label>
                                <input
                                    id="report-year"
                                    type="number"
                                    min="2020"
                                    max="2030"
                                    className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={downloadExcel}
                                disabled={downloading}
                                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                {downloading ? 'Downloading...' : 'Export Excel'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Report Table */}
                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mr-3" />
                        <span className="text-slate-600 font-semibold text-sm">Compiling attendance figures...</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="min-w-full leading-normal border-collapse">
                            <thead>
                                {activeTab === 'daily' ? (
                                    <tr>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-2xl">Staff Member</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Status</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Punch In</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Punch Out</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-r-2xl">Remarks / Geofence</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-2xl">Staff Member</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Date</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Punch In</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-r-2xl">Punch Out</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reportData.map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-5 py-4 text-sm font-bold text-slate-800">{row.name}</td>
                                        {activeTab === 'daily' ? (
                                            <>
                                                <td className="px-5 py-4 text-sm">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                                                        row.status === 'present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                        row.status === 'late' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                        row.status === 'leave' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                        row.status === 'od' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-sm font-medium text-slate-700">{row.punch_in || '—'}</td>
                                                <td className="px-5 py-4 text-sm font-medium text-slate-700">{row.punch_out || '—'}</td>
                                                <td className="px-5 py-4 text-xs text-slate-500 max-w-xs truncate">
                                                    {row.status === 'leave' ? row.leave_reason : row.status === 'od' ? row.od_purpose : row.location || 'Inside Campus'}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-5 py-4 text-sm font-semibold text-slate-700">{row.date}</td>
                                                <td className="px-5 py-4 text-sm font-medium text-slate-700">{row.punch_in_time || '—'}</td>
                                                <td className="px-5 py-4 text-sm font-medium text-slate-700">{row.punch_out_time || '—'}</td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                                {reportData.length === 0 && (
                                    <tr>
                                        <td colSpan={activeTab === 'daily' ? 5 : 4} className="px-5 py-12 text-center text-slate-400 italic text-sm">
                                            No attendance entries recorded for the specified criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Reports;
