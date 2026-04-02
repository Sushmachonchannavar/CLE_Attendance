import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Plus, X, Trash2 } from 'lucide-react';

const OD = () => {
    const [ods, setOds] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        purpose: '',
        place: '',
        date: ''
    });

    const fetchOds = async () => {
        try {
            const res = await api.get('/requests/od');
            setOds(res.data);
        } catch (err) {
            console.error("Failed to fetch ODs", err);
        }
    };

    useEffect(() => {
        fetchOds();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/requests/od', formData);
            setShowModal(false);
            fetchOds();
            setFormData({ purpose: '', place: '', date: '' });
            alert('OD applied successfully!');
        } catch (err) {
            console.error("Failed to apply OD", err);
            const errorMessage = err.response?.data?.error || err.message || "Failed to apply OD";
            alert(`Error: ${errorMessage}`);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to clear this application?')) return;
        try {
            await api.delete(`/requests/od/${id}`);
            alert('Application cleared successfully!');
            fetchOds();
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
                <h3 className="text-3xl font-medium text-gray-700">OD Requests</h3>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Apply OD
                </button>
            </div>

            <div className="overflow-hidden bg-white rounded-lg shadow-md">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Date</th>
                            <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Place</th>
                            <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Purpose</th>
                            <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Status</th>
                            <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Action</th>


                        </tr>
                    </thead>
                    <tbody>
                        {ods.map((od) => (
                            <tr key={od.id}>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <p className="text-gray-900 whitespace-no-wrap">{od.date}</p>
                                </td>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <p className="text-gray-900 whitespace-no-wrap">{od.place}</p>
                                </td>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <p className="text-gray-900 whitespace-no-wrap">{od.purpose}</p>
                                </td>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <span className={`relative inline-block px-3 py-1 font-semibold leading-tight rounded-full ${getStatusColor(od.status)}`}>
                                        <span aria-hidden="true" className="absolute inset-0 opacity-50 rounded-full"></span>
                                        <span className="relative capitalize">{od.status}</span>
                                    </span>
                                </td>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <button
                                        onClick={() => handleDelete(od.id)}
                                        className="text-red-500 hover:text-red-700 transition"
                                        title="Clear Application"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {ods.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-5 py-5 text-sm bg-white border-b border-gray-200 text-center">
                                    No OD requests found.
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
                                <h3 className="text-2xl font-semibold">Apply for OD</h3>
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
                                        <label className="block mb-2 text-sm font-bold text-gray-700">Date</label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-2 border rounded shadow focus:outline-none"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-2 text-sm font-bold text-gray-700">Place</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border rounded shadow focus:outline-none"
                                            value={formData.place}
                                            onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-2 text-sm font-bold text-gray-700">Purpose</label>
                                        <textarea
                                            className="w-full px-3 py-2 border rounded shadow focus:outline-none"
                                            rows="3"
                                            value={formData.purpose}
                                            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
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

export default OD


