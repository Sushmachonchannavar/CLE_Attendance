import React from 'react';
import { Menu } from 'lucide-react';
import CleLogo from './CleLogo';
import { useAuth } from '../context/AuthContext';

/**
 * Shared Header Component for CLE Society – Staff Attendance & Location System.
 * Fully responsive across mobile, tablet, and desktop screens.
 * Features:
 * - CLE Society crest logo on the left (proportional, non-distorted)
 * - "CLE SOCIETY" bold golden-yellow heading
 * - "Staff Attendance & Location System" clear light-grey subtitle
 * - Dark navy-blue header background (#0b1329)
 * - Mobile hamburger navigation trigger
 * - Authenticated user avatar indicator
 */
const Header = ({ toggleSidebar, className = '' }) => {
    const { user } = useAuth();

    return (
        <header
            role="banner"
            className={`flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 bg-[#0b1329] border-b border-slate-800 shadow-md z-30 min-w-0 ${className}`}
        >
            {/* Left: Mobile Navigation Trigger + CLE Society Institutional Branding */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
                {toggleSidebar && (
                    <button
                        onClick={toggleSidebar}
                        type="button"
                        aria-label="Open navigation menu"
                        className="p-1.5 sm:p-2 text-slate-300 hover:text-white focus:outline-none hover:bg-slate-800 rounded-xl transition-colors active:scale-95 shrink-0 md:hidden"
                    >
                        <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                )}

                <div className="min-w-0 flex-1 flex items-center">
                    <CleLogo size="sm" variant="light" className="max-w-full" />
                </div>
            </div>

            {/* Right: Authenticated Staff Avatar */}
            {user && (
                <div
                    title={user.name || 'Authorized User'}
                    className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm flex-shrink-0 ml-2 select-none"
                >
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
            )}
        </header>
    );
};

export default Header;
