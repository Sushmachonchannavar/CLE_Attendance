import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import AdminMapDashboard from '../components/AdminMapDashboard';
import api from '../utils/api';
import { MapPin, ShieldAlert, CheckCircle, Clock, Search, AlertCircle, RefreshCw } from 'lucide-react';

const LocationTracking = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCoords, setSelectedCoords] = useState(null);

    const fetchLocations = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const res = await api.get('/admin/employee-locations');
            if (res.data.success) {
                setEmployees(res.data.employees || []);
                setError('');
            }
        } catch (err) {
            console.error('Failed to fetch employee locations', err);
            setError(err.response?.data?.error || 'Failed to connect to location services.');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations(true);
        // Poll every 10 seconds
        const interval = setInterval(() => {
            fetchLocations(false);
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    // Helper to calculate relative time since timestamp
    const getRelativeTime = (timestampStr) => {
        if (!timestampStr) return 'never';
        const timestamp = new Date(timestampStr);
        const diffMs = Date.now() - timestamp.getTime();
        const diffSec = Math.floor(diffMs / 1000);

        if (diffSec < 10) return 'just now';
        if (diffSec < 60) return `${diffSec}s ago`;

        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;

        const diffHour = Math.floor(diffMin / 60);
        return `${diffHour}h ago`;
    };

    // Stale check (> 2 minutes)
    const isStale = (timestampStr) => {
        if (!timestampStr) return true;
        const diffMs = Date.now() - new Date(timestampStr).getTime();
        return diffMs > 120000;
    };

    // Filter employees by search query
    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Compute status counts
    const activeCount = employees.length;
    const insideCount = employees.filter(e => e.isInsideCampus).length;
    const outsideCount = activeCount - insideCount;

    // Attach processed fields
    const processedEmployees = filteredEmployees.map(emp => ({
        ...emp,
        lastUpdatedText: getRelativeTime(emp.timestamp),
        stale: isStale(emp.timestamp)
    }));

    const handleEmployeeClick = (emp) => {
        const lat = parseFloat(emp.latitude);
        const lng = parseFloat(emp.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
            setSelectedCoords([lat, lng]);
        }
    };

    return (
        <Layout>
            {/* Header Banner */}
            <div className="mb-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white shadow-xl shadow-blue-950/20 border border-blue-700/30 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                            <MapPin className="w-3.5 h-3.5" />
                            Live Telemetry
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Employee Location Tracking</h2>
                    <p className="text-blue-200/90 text-xs sm:text-sm mt-1">
                        Real-time geofence tracking and spatial monitoring of active campus personnel
                    </p>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4">
                    <div className="p-3.5 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-slate-800">{activeCount}</h4>
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Active Trackers</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4">
                    <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-slate-800">{insideCount}</h4>
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Inside Campus</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4">
                    <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-slate-800">{outsideCount}</h4>
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Outside Campus</div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 mb-6 text-rose-800 bg-rose-50 rounded-2xl border border-rose-200">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                    <span className="text-sm font-semibold">{error}</span>
                </div>
            )}

            {/* Main Split Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Employee List Panel */}
                <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/80 lg:col-span-1 flex flex-col h-[580px]">
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <MapPin className="text-blue-600 w-4 h-4" />
                                Active Staff Personnel
                            </h4>
                            <button
                                onClick={() => fetchLocations(true)}
                                aria-label="Refresh locations"
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by name or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:font-normal placeholder:text-slate-400"
                            />
                            <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                        </div>
                    </div>

                    {/* Scrollable list */}
                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col justify-center items-center py-16 h-full text-slate-400">
                                <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mb-3" />
                                <span className="text-xs font-semibold text-slate-600">Syncing live coordinates...</span>
                            </div>
                        ) : processedEmployees.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 italic text-xs">
                                {searchQuery ? 'No staff matching filter.' : 'No active punched-in personnel.'}
                            </div>
                        ) : (
                            processedEmployees.map((emp) => (
                                <button
                                    key={emp.userId}
                                    onClick={() => handleEmployeeClick(emp)}
                                    className="w-full text-left p-3.5 bg-slate-50 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 rounded-2xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20 group"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h5 className="font-bold text-xs text-slate-800 group-hover:text-blue-700 transition-colors">
                                            {emp.name}
                                        </h5>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                            emp.isInsideCampus
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                                        }`}>
                                            {emp.isInsideCampus ? 'Inside' : 'Outside'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-mono mb-2">ID: {emp.employeeId}</p>

                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-200/50">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span className={emp.stale ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                                                {emp.stale ? `Stale: ${emp.lastUpdatedText}` : emp.lastUpdatedText}
                                            </span>
                                        </div>
                                        <span>In: {emp.punchInTime}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Map Panel */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden h-[580px] flex flex-col">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-700">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                            <span>Campus Area Geofence Monitor</span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Select staff member to locate</span>
                    </div>
                    <div className="flex-1 relative">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent" />
                            </div>
                        ) : (
                            <AdminMapDashboard staffList={processedEmployees} centralCoordinate={selectedCoords || undefined} />
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default LocationTracking;
