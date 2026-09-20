import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Plus, X, Trash2, UploadCloud, FileText, Eye, Download, Calendar, MapPin, Clock } from 'lucide-react';

const OD = () => {
    const [ods, setOds] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
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

    const fetchOds = useCallback(() => {
        setLoading(true);
        api.get('/requests/od')
            .then(res => {
                setOds(res.data || []);
            })
            .catch(err => {
                console.error("Failed to fetch ODs", err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        fetchOds();
    }, [fetchOds]);

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

    const handleViewDocument = async (id) => {
        try {
            const res = await api.get(`/requests/od/view/${id}`, { responseType: 'blob' });
            const contentType = res.headers['content-type'] || 'application/pdf';
            const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
            window.open(blobUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {
            console.error('Failed to view document:', err);
            alert('Failed to view document.');
        }
    };

    const handleDownloadDocument = async (id, documentName) => {
        try {
            const res = await api.get(`/requests/od/download/${id}`, { responseType: 'blob' });
            const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', documentName || `od-document-${id}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
        } catch (err) {
            console.error('Failed to download document:', err);
            alert('Failed to download document.');
        }
    };

    const getStatusBadge = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved': return { label: 'APPROVED', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'rejected': return { label: 'REJECTED', class: 'bg-rose-50 text-rose-700 border-rose-200' };
            default: return { label: 'PENDING', class: 'bg-amber-50 text-amber-700 border-amber-200' };
        }
    };

    return (
        <Layout>
            {/* Header Banner */}
            <div className="mb-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white shadow-xl shadow-blue-950/20 border border-blue-700/30 relative overflow-hidden">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                                <FileText className="w-3.5 h-3.5" />
                                Official Duty Portal
                            </span>
                        </div>
                        {/* Heading MUST match "OD Requests" for Playwright TC-UI-005 */}
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">OD Requests</h2>
                        <p className="text-blue-200/90 text-xs sm:text-sm mt-1">
                            Submit on-duty authorization applications with event documentation
                        </p>
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4" />
                        Apply OD
                    </button>
                </div>
            </div>

            {/* Main Log Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mr-3" />
                        <span className="text-slate-600 font-semibold text-sm">Loading OD applications...</span>
                    </div>
                ) : ods.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-500" />
                        <p className="font-semibold text-slate-600">No OD requests found.</p>
                        <p className="text-xs text-slate-400 mt-1">Click "Apply OD" above to submit an on-duty request.</p>
                    </div>
                ) : (
                    <div>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto custom-scrollbar">
                            <table className="min-w-full leading-normal border-collapse">
                                <thead>
                                    <tr>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50 rounded-l-2xl">Date</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Place / Location</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Purpose</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-left text-slate-500 uppercase bg-slate-50">Status</th>
                                        <th className="px-5 py-3.5 text-xs font-bold tracking-wider text-right text-slate-500 uppercase bg-slate-50 rounded-r-2xl">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {ods.map((od) => {
                                        const badge = getStatusBadge(od.status);
                                        return (
                                            <tr key={od.id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-5 py-4 text-sm font-bold text-slate-800">
                                                    {od.date}
                                                </td>
                                                <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                                                    {od.place}
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-600 max-w-xs truncate">
                                                    {od.purpose}
                                                </td>
                                                <td className="px-5 py-4 text-sm">
                                                    <span className={`inline-block px-3 py-1 text-[11px] font-extrabold uppercase rounded-full border ${badge.class}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-sm text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedOd(od);
                                                                setShowDetailsModal(true);
                                                            }}
                                                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition-colors font-bold text-xs flex items-center gap-1"
                                                            title="View Details"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                            Details
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(od.id)}
                                                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                                                            title="Clear Application"
                                                            aria-label="Clear Application"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Responsive Card View */}
                        <div className="md:hidden space-y-3">
                            {ods.map((od) => {
                                const badge = getStatusBadge(od.status);
                                return (
                                    <div key={od.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                                <MapPin className="w-4 h-4 text-blue-600" />
                                                {od.place}
                                            </span>
                                            <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${badge.class}`}>
                                                {badge.label}
                                            </span>
                                        </div>

                                        <div className="text-xs text-slate-600 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Date: <strong>{od.date}</strong></span>
                                        </div>

                                        <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-150 italic">
                                            "{od.purpose}"
                                        </p>

                                        <div className="flex items-center justify-between pt-1">
                                            <button
                                                onClick={() => {
                                                    setSelectedOd(od);
                                                    setShowDetailsModal(true);
                                                }}
                                                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                View Document Details
                                            </button>
                                            <button
                                                onClick={() => handleDelete(od.id)}
                                                className="text-xs text-rose-600 font-bold flex items-center gap-1 hover:underline"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Apply OD Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => {
                            if (isUploading) return;
                            setShowModal(false);
                            setSelectedFile(null);
                        }}
                    />

                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-7 border border-slate-100 z-10 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Apply for Official Duty (OD)</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Submit request with verified supporting document</p>
                            </div>
                            <button
                                onClick={() => {
                                    if (isUploading) return;
                                    setShowModal(false);
                                    setSelectedFile(null);
                                }}
                                disabled={isUploading}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="od_date" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        OD Date
                                    </label>
                                    <input
                                        id="od_date"
                                        type="date"
                                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        required
                                        disabled={isUploading}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="od_place" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Location / Institution
                                    </label>
                                    <input
                                        id="od_place"
                                        type="text"
                                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={formData.place}
                                        onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                                        placeholder="e.g. VTU Headquarters, Belagavi"
                                        required
                                        disabled={isUploading}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="od_purpose" className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Duty Purpose & Details
                                </label>
                                <textarea
                                    id="od_purpose"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    rows="3"
                                    placeholder="Explain conference, valuation, exam duty, or academic purpose..."
                                    value={formData.purpose}
                                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                    required
                                    disabled={isUploading}
                                />
                            </div>

                            {/* Drag and Drop Zone */}
                            <div>
                                <label className="block mb-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Supporting Document (Required)
                                </label>
                                <div
                                    onDragEnter={handleDrag}
                                    onDragOver={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDrop={handleDrop}
                                    className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer ${
                                        isUploading ? 'opacity-50 pointer-events-none' : ''
                                    } ${
                                        dragActive
                                            ? 'border-blue-500 bg-blue-50/60'
                                            : 'border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/20'
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
                                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <span className="font-bold text-xs text-slate-800 max-w-[240px] truncate">{selectedFile.name}</span>
                                            <span className="text-[11px] text-slate-400 mt-0.5">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedFile(null);
                                                }}
                                                className="mt-2 text-xs text-rose-600 hover:text-rose-800 font-bold underline"
                                            >
                                                Change / Remove File
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-center">
                                            <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
                                            <p className="text-xs font-bold text-slate-700">Drag & drop document here, or <span className="text-blue-600 underline">browse</span></p>
                                            <p className="text-[10px] text-slate-400 mt-1 font-medium">PDF, JPG, JPEG, or PNG (Max limit 100MB)</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Upload Progress Bar */}
                            {isUploading && (
                                <div>
                                    <div className="flex justify-between mb-1 text-xs font-bold text-blue-600">
                                        <span>Uploading file...</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isUploading) return;
                                        setShowModal(false);
                                        setSelectedFile(null);
                                    }}
                                    disabled={isUploading}
                                    className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUploading}
                                    className="px-6 py-2.5 text-xs font-bold text-white uppercase tracking-wider bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isUploading ? 'Submitting...' : 'Submit OD'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* OD Details Modal */}
            {showDetailsModal && selectedOd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => {
                            setShowDetailsModal(false);
                            setSelectedOd(null);
                        }}
                    />

                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-7 border border-slate-100 z-10 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start justify-between pb-4 mb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">OD Request Details</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Application Reference ID: #{selectedOd.id}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowDetailsModal(false);
                                    setSelectedOd(null);
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</span>
                                    <span className="text-sm font-bold text-slate-800">{selectedOd.date}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</span>
                                    <span className="text-sm font-bold text-slate-800">{selectedOd.place}</span>
                                </div>
                            </div>

                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Purpose</span>
                                <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed whitespace-pre-wrap">
                                    {selectedOd.purpose}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                                    <span className={`inline-block px-2.5 py-0.5 mt-1 text-[10px] font-extrabold uppercase rounded-full border ${getStatusBadge(selectedOd.status).class}`}>
                                        {selectedOd.status}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</span>
                                    <span className="text-sm font-semibold text-slate-700 capitalize">{selectedOd.role?.toLowerCase() || 'staff'}</span>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-4 mt-2">
                                <span className="block text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">Supporting Documentation</span>
                                {selectedOd.document_path ? (
                                    <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
                                            <div className="overflow-hidden">
                                                <p className="text-xs font-bold text-slate-800 truncate" title={selectedOd.document_name}>
                                                    {selectedOd.document_name}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    Uploaded: {selectedOd.uploaded_at ? new Date(selectedOd.uploaded_at).toLocaleString() : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleViewDocument(selectedOd.id)}
                                                className="p-2 text-blue-600 hover:bg-blue-100/60 rounded-xl transition-colors"
                                                title="View Document"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadDocument(selectedOd.id, selectedOd.document_name)}
                                                className="p-2 text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                                                title="Download Document"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No document attached.</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end pt-5 mt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDetailsModal(false);
                                    setSelectedOd(null);
                                }}
                                className="px-5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 uppercase tracking-wider"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default OD;
