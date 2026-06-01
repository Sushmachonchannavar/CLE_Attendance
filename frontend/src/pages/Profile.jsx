import React from 'react';
import Layout from '../components/Layout';
import AttendancePanel from '../components/AttendancePanel';
import { useAuth } from '../context/AuthContext';
import { User, Phone, Shield, Landmark, BookOpen } from 'lucide-react';

const Profile = () => {
    const { user } = useAuth();

    return (
        <Layout>
            <div className="mb-6 p-6 rounded-2xl text-white shadow-lg bg-gradient-to-r from-[#0a93ad] to-[#007b8a]">
                <h2 className="text-3xl font-bold">User Profile</h2>
                <p className="text-sm opacity-90 mt-1 uppercase tracking-wider font-semibold">
                    Manage your account details and daily attendance
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Information Card */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-150 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-teal-50 text-[#0a93ad] rounded-xl">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Personal Info</h3>
                                <p className="text-sm text-gray-500">Your account identity details</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Full Name */}
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                                <User className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Full Name</p>
                                    <p className="text-sm font-semibold text-gray-700">{user?.name || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Mobile Number */}
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                                <Phone className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Mobile Number</p>
                                    <p className="text-sm font-semibold text-gray-700">+91 {user?.phone || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Access Role */}
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                                <Shield className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Access Level / Role</p>
                                    <span className="inline-block mt-0.5 px-2.5 py-0.5 text-xs font-bold text-teal-800 bg-teal-100 border border-teal-200 rounded-full capitalize">
                                        {user?.role === 'hoi' ? 'Principal' : user?.role || 'Guest'}
                                    </span>
                                </div>
                            </div>

                            {/* College / Institution */}
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                                <Landmark className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Institution / College</p>
                                    <p className="text-sm font-semibold text-gray-700">{user?.college || 'Institution of Technology'}</p>
                                </div>
                            </div>

                            {/* Department */}
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                                <BookOpen className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Department</p>
                                    <p className="text-sm font-semibold text-gray-700">{user?.department || 'Administration'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 text-center text-xs text-gray-400 font-semibold border-t pt-4">
                        Staff Attendance Management System
                    </div>
                </div>

                {/* Attendance Geofence Panel */}
                <div className="lg:col-span-2">
                    <AttendancePanel />
                </div>
            </div>
        </Layout>
    );
};

export default Profile;
