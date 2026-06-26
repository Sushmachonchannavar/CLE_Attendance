import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Plus, X, Trash2, UploadCloud, FileText, Eye, Download } from 'lucide-react';

const OD = () => {
    const [ods, setOds] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        purpose: '',
        place: '',
        date: ''
    });

    // File upload states
    const [selectedFile, setSelectedFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // Details modal states
    const [selectedOd, setSelectedOd] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

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

    const handleFileChange = (file) => {
        if (!file) return;
        
        // Size validation: 100 MB
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            alert("File size exceeds 100 MB limit.");
            return;
        }

        // Type/Extension validation: PDF, JPG, JPEG, PNG
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        const isTypeValid = allowedTypes.includes(file.type) || allowedExts.includes(fileExt);
        if (!isTypeValid) {
            alert("Invalid file format. Only PDF, JPG, JPEG, and PNG files are allowed.");
            return;
        }

        setSelectedFile(file);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedFile) {
            alert('Please upload a Supporting Document.');
            return;
        }

        const data = new FormData();
        data.append('date', formData.date);
        data.append('place', formData.place);
        data.append('purpose', formData.purpose);
        data.append('document', selectedFile);

        setIsUploading(true);
        setUploadProgress(0);

        try {
            await api.post('/requests/od', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });
            setShowModal(false);
            fetchOds();
            setFormData({ purpose: '', place: '', date: '' });
            setSelectedFile(null);
            alert('OD applied successfully!');
        } catch (err) {
            console.error("Failed to apply OD", err);
            const errorMessage = err.response?.data?.error || err.message || "Failed to apply OD";
            alert(`Error: ${errorMessage}`);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
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
                                    <p className="text-gray-900 whitespace-no-wrap truncate max-w-xs">{od.purpose}</p>
                                </td>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                    <span className={`relative inline-block px-3 py-1 font-semibold leading-tight rounded-full ${getStatusColor(od.status)}`}>
                                        <span aria-hidden="true" className="absolute inset-0 opacity-50 rounded-full"></span>
                                        <span className="relative capitalize">{od.status}</span>
                                    </span>
                                </td>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200 flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setSelectedOd(od);
                                            setShowDetailsModal(true);
                                        }}
                                        className="text-blue-500 hover:text-blue-700 font-semibold flex items-center text-sm transition"
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4 mr-1" />
                                        Details
                                    </button>
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
            
            {/* Submit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none bg-black bg-opacity-50">
                    <div className="relative w-full max-w-md mx-auto my-6 p-4">
                        <div className="relative flex flex-col w-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none">
                            <div className="flex items-start justify-between p-5 border-b border-solid rounded-t border-blueGray-200">
                                <h3 className="text-2xl font-semibold">Apply for OD</h3>
                                <button
                                    className="float-right p-1 ml-auto text-3xl font-semibold leading-none text-black bg-transparent border-0 outline-none opacity-5 hover:opacity-100 focus:outline-none"
                                    onClick={() => {
                                        if (isUploading) return;
                                        setShowModal(false);
                                        setSelectedFile(null);
                                    }}
                                    disabled={isUploading}
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
                                            disabled={isUploading}
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
                                            disabled={isUploading}
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
                                            disabled={isUploading}
                                        ></textarea>
                                    </div>

                                    {/* Drag and Drop Zone */}
                                    <div className="mb-4">
                                        <label className="block mb-2 text-sm font-bold text-gray-700">Supporting Document *</label>
                                        <div
                                            onDragEnter={handleDrag}
                                            onDragOver={handleDrag}
                                            onDragLeave={handleDrag}
                                            onDrop={handleDrop}
                                            className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer ${
                                                isUploading ? 'opacity-50 pointer-events-none' : ''
                                            } ${
                                                dragActive 
                                                    ? 'border-blue-500 bg-blue-50 bg-opacity-50' 
                                                    : 'border-gray-300 hover:border-blue-500 bg-gray-50'
                                            }`}
                                            onClick={() => {
                                                if (isUploading) return;
                                                document.getElementById('file-upload').click();
                                            }}
                                        >
                                            <input
                                                id="file-upload"
                                                type="file"
                                                className="hidden"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        handleFileChange(e.target.files[0]);
                                                    }
                                                }}
                                                disabled={isUploading}
                                            />
                                            
                                            {selectedFile ? (
                                                <div className="flex flex-col items-center text-center">
                                                    <FileText className="w-10 h-10 text-blue-500 mb-2" />
                                                    <span className="font-semibold text-sm text-gray-700 mb-1 max-w-[200px] truncate">{selectedFile.name}</span>
                                                    <span className="text-xs text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedFile(null);
                                                        }}
                                                        className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold"
                                                    >
                                                        Remove File
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-center">
                                                    <UploadCloud className="w-10 h-10 text-gray-400 mb-2" />
                                                    <p className="text-sm font-semibold text-gray-600">Drag & drop file here, or <span className="text-blue-500 underline">browse</span></p>
                                                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, JPEG, or PNG up to 100MB</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Upload Progress Bar */}
                                    {isUploading && (
                                        <div className="mb-4">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-xs font-semibold text-blue-500">Uploading...</span>
                                                <span className="text-xs font-semibold text-blue-500">{uploadProgress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-end border-t border-gray-150 pt-4 mt-2">
                                        <button
                                            className="px-6 py-2 mb-1 mr-1 text-sm font-bold text-red-500 uppercase transition-all duration-150 ease-linear outline-none background-transparent focus:outline-none"
                                            type="button"
                                            onClick={() => {
                                                if (isUploading) return;
                                                setShowModal(false);
                                                setSelectedFile(null);
                                            }}
                                            disabled={isUploading}
                                        >
                                            Close
                                        </button>
                                        <button
                                            className="px-6 py-3 mb-1 mr-1 text-sm font-bold text-white uppercase transition-all duration-150 ease-linear bg-blue-500 rounded shadow outline-none active:bg-blue-600 hover:shadow-lg focus:outline-none flex items-center justify-center disabled:bg-blue-300"
                                            type="submit"
                                            disabled={isUploading}
                                        >
                                            {isUploading ? 'Submitting...' : 'Submit'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OD Details Modal */}
            {showDetailsModal && selectedOd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none bg-black bg-opacity-50">
                    <div className="relative w-full max-w-lg mx-auto my-6 p-4">
                        <div className="relative flex flex-col w-full bg-white border-0 rounded-xl shadow-2xl outline-none focus:outline-none overflow-hidden">
                            {/* Header */}
                            <div className="flex items-start justify-between p-5 border-b border-solid border-gray-100 bg-gray-50">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 font-sans">OD Request Details</h3>
                                    <p className="text-xs text-gray-500 mt-1">Reference ID: #{selectedOd.id}</p>
                                </div>
                                <button
                                    className="p-1 ml-auto text-gray-400 hover:text-gray-600 transition"
                                    onClick={() => {
                                        setShowDetailsModal(false);
                                        setSelectedOd(null);
                                    }}
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            {/* Body */}
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-xs font-semibold text-gray-400 uppercase">Date</span>
                                        <span className="text-sm font-medium text-gray-800">{selectedOd.date}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs font-semibold text-gray-400 uppercase">Place</span>
                                        <span className="text-sm font-medium text-gray-800">{selectedOd.place}</span>
                                    </div>
                                </div>
                                
                                <div>
                                    <span className="block text-xs font-semibold text-gray-400 uppercase">Purpose</span>
                                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 mt-1 whitespace-pre-wrap">
                                        {selectedOd.purpose}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-xs font-semibold text-gray-400 uppercase">Status</span>
                                        <span className={`inline-block px-2.5 py-0.5 mt-1 text-xs font-bold uppercase rounded-full ${getStatusColor(selectedOd.status)}`}>
                                            {selectedOd.status}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-xs font-semibold text-gray-400 uppercase">Role</span>
                                        <span className="text-sm font-semibold text-gray-700 capitalize">{selectedOd.role?.toLowerCase() || 'staff'}</span>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 pt-4 mt-2">
                                    <span className="block text-sm font-bold text-gray-800 mb-2">Supporting Document</span>
                                    {selectedOd.document_path ? (
                                        <div className="p-4 bg-blue-50 bg-opacity-50 border border-blue-200 rounded-xl flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <FileText className="w-8 h-8 text-blue-500 flex-shrink-0" />
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-bold text-gray-700 truncate" title={selectedOd.document_name}>
                                                        {selectedOd.document_name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        Uploaded: {selectedOd.uploaded_at ? new Date(selectedOd.uploaded_at).toLocaleString() : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <a
                                                    href={`/api/requests/od/view/${selectedOd.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                                    title="View Document"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </a>
                                                <a
                                                    href={`/api/requests/od/download/${selectedOd.id}`}
                                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                                    title="Download Document"
                                                >
                                                    <Download className="w-5 h-5" />
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">No document uploaded.</p>
                                    )}
                                </div>
                            </div>
                            {/* Footer */}
                            <div className="flex items-center justify-end p-4 border-t border-solid border-gray-100 bg-gray-50">
                                <button
                                    className="px-6 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 uppercase transition"
                                    type="button"
                                    onClick={() => {
                                        setShowDetailsModal(false);
                                        setSelectedOd(null);
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default OD;
