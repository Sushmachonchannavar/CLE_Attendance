import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import AttendancePanel from '../components/AttendancePanel';
import api from '../utils/api';
import { Users, FileClock, ClipboardCheck, ClipboardX, ShieldAlert, ArrowRight, BookOpen, Clock } from 'lucide-react';

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
    const [loadingAdmin, setLoadingAdmin] = useState(false);

    const fetchAdminData = async () => {
        setLoadingAdmin(true);
        try {
            // Fetch reports
            try {
                const r1 = await api.get('/reports/daily');
                setDailyReport(r1.data.report || []);
            } catch (err) {
                console.error('Failed to fetch daily report', err);
                setDailyReport([]);
            }

            // Fetch leaves
            try {
                const r2 = await api.get('/requests/leaves/all');
                setLeaves(r2.data || []);
            } catch (err) {
                console.error('Failed to fetch leaves', err);
                setLeaves([]);
            }

            // Fetch OD
            try {
                const r3 = await api.get('/requests/od/all');
                setOds(r3.data || []);
            } catch (err) {
                console.error('Failed to fetch ODs', err);
                setOds([]);
            }
        } finally {
            setLoadingAdmin(false);
        }
    };

    useEffect(() => {
        if (user && isAdminRole(user.role)) {
            fetchAdminData();
            // Refresh data every 10 seconds
            const interval = setInterval(fetchAdminData, 10000);
            return () => clearInterval(interval);
        }
    }, [user]);

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

    return (
        <Layout>
            <div className={`mb-6 p-6 rounded-2xl text-white shadow-lg ${isAdminRole(user?.role) ? 'bg-gradient-to-r from-[#0a93ad] to-[#007b8a]' : 'bg-gradient-to-r from-blue-700 to-blue-900'}`}>
                <h2 className="text-3xl font-bold">Welcome, {user?.name || 'User'}</h2>
                <p className="text-sm opacity-90 mt-1 uppercase tracking-wider font-semibold">
                    {user?.role === 'hoi' ? 'PRINCIPAL' : user?.role?.toUpperCase() || 'GUEST'} Portal
                </p>
            </div>

            <h3 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h3>

            {user?.role === 'hoi' ? (
                /* ----------------- PRINCIPAL DASHBOARD ----------------- */
                <div className="space-y-8">
                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Total Staff */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl animate-pulse">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-800">{totalStaffPrincipal}</h4>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Staff</div>
                            </div>
                        </div>

                        {/* Today's Present Staff */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                                <ClipboardCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-800">{presentStaffPrincipal}</h4>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Present Today</div>
                            </div>
                        </div>

                        {/* Today's Absent Staff */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                                <ClipboardX className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-800">{absentStaffPrincipal}</h4>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Absent Today</div>
                            </div>
                        </div>

                        {/* Pending Leave Requests */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                                <FileClock className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-800">{pendingLeavesPrincipal}</h4>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Pending Leaves</div>
                            </div>
                        </div>

                        {/* Pending OD Requests */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-800">{pendingODsPrincipal}</h4>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Pending ODs</div>
                            </div>
                        </div>
                    </div>

                    {/* Attendance Summary Breakdown & Today's Attendance Table */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Attendance Summary Panel */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1">
                            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Clock className="text-[#0a93ad] w-5 h-5" />
                                Attendance Summary
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm font-semibold mb-1">
                                        <span className="text-gray-500">Present (On Time / Late)</span>
                                        <span className="text-green-600">{presentStaffPrincipal} / {totalStaffPrincipal}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className="bg-green-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${totalStaffPrincipal > 0 ? (presentStaffPrincipal / totalStaffPrincipal) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm font-semibold mb-1">
                                        <span className="text-gray-500">Absent</span>
                                        <span className="text-red-600">{absentStaffPrincipal} / {totalStaffPrincipal}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className="bg-red-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${totalStaffPrincipal > 0 ? (absentStaffPrincipal / totalStaffPrincipal) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm font-semibold mb-1">
                                        <span className="text-gray-500">Approved Leave</span>
                                        <span className="text-amber-600">{leaveStaffPrincipal} / {totalStaffPrincipal}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${totalStaffPrincipal > 0 ? (leaveStaffPrincipal / totalStaffPrincipal) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm font-semibold mb-1">
                                        <span className="text-gray-500">On Duty (OD)</span>
                                        <span className="text-blue-600">{odStaffPrincipal} / {totalStaffPrincipal}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${totalStaffPrincipal > 0 ? (odStaffPrincipal / totalStaffPrincipal) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Today's Staff Status Table */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <BookOpen className="text-[#0a93ad] w-5 h-5" />
                                Today's Staff Status
                            </h4>
                            <div className="overflow-x-auto max-h-64">
                                <table className="min-w-full leading-normal">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-gray-500 uppercase bg-gray-50 border-b border-gray-250">Name</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-gray-500 uppercase bg-gray-50 border-b border-gray-250">Department</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-gray-500 uppercase bg-gray-50 border-b border-gray-250">Status</th>
                                            <th className="px-4 py-3 text-xs font-bold tracking-wider text-left text-gray-500 uppercase bg-gray-50 border-b border-gray-250">Punch In</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffReport.map((staff, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-sm bg-white border-b border-gray-200 font-semibold text-gray-800">{staff.name}</td>
                                                <td className="px-4 py-3 text-sm bg-white border-b border-gray-200 text-gray-500">{staff.department}</td>
                                                <td className="px-4 py-3 text-sm bg-white border-b border-gray-200">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                                        staff.status === 'present' ? 'bg-green-100 text-green-800' :
                                                        staff.status === 'late' ? 'bg-amber-100 text-amber-800' :
                                                        staff.status === 'leave' ? 'bg-red-100 text-red-800' :
                                                        staff.status === 'od' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {staff.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm bg-white border-b border-gray-200 text-gray-700 font-medium">{staff.punch_in}</td>
                                            </tr>
                                        ))}
                                        {staffReport.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="px-4 py-8 text-center text-gray-400 italic">No staff users registered.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : user?.role === 'admin' ? (
                /* ----------------- ADMIN DASHBOARD ----------------- */
                <div className="space-y-8">
                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Total Staff */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-800">{totalStaffAdmin}</h4>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Users</div>
                            </div>
                        </div>

                        {/* Pending Leave Requests */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                                <FileClock className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-800">{pendingLeavesAdmin}</h4>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Pending Leaves</div>
                            </div>
                        </div>

                        {/* Pending OD Requests */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-800">{pendingODsAdmin}</h4>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Pending ODs</div>
                            </div>
                        </div>

                        {/* Approved Requests */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                                <ClipboardCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-800">{approvedRequestsAdmin}</h4>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Approved</div>
                            </div>
                        </div>

                        {/* Rejected Requests */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                                <ClipboardX className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-800">{rejectedRequestsAdmin}</h4>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Rejected</div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Navigation Section */}
                    <div>
                        <h4 className="text-xl font-bold text-gray-800 mb-4">Quick Navigation</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Leave Requests Quick Nav */}
                            <Link to="/leave-requests" className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col justify-between h-40">
                                <div>
                                    <h5 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-[#0a93ad] transition-colors">📅 Leave Requests</h5>
                                    <p className="text-sm text-gray-500">View and manage employee leave applications.</p>
                                </div>
                                <div className="flex items-center text-xs font-bold text-[#0a93ad] gap-1 self-end group-hover:gap-2 transition-all">
                                    Manage <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>

                            {/* OD Requests Quick Nav */}
                            <Link to="/od-requests" className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col justify-between h-40">
                                <div>
                                    <h5 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-[#0a93ad] transition-colors">📤 OD Requests</h5>
                                    <p className="text-sm text-gray-500">Review and authorize on-duty request submissions.</p>
                                </div>
                                <div className="flex items-center text-xs font-bold text-[#0a93ad] gap-1 self-end group-hover:gap-2 transition-all">
                                    Manage <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>

                            {/* Reports Quick Nav */}
                            <Link to="/reports" className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col justify-between h-40">
                                <div>
                                    <h5 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-[#0a93ad] transition-colors">📊 Attendance Reports</h5>
                                    <p className="text-sm text-gray-500">Access daily/monthly analytics and export Excel sheets.</p>
                                </div>
                                <div className="flex items-center text-xs font-bold text-[#0a93ad] gap-1 self-end group-hover:gap-2 transition-all">
                                    View Reports <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            ) : (
                /* ----------------- STAFF DASHBOARD ----------------- */
                <div className="mt-6">
                    <AttendancePanel />
                </div>
            )}
        </Layout>
    );
};

export default Dashboard;
