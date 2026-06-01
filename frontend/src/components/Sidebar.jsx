import { Link, useLocation } from 'react-router-dom';
import { Home, MapPin, Calendar, FileText, BarChart, LogOut, X, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const { logout, user } = useAuth();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    // Use the teal color from the screenshot
    const sidebarBg = 'bg-[#0a93ad]';
    const activeBg = 'bg-[#007b8a]';
    const hoverBg = 'hover:bg-[#007b8a]';
    const textColor = 'text-white';

    const isPrincipal = user?.role?.toLowerCase() === 'hoi' || user?.role?.toLowerCase() === 'principal';
    const isAdmin = user?.role?.toLowerCase() === 'admin';

    const links = [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
    ];

    if (isPrincipal) {
        links.push({ name: 'Attendance', path: '/attendance', icon: MapPin });
        links.push({ name: 'Leave Requests', path: '/leaves', icon: Calendar });
        links.push({ name: 'OD Requests', path: '/od', icon: FileText });
        links.push({ name: 'Reports', path: '/reports', icon: BarChart });
        links.push({ name: 'Profile', path: '/profile', icon: User });
    } else if (isAdmin) {
        links.push({ name: 'Leave Requests', path: '/leave-requests', icon: Calendar });
        links.push({ name: 'OD Requests', path: '/od-requests', icon: FileText });
        links.push({ name: 'Reports', path: '/reports', icon: BarChart });
    } else {
        links.push({ name: 'Attendance', path: '/attendance', icon: MapPin });
        links.push({ name: 'Leave Requests', path: '/leaves', icon: Calendar });
        links.push({ name: 'OD Requests', path: '/od', icon: FileText });
    }

    return (
        <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 ${sidebarBg} transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-0`}>
            {/* Header / Logo */}
            <div className="flex items-center justify-between px-6 py-6 h-20">
                <h2 className="text-3xl font-bold text-white tracking-tight">CLE Staff</h2>
                <button onClick={toggleSidebar} className="text-white md:hidden">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Profile Section */}
            <div className="px-4 mb-4">
                <div className="p-4 bg-white bg-opacity-10 rounded-xl">
                    <p className="text-white font-bold leading-tight">{user?.name || 'User'}</p>
                    <p className="text-white text-xs opacity-80 uppercase mt-1 tracking-wider">{user?.role || 'Guest'}</p>
                </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                {links.map((link) => (
                    <Link
                        key={link.name}
                        to={link.path}
                        onClick={() => window.innerWidth < 768 && toggleSidebar()}
                        className={`flex items-center px-4 py-3 text-white transition-all duration-200 rounded-xl ${hoverBg} ${isActive(link.path) ? activeBg : ''
                            }`}
                    >
                        <link.icon className={`w-5 h-5 ${isActive(link.path) ? 'opacity-100' : 'opacity-70'}`} />
                        <span className="mx-4 font-semibold">{link.name}</span>
                    </Link>
                ))}
            </nav>

            {/* Logout at Bottom */}
            <div className="px-4 py-6 mt-auto">
                <button
                    onClick={logout}
                    className="flex items-center justify-center w-full px-4 py-4 font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all shadow-lg active:scale-95"
                >
                    <LogOut className="w-5 h-5 mr-3" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
