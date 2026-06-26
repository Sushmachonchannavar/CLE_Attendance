import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { FileText, Eye, Download } from 'lucide-react';

const ODRequests = () => {
    const { user } = useAuth();
    const [ods, setOds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeRoleFilter, setActiveRoleFilter] = useState('STAFF');

    const fetchOds = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/requests/od/all?role=${activeRoleFilter}`);
            setOds(res.data || []);
        } catch (err) {
            console.error('Failed to fetch ODs', err);
            setOds([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOds();
    }, [activeRoleFilter]);

    const updateOdStatus = async (id, status) => {
        try {
            await api.put(`/requests/od/${id}`, { status });
            alert('OD status updated successfully!');
            fetchOds();
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message || 'Failed to update OD status';
            alert(`Error: ${errorMessage}`);
            console.error('OD update error:', err);
        }
    };

    const handleDeleteRequest = async (id, date) => {
        const applyDate = new Date(date);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        if (applyDate > oneMonthAgo) {
            alert('Admin/Principal can only clear applications older than 1 month');
            return;
        }

        if (!window.confirm('Are you sure you want to clear this application?')) return;

        try {
            await api.delete(`/requests/od/${id}`);
            alert('Application cleared!');
            fetchOds();
        } catch (err) {
            alert(`Error: ${err.response?.data?.error || err.message}`);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved': return 'bg-green-100 text-green-800 border border-green-200';
            case 'rejected': return 'bg-red-100 text-red-800 border border-red-200';
            default: return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
        }
    };

    return (
        <Layout>
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-3xl font-bold text-gray-800">📤 OD Requests</h3>
                    <p className="text-sm text-gray-500 mt-1">Review, approve, reject, or clear OD applications.</p>
                </div>
            </div>

            {/* Role Filter Tabs */}
            <div className="mb-6 flex border-b border-gray-250">
                <button
                    onClick={() => setActiveRoleFilter('STAFF')}
                    className={`py-3 px-6 font-bold text-sm transition-all duration-200 border-b-2 ${
                        activeRoleFilter === 'STAFF'
                            ? 'border-[#0a93ad] text-[#0a93ad]'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Staff ODs
                </button>
                <button
                    onClick={() => setActiveRoleFilter('PRINCIPAL')}
                    className={`py-3 px-6 font-bold text-sm transition-all duration-200 border-b-2 ${
                        activeRoleFilter === 'PRINCIPAL'
                            ? 'border-[#0a93ad] text-[#0a93ad]'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Principal ODs
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-150 p-6">
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <span className="text-gray-500">Loading OD requests...</span>
                    </div>
                ) : ods.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 italic">
                        No OD requests found.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {ods.map((o) => (
                            <div
                                key={o.id}
                                className="p-5 border border-gray-200 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                            >
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="font-bold text-lg text-gray-800">{o.name}</span>
                                        <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                                            {o.department}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 mb-2">
                                        <span className="font-semibold text-gray-700">Place:</span> {o.place} | <span className="font-semibold text-gray-700">Date:</span> {o.date}
                                    </div>
                                    <div className="text-sm text-gray-700 italic bg-white p-3 rounded-lg border border-gray-100">
                                        "{o.purpose}"
                                    </div>
                                    {o.document_path && (
                                        <div className="mt-3 p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-4 max-w-md shadow-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <FileText className="w-8 h-8 text-blue-500 flex-shrink-0" />
                                                <div className="overflow-hidden">
                                                    <p className="text-xs font-bold text-gray-700 truncate" title={o.document_name}>
                                                        {o.document_name}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400">
                                                        Uploaded: {o.uploaded_at ? new Date(o.uploaded_at).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <a
                                                    href={`/api/requests/od/view/${o.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                                    title="View Document"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </a>
                                                <a
                                                    href={`/api/requests/od/download/${o.id}`}
                                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                                    title="Download Document"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Status:</span>
                                        <span className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${getStatusBadgeClass(o.status)}`}>
                                            {o.status || 'PENDING'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                                    {o.status !== 'approved' && (
                                        <button
                                            onClick={() => updateOdStatus(o.id, 'approved')}
                                            className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 active:scale-95 transition whitespace-nowrap"
                                        >
                                            ✓ Approve
                                        </button>
                                    )}
                                    {o.status !== 'rejected' && (
                                        <button
                                            onClick={() => updateOdStatus(o.id, 'rejected')}
                                            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 active:scale-95 transition whitespace-nowrap"
                                        >
                                            ✕ Reject
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteRequest(o.id, o.date)}
                                        className="px-4 py-2 text-sm font-semibold text-white bg-gray-600 rounded-lg hover:bg-gray-700 active:scale-95 transition whitespace-nowrap"
                                    >
                                        🗑 Clear
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default ODRequests;
