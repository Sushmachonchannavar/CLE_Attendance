/*import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
    const { user } = useAuth();

    // Determine background color based on user role
    const getBackgroundColor = () => {
        if (!user) return 'bg-gray-100';
        
        const role = user.role?.toLowerCase();
        if (role === 'admin') return 'bg-cyan-50';
        if (role === 'hoi' || role === 'principal') return 'bg-cyan-50';
        if (role === 'staff') return 'bg-gray-50';
        
        return 'bg-gray-100';
    };

    // Determine header/accent color based on user role
    const getThemeColor = () => {
        if (!user) return 'indigo';
        
        const role = user.role?.toLowerCase();
        if (role === 'admin' || role === 'hoi' || role === 'principal') return 'orange';
        if (role === 'staff') return 'indigo';
        
        return 'indigo';
    };

    return (
        <div className={`flex h-screen ${getBackgroundColor()} font-roboto`} style={{ '--theme-color': getThemeColor() }}>
            <Sidebar />
            <div className="flex-1 overflow-x-hidden overflow-y-auto">
                <div className="container px-6 py-8 mx-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Layout;*/

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            {/* Sidebar Component */}
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 w-full relative">

                {/* Mobile Header (Hamburger Menu) */}
                <header className="flex items-center justify-between px-6 py-4 bg-white border-b md:hidden shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleSidebar}
                            className="p-2 text-gray-600 focus:outline-none hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <span className="text-xl font-bold text-[#0a93ad]">CLE Staff</span>
                    </div>
                </header>

                {/* Main scrollable content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f8fafc]">
                    <div className="container px-4 py-8 mx-auto md:px-10">
                        {children}
                    </div>
                </main>

                {/* Sidebar Overlay for Mobile */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity duration-300 md:hidden"
                        onClick={toggleSidebar}
                    />
                )}
            </div>
        </div>
    );
};

export default Layout;
