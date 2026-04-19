import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';

const Reports = () => {
    const [activeTab, setActiveTab] = useState('daily');
    const [reportData, setReportData] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    const fetchReport = async () => {
        try {
            let res;
            if (activeTab === 'daily') {
                res = await api.get(`/reports/daily?date=${date}`);
                setReportData(res.data.report);
            } else {
                res = await api.get(`/reports/monthly?month=${month}&year=${year}`);
                setReportData(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch report", err);
            setReportData([]);
        }
    };

    const downloadExcel = async () => {
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
        }
    };

    useEffect(() => {
        fetchReport();
    }, [activeTab, date, month, year]);

    return (
        <Layout>
            <h3 className="mb-6 text-3xl font-medium text-gray-700">Reports</h3>

            <div className="mb-6">
                <div className="flex border-b">
                    <button
                        className={`py-2 px-4 ${activeTab === 'daily' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
                        onClick={() => setActiveTab('daily')}
                    >
                        Daily Report
                    </button>
                    <button
                        className={`py-2 px-4 ${activeTab === 'monthly' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
                        onClick={() => setActiveTab('monthly')}
                    >
                        Monthly Report
                    </button>
                </div>
            </div>

            <div className="mb-6">
                {activeTab === 'daily' ? (
                    <div className="flex items-center">
                        <span className="mr-2">Select Date:</span>
                        <input
                            type="date"
                            className="px-3 py-2 border rounded"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                ) : (
                    <div className="flex items-center space-x-4">
                        <div>
                            <span className="mr-2">Month:</span>
                            <input
                                type="number"
                                min="1"
                                max="12"
                                className="px-3 py-2 border rounded"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                            />
                        </div>
                        <div>
                            <span className="mr-2">Year:</span>
                            <input
                                type="number"
                                min="2020"
                                max="2030"
                                className="px-3 py-2 border rounded"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={downloadExcel}
                            className="px-4 py-2 text-white bg-green-500 rounded hover:bg-green-600"
                        >
                            Download Excel
                        </button>
                    </div>
                )}
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full leading-normal">
                    <thead>
                        {activeTab === 'daily' ? (
                            <tr>
                                <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Name</th>
                                <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Status</th>
                                <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">In Time</th>
                                <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Out Time</th>
                                <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Details</th>
                            </tr>
                        ) : (
                            <tr>
                                <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Name</th>
                                <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Date</th>
                                <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">In Time</th>
                                <th className="px-5 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase bg-gray-100 border-b-2 border-gray-200">Out Time</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {reportData.map((row, index) => (
                            <tr key={index}>
                                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">{row.name}</td>
                                {activeTab === 'daily' ? (
                                    <>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200 capitalize">{row.status}</td>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">{row.punch_in}</td>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">{row.punch_out}</td>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                                            {row.status === 'leave' ? row.leave_reason : row.status === 'od' ? row.od_purpose : row.location}
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">{row.date}</td>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">{row.punch_in_time}</td>
                                        <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">{row.punch_out_time}</td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {reportData.length === 0 && (
                            <tr>
                                <td colSpan={activeTab === 'daily' ? 5 : 4} className="px-5 py-5 text-sm bg-white border-b border-gray-200 text-center">
                                    No data available.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
};

export default Reports;
