import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from './ToastContainer';

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
                <Header toggleSidebar={toggleSidebar} className="md:hidden" />

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
