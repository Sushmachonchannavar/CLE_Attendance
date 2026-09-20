import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, MapPin, Calendar, FileText, BarChart, LogOut, X, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CleLogo from './CleLogo';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const { logout, user } = useAuth();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const role = user?.role?.toLowerCase();
    const isPrincipal = role === 'hoi' || role === 'principal';
    const isAdmin = role === 'admin';

    const links = [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
    ];

    if (isPrincipal) {
        links.push({ name: 'Attendance', path: '/attendance', icon: MapPin });
        links.push({ name: 'Staff Leave Requests', path: '/leave-requests', icon: Calendar });
        links.push({ name: 'Staff OD Requests', path: '/od-requests', icon: FileText });
        links.push({ name: 'Leave Requests', path: '/leaves', icon: Calendar });
        links.push({ name: 'OD Requests', path: '/od', icon: FileText });
        links.push({ name: 'Reports', path: '/reports', icon: BarChart });
        links.push({ name: 'Profile', path: '/profile', icon: User });
    } else if (isAdmin) {
        links.push({ name: 'Staff Leave Requests', path: '/leave-requests', icon: Calendar });
        links.push({ name: 'Staff OD Requests', path: '/od-requests', icon: FileText });
        links.push({ name: 'Location Tracking', path: '/admin/tracking', icon: MapPin });
        links.push({ name: 'Reports', path: '/reports', icon: BarChart });
    } else {
        links.push({ name: 'Attendance', path: '/attendance', icon: MapPin });
        links.push({ name: 'Leave Requests', path: '/leaves', icon: Calendar });
        links.push({ name: 'OD Requests', path: '/od', icon: FileText });
    }

    const roleBadgeText = isPrincipal ? 'Principal / HOI' : isAdmin ? 'Administrator' : 'Faculty / Staff';

    return (
        <aside
            aria-label="Main Navigation"
            className={`fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-[#0b1329] border-r border-slate-800/80 transition-transform duration-300 transform ${
                isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
            } md:translate-x-0 md:static md:inset-0`}
        >
            {/* Header / Institutional Branding */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80">
                <CleLogo size="sm" variant="light" />
                <button
                    onClick={toggleSidebar}
                    aria-label="Close navigation"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors md:hidden"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Profile Section */}
            <div className="px-5 py-4">
                <div className="p-3.5 bg-gradient-to-br from-slate-800/80 to-slate-900/90 rounded-2xl border border-slate-750/50 shadow-inner flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-blue-500/20 flex-shrink-0">
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="overflow-hidden min-w-0">
                        <p className="text-white text-sm font-bold truncate leading-snug">
                            {user?.name || 'Authorized User'}
                        </p>
                        <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 rounded-full border border-amber-500/20">
                            {roleBadgeText}
                        </span>
                    </div>
                </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar pt-2">
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Menu Navigation
                </p>
                {links.map((link) => {
                    const active = isActive(link.path);
                    const isHighlightCyan = isPrincipal || isAdmin;
                    return (
                        <Link
                            key={link.name}
                            to={link.path}
                            onClick={() => window.innerWidth < 768 && toggleSidebar && toggleSidebar()}
                            className={`flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group ${
                                active
                                    ? isHighlightCyan
                                        ? 'bg-[#00cccc] text-slate-900 font-bold shadow-lg shadow-[#00cccc]/25'
                                        : 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                    : isHighlightCyan
                                        ? 'text-slate-300 hover:bg-[#00cccc]/10 hover:text-[#00cccc]'
                                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                            }`}
                        >
                            <link.icon
                                className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                                    active
                                        ? isHighlightCyan ? 'text-slate-900' : 'text-white'
                                        : isHighlightCyan ? 'text-slate-400 group-hover:text-[#00cccc]' : 'text-slate-400 group-hover:text-blue-400'
                                }`}
                            />
                            <span className="mx-3.5 tracking-wide">{link.name}</span>
                            {active && (
                                <span className={`ml-auto w-1.5 h-4 rounded-full shadow-sm ${
                                    isHighlightCyan ? 'bg-slate-900 shadow-slate-900/40' : 'bg-amber-400 shadow-amber-400/50'
                                }`} />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* System Status / Campus Notice Footer */}
            <div className="px-5 py-3 border-t border-slate-800/80 bg-[#080e1f]/60">
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>CLE Geofence Active</span>
                </div>
            </div>

            {/* Logout at Bottom */}
            <div className="p-4 border-t border-slate-800/80">
                <button
                    onClick={logout}
                    className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-600 hover:text-white transition-all duration-200 shadow-sm active:scale-[0.98] group"
                >
                    <LogOut className="w-4 h-4 mr-2.5 transition-transform group-hover:-translate-x-0.5" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
