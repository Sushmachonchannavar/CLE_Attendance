import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import AttendancePanel from '../components/AttendancePanel';
import api from '../utils/api';

const isAdminRole = (role) => {
    if (!role) return false;
    const r = role.toString().toLowerCase();
    return r === 'admin' || r === 'hoi' || r === 'principal';
};

const Dashboard = () => {
    const { user, logout } = useAuth();
    const [dailyReport, setDailyReport] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [ods, setOds] = useState([]);
    const [loadingAdmin, setLoadingAdmin] = useState(false);

    const fetchAdminData = async () => {
        setLoadingAdmin(true);
        try {
            // Fetch reports
            try {
                const r1 = await api.get('/report/daily');
                setDailyReport(r1.data.report || []);
            } catch (err) {
                console.error('Failed to fetch daily report', err);
                setDailyReport([]);
            }

            // Fetch leaves - this should work independently
            try {
                const r2 = await api.get('/requests/leaves/all');
                console.log('Leaves response:', r2.data);
                setLeaves(r2.data || []);
            } catch (err) {
                console.error('Failed to fetch leaves', err);
                setLeaves([]);
            }

            // Fetch OD - this should work independently
            try {
                const r3 = await api.get('/requests/od/all');
                console.log('ODs response:', r3.data);
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
            console.log('User is admin/HOI, fetching data...');
            fetchAdminData();
            // Refresh data every 10 seconds
            const interval = setInterval(fetchAdminData, 10000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const updateLeaveStatus = async (id, status) => {
        try {
            await api.put(`/requests/leaves/${id}`, { status });
            alert('Leave status updated successfully!');
            fetchAdminData();
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message || 'Failed to update leave status';
            alert(`Error: ${errorMessage}`);
            console.error('Leave update error:', err);
        }
    };

    const updateOdStatus = async (id, status) => {
        try {
            await api.put(`/requests/od/${id}`, { status });
            alert('OD status updated successfully!');
            fetchAdminData();
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message || 'Failed to update OD status';
            alert(`Error: ${errorMessage}`);
            console.error('OD update error:', err);
        }
    };

    const handleDeleteRequest = async (type, id, startDate) => {
        // Admin/HOI/Principal rule: only after 1 month
        const applyDate = new Date(startDate);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        if (applyDate > oneMonthAgo) {
            alert('Admin/Principal can only clear applications older than 1 month');
            return;
        }

        if (!window.confirm('Are you sure you want to clear this application?')) return;

        try {
            await api.delete(`/requests/${type}/${id}`);
            alert('Application cleared!');
            fetchAdminData();
        } catch (err) {
            alert(`Error: ${err.response?.data?.error || err.message}`);
        }
    };

    return (
        <Layout>

            <div className={`mb-6 p-4 rounded-lg text-white ${isAdminRole(user?.role) ? 'bg-gradient-to-r from-cyan-500 to-cyan-600' : 'bg-gradient-to-r from-blue-700 to-blue-900'}`}>
                <h2 className="text-2xl font-bold">Welcome, {user?.name || 'User'}</h2>
                <p className="text-sm opacity-90">Dashboard for {user?.role?.toUpperCase() || 'GUEST'}</p>
            </div>

            <h3 className="text-3xl font-medium text-gray-700">Dashboard</h3>

            <div className="mt-4">
                <div className="flex flex-wrap -mx-6">
                    {isAdminRole(user?.role) ? (
                        <>
                            <div className="w-full px-6 sm:w-1/2 xl:w-1/3">
                                <div className="flex items-center px-5 py-6 bg-white rounded-md shadow-sm">
                                    <div className="p-3 bg-indigo-100 rounded-full">
                                    </div>
                                    <div className="mx-5">
                                        <h4 className="text-2xl font-semibold text-gray-700">{dailyReport.length || 0}</h4>
                                        <div className="text-gray-500">Total Employees</div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full px-6 sm:w-1/2 xl:w-1/3">
                                <div className="flex items-center px-5 py-6 bg-white rounded-md shadow-sm">
                                    <div className="p-3 bg-green-100 rounded-full">
                                    </div>
                                    <div className="mx-5">
                                        <h4 className="text-2xl font-semibold text-gray-700">{dailyReport.filter(d => d.status === 'present').length || 0}</h4>
                                        <div className="text-gray-500">Present Today</div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full px-6 sm:w-1/2 xl:w-1/3">
                                <div className="flex items-center px-5 py-6 bg-white rounded-md shadow-sm">
                                    <div className="p-3 bg-red-100 rounded-full">
                                    </div>
                                    <div className="mx-5">
                                        <h4 className="text-2xl font-semibold text-gray-700">{dailyReport.filter(d => d.status === 'absent').length || 0}</h4>
                                        <div className="text-gray-500">Absent Today</div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                <div className="mt-8">
                    <AttendancePanel />
                </div>

                {isAdminRole(user?.role) && (
                    <div className="mt-8 p-6 bg-white rounded-lg shadow-lg border-t-4 border-cyan-500">
                        <h4 className="text-2xl font-bold mb-6 text-cyan-700">📋 Leave & OD Approvals</h4>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <h5 className="font-semibold text-lg text-cyan-700 mb-3">📅 Leave Requests</h5>
                                <div className="mt-2 space-y-3">
                                    {loadingAdmin ? (
                                        <div className="text-gray-600">Loading...</div>
                                    ) : leaves.length === 0 ? (
                                        <div className="text-gray-400 italic">No leave requests pending</div>
                                    ) : (
                                        leaves.map(l => (
                                            <div key={l.id} className="p-4 border-l-4 border-yellow-400 bg-gray-50 rounded hover:bg-gray-100 transition flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <div className="font-bold text-gray-800">{l.name}</div>
                                                    <div className="text-xs text-gray-600">{l.department}</div>
                                                    <div className="text-sm text-gray-700 mt-1">{l.start_date} → {l.end_date}</div>
                                                    <div className="text-sm text-gray-600 italic">"{l.reason}"</div>
                                                    <div className={`text-xs font-semibold mt-2 ${l.status === 'approved' ? 'text-green-600' : l.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                                                        Status: {l.status?.toUpperCase() || 'PENDING'}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    {l.status !== 'approved' && (
                                                        <button onClick={() => updateLeaveStatus(l.id, 'approved')} className="px-3 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700 whitespace-nowrap">✓ Approve</button>
                                                    )}
                                                    {l.status !== 'rejected' && (
                                                        <button onClick={() => updateLeaveStatus(l.id, 'rejected')} className="px-3 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700 whitespace-nowrap">✕ Reject</button>
                                                    )}
                                                    <button onClick={() => handleDeleteRequest('leaves', l.id, l.start_date)} className="px-3 py-1 text-xs text-white bg-gray-600 rounded hover:bg-gray-700 whitespace-nowrap">🗑 Clear</button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div>
                                <h5 className="font-semibold text-lg text-cyan-700 mb-3">📤 OD Requests</h5>
                                <div className="mt-2 space-y-3">
                                    {loadingAdmin ? (
                                        <div className="text-gray-600">Loading...</div>
                                    ) : ods.length === 0 ? (
                                        <div className="text-gray-400 italic">No OD requests pending</div>
                                    ) : (
                                        ods.map(o => (
                                            <div key={o.id} className="p-4 border-l-4 border-blue-400 bg-gray-50 rounded hover:bg-gray-100 transition flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <div className="font-bold text-gray-800">{o.name}</div>
                                                    <div className="text-xs text-gray-600">{o.department}</div>
                                                    <div className="text-sm text-gray-700 mt-1">📍 {o.place} | 📅 {o.date}</div>
                                                    <div className="text-sm text-gray-600 italic">"{o.purpose}"</div>
                                                    <div className={`text-xs font-semibold mt-2 ${o.status === 'approved' ? 'text-green-600' : o.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                                                        Status: {o.status?.toUpperCase() || 'PENDING'}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    {o.status !== 'approved' && (
                                                        <button onClick={() => updateOdStatus(o.id, 'approved')} className="px-3 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700 whitespace-nowrap">✓ Approve</button>
                                                    )}
                                                    {o.status !== 'rejected' && (
                                                        <button onClick={() => updateOdStatus(o.id, 'rejected')} className="px-3 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700 whitespace-nowrap">✕ Reject</button>
                                                    )}
                                                    <button onClick={() => handleDeleteRequest('od', o.id, o.date)} className="px-3 py-1 text-xs text-white bg-gray-600 rounded hover:bg-gray-700 whitespace-nowrap">🗑 Clear</button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Dashboard;

/*import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import AttendancePanel from '../components/AttendancePanel';
import api from '../utils/api';

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

    useEffect(() => {
        if (user && isAdminRole(user.role)) {
            fetchAdminData();
            const interval = setInterval(fetchAdminData, 10000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchAdminData = async () => {
        setLoadingAdmin(true);
        try {
            const [r1, r2, r3] = await Promise.allSettled([
                api.get('/report/daily'),
                api.get('/requests/leaves/all'),
                api.get('/requests/od/all')
            ]);
            
            if (r1.status === 'fulfilled') setDailyReport(r1.value.data.report || []);
            if (r2.status === 'fulfilled') setLeaves(r2.value.data || []);
            if (r3.status === 'fulfilled') setOds(r3.value.data || []);
        } finally {
            setLoadingAdmin(false);
        }
    };

    const updateStatus = async (type, id, status) => {
        try {
            await api.put(`/requests/${type}/${id}`, { status });
            alert(`${type.toUpperCase()} status updated!`);
            fetchAdminData();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    return (
        <Layout>
            
            <div className={`mb-6 p-5 md:p-8 rounded-2xl text-white shadow-lg ${isAdminRole(user?.role) ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : 'bg-gradient-to-r from-blue-700 to-blue-900'}`}>
                <h2 className="text-xl md:text-3xl font-bold">Welcome, {user?.name || 'User'}</h2>
                <p className="text-xs md:text-sm opacity-90 mt-1 uppercase tracking-wider font-semibold">
                    {user?.role || 'Guest'} Portal
                </p>
            </div>

            <h3 className="text-2xl md:text-3xl font-bold text-gray-800 px-1">Dashboard</h3>

            <div className="mt-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isAdminRole(user?.role) ? (
                        <>
                            <StatCard color="indigo" label="Total Employees" value={dailyReport.length} />
                            <StatCard color="green" label="Present Today" value={dailyReport.filter(d => d.status === 'present').length} />
                            <StatCard color="red" label="Absent Today" value={dailyReport.filter(d => d.status === 'absent').length} />
                        </>
                    ) : (
                        <div className="bg-white p-6 rounded-xl shadow-sm border flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-xl">🕒</div>
                            <div>
                                <h4 className="font-bold text-gray-800">Attendance</h4>
                                <p className="text-sm text-gray-500">Mark your daily status</p>
                            </div>
                        </div>
                    )}
                </div>

                
                <div className="mt-8 bg-white rounded-2xl shadow-sm border p-4 md:p-6">
                    <AttendancePanel />
                </div>

                
                {isAdminRole(user?.role) && (
                    <div className="mt-8">
                        <div className="flex items-center gap-2 mb-4 px-1">
                            <span className="text-2xl">📋</span>
                            <h4 className="text-xl font-bold text-gray-800">Pending Approvals</h4>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          
                            <ApprovalSection 
                                title="Leave Requests" 
                                icon="📅" 
                                data={leaves} 
                                loading={loadingAdmin}
                                onUpdate={(id, status) => updateStatus('leaves', id, status)} 
                            />
                            
                            
                            <ApprovalSection 
                                title="OD Requests" 
                                icon="📤" 
                                data={ods} 
                                loading={loadingAdmin}
                                onUpdate={(id, status) => updateStatus('od', id, status)} 
                            />
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

// Reusable Stat Card Component
const StatCard = ({ color, label, value }) => (
    <div className="bg-white px-5 py-6 rounded-xl shadow-sm border-b-4 flex items-center" style={{ borderBottomColor: color }}>
        <div className={`p-3 rounded-lg bg-${color}-50 text-2xl`}>📊</div>
        <div className="mx-4">
            <h4 className="text-2xl font-bold text-gray-800">{value || 0}</h4>
            <div className="text-sm text-gray-500 font-medium">{label}</div>
        </div>
    </div>
);

// Reusable Approval Section for Mobile
const ApprovalSection = ({ title, icon, data, loading, onUpdate }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h5 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
            <span>{icon}</span> {title}
        </h5>
        <div className="space-y-4">
            {loading ? (
                <div className="animate-pulse text-gray-400 text-sm">Loading requests...</div>
            ) : data.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-xl text-gray-400 italic text-sm">No pending requests</div>
            ) : (
                data.map(item => (
                    <div key={item.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-bold text-gray-900">{item.name}</div>
                                <div className="text-xs text-blue-600 font-semibold uppercase">{item.department}</div>
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${item.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {item.status || 'Pending'}
                            </span>
                        </div>
                        
                        <div className="text-sm text-gray-600">
                            {item.place ? <div>📍 {item.place}</div> : null}
                            <div className="font-medium">📅 {item.start_date || item.date} {item.end_date ? `→ ${item.end_date}` : ''}</div>
                            <div className="mt-1 italic">"{item.reason || item.purpose}"</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-1">
                            <button onClick={() => onUpdate(item.id, 'approved')} className="py-2.5 bg-green-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-transform">✓ Approve</button>
                            <button onClick={() => onUpdate(item.id, 'rejected')} className="py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold active:scale-95 transition-transform">✕ Reject</button>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
);

export default Dashboard;*/
