import React from 'react';
import { useNavigate } from 'react-router-dom';
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
 * - Authenticated user avatar indicator (clickable on mobile to navigate to /profile)
 */
const Header = ({ toggleSidebar, className = '' }) => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleAvatarClick = () => {
        // Mobile-only behaviour: navigate to profile when tapped on mobile screens (< 768px)
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            navigate('/profile');
        }
    };

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
                <button
                    type="button"
                    onClick={handleAvatarClick}
                    data-testid="header-user-avatar-btn"
                    title={user.name ? `${user.name} (Tap to view profile)` : 'View Profile'}
                    aria-label="View Profile"
                    className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm flex-shrink-0 ml-2 select-none overflow-hidden transition-all duration-150 cursor-pointer active:scale-95 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 md:cursor-default md:hover:bg-blue-600 md:active:scale-100"
                >
                    {user.photo || user.avatar || user.profile_photo ? (
                        <img 
                            src={user.photo || user.avatar || user.profile_photo} 
                            alt={user.name || 'User'} 
                            className="w-full h-full object-cover" 
                        />
                    ) : (
                        <span>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                    )}
                </button>
            )}
        </header>
    );
};

export default Header;
