import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import CleLogo from './CleLogo';
import { useAuth } from '../context/AuthContext';
import ToastContainer from './ToastContainer';

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { user } = useAuth();

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
            {/* Sidebar Navigation */}
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 w-full min-w-0 relative">
                {/* Mobile Header (Hamburger Menu & Branding) */}
                <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200/80 md:hidden shadow-sm z-30">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleSidebar}
                            aria-label="Open navigation menu"
                            className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none hover:bg-slate-100 rounded-xl transition-colors active:scale-95"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <CleLogo size="sm" />
                    </div>

                    {user && (
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                    )}
                </header>

                {/* Main scrollable content container */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f8fafc] custom-scrollbar">
                    <div className="container px-4 py-6 mx-auto sm:px-6 md:px-8 max-w-7xl">
                        {children}
                    </div>
                </main>

                {/* Floating Toast Notifications */}
                <ToastContainer />

                {/* Sidebar Overlay for Mobile */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 md:hidden"
                        onClick={toggleSidebar}
                        aria-hidden="true"
                    />
                )}
            </div>
        </div>
    );
};

export default Layout;
