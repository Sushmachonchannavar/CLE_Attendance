import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Plus, X, Trash2 } from 'lucide-react';

const Leaves = () => {
    const [leaves, setLeaves] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        type: 'sick',
        start_date: '',
        end_date: '',
        reason: ''
    });

    const fetchLeaves = async () => {
        try {
            const res = await api.get('/requests/leaves');
            setLeaves(res.data);
        } catch (err) {
            console.error("Failed to fetch leaves", err);
        }
    };

    useEffect(() => {
        fetchLeaves();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
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

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    return (
        <Layout>
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-3xl font-medium text-gray-700">Leave Management</h3>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Apply Leave
                </button>
            </div>

            <div className="overflow-hidden bg-white rounded-lg shadow-md">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Type</th>
                            <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Dates</th>
                            <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Reason</th>
                            <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Status</th>
                            <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaves.map((leave) => (
                            <tr key={leave.id}>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <p className="text-gray-900 whitespace-no-wrap capitalize">{leave.type}</p>
                                </td>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <p className="text-gray-900 whitespace-no-wrap">
                                        {leave.start_date} to {leave.end_date}
                                    </p>
                                </td>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <p className="text-gray-900 whitespace-no-wrap">{leave.reason}</p>
                                </td>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <span className={`relative inline-block px-3 py-1 font-semibold leading-tight rounded-full ${getStatusColor(leave.status)}`}>
                                        <span aria-hidden="true" className="absolute inset-0 opacity-50 rounded-full"></span>
                                        <span className="relative capitalize">{leave.status}</span>
                                    </span>
                                </td>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <button
                                        onClick={() => handleDelete(leave.id)}
                                        className="text-red-500 hover:text-red-700 transition"
                                        title="Clear Application"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {leaves.length === 0 && (
                            <tr>
                                <td colSpan="4" className="px-5 py-5 text-sm bg-white border-b border-gray-200 text-center">
                                    No leave requests found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>


            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none bg-black bg-opacity-50">
                    <div className="relative w-full max-w-md mx-auto my-6">
                        <div className="relative flex flex-col w-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none">
                            <div className="flex items-start justify-between p-5 border-b border-solid rounded-t border-blueGray-200">
                                <h3 className="text-2xl font-semibold">Apply for Leave</h3>
                                <button
                                    className="float-right p-1 ml-auto text-3xl font-semibold leading-none text-black bg-transparent border-0 outline-none opacity-5 hover:opacity-100 focus:outline-none"
                                    onClick={() => setShowModal(false)}
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="relative flex-auto p-6">
                                <form onSubmit={handleSubmit}>
                                    <div className="mb-4">
                                        <label className="block mb-2 text-sm font-bold text-gray-700">Leave Type</label>
                                        <select
                                            className="w-full px-3 py-2 border rounded shadow focus:outline-none"
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        >
                                            <option value="sick">Sick Leave</option>
                                            <option value="casual">Casual Leave</option>
                                            <option value="earned">Earned Leave</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-2 text-sm font-bold text-gray-700">Start Date</label>
                                            <input
                                                type="date"
                                                className="w-full px-3 py-2 border rounded shadow focus:outline-none"
                                                value={formData.start_date}
                                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block mb-2 text-sm font-bold text-gray-700">End Date</label>
                                            <input
                                                type="date"
                                                className="w-full px-3 py-2 border rounded shadow focus:outline-none"
                                                value={formData.end_date}
                                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-2 text-sm font-bold text-gray-700">Reason</label>
                                        <textarea
                                            className="w-full px-3 py-2 border rounded shadow focus:outline-none"
                                            rows="3"
                                            value={formData.reason}
                                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                            required
                                        ></textarea>
                                    </div>
                                    <div className="flex items-center justify-end">
                                        <button
                                            className="px-6 py-2 mb-1 mr-1 text-sm font-bold text-red-500 uppercase transition-all duration-150 ease-linear outline-none background-transparent focus:outline-none"
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                        >
                                            Close
                                        </button>
                                        <button
                                            className="px-6 py-3 mb-1 mr-1 text-sm font-bold text-white uppercase transition-all duration-150 ease-linear bg-blue-500 rounded shadow outline-none active:bg-blue-600 hover:shadow-lg focus:outline-none"
                                            type="submit"
                                        >
                                            Submit
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Leaves;

/*import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Plus, X, Calendar, Info } from 'lucide-react';

const Leaves = () => {
    const [leaves, setLeaves] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        type: 'sick',
        start_date: '',
        end_date: '',
        reason: ''
    });

    useEffect(() => {
        fetchLeaves();
    }, []);

    const fetchLeaves = async () => {
        try {
            const res = await api.get('/requests/leaves');
            setLeaves(res.data || []);
        } catch (err) {
            console.error("Failed to fetch leaves", err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/requests/leaves', formData);
            setShowModal(false);
            setFormData({ type: 'sick', start_date: '', end_date: '', reason: '' });
            alert('Leave applied successfully!');
            fetchLeaves();
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message || "Failed";
            alert(`Error: ${errorMessage}`);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-700 border-green-200';
            case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        }
    };

    return (
        <Layout>
           
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-800">Leave Management</h3>
                    <p className="text-sm text-gray-500 mt-1">Track and apply for your leaves</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-3 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Apply Leave
                </button>
            </div>

            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {leaves.length > 0 ? (
                    leaves.map((leave) => (
                        <div key={leave.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-4">
                                <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-600 rounded-lg">
                                    {leave.type}
                                </span>
                                <span className={`px-3 py-1 text-xs font-bold uppercase border rounded-lg ${getStatusColor(leave.status)}`}>
                                    {leave.status}
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center text-gray-700">
                                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                                    <span className="text-sm font-medium">{leave.start_date}</span>
                                    <span className="mx-2 text-gray-400">→</span>
                                    <span className="text-sm font-medium">{leave.end_date}</span>
                                </div>
                                
                                <div className="flex items-start text-gray-600 bg-gray-50 p-3 rounded-xl">
                                    <Info className="w-4 h-4 mr-2 mt-0.5 text-gray-400 shrink-0" />
                                    <p className="text-sm italic">"{leave.reason}"</p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-400">No leave requests found.</p>
                    </div>
                )}
            </div>

          
            {showModal && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
                       
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-xl font-bold text-gray-800">New Leave Request</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block mb-2 text-sm font-bold text-gray-700">Leave Type</label>
                                <select
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
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
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                                        value={formData.start_date}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-bold text-gray-700">End Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                                        value={formData.end_date}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-bold text-gray-700">Reason for Leave</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                                    rows="4"
                                    placeholder="Explain your reason here..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    required
                                ></textarea>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="w-full sm:order-2 px-6 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                                >
                                    Submit Application
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="w-full sm:order-1 px-6 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                                >
                                    Cancel
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
*/