import CleLogo from './CleLogo';

export default function LoadingScreen({ message = 'Verifying authenticated session...' }) {
    return (
        <div className="fixed inset-0 z-50 min-h-screen bg-gradient-to-br from-[#0a1b42] via-[#0d2258] to-[#06112c] flex flex-col justify-center items-center px-4 relative overflow-hidden font-sans">
            {/* Ambient Lighting Orbs */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center max-w-sm text-center">
                {/* Emblem */}
                <div className="mb-6 transform transition duration-500 hover:scale-105">
                    <CleLogo size="lg" variant="light" layout="vertical" />
                </div>

                {/* Spinner */}
                <div className="relative flex items-center justify-center mb-4">
                    <div className="w-12 h-12 rounded-full border-2 border-indigo-400/20 border-t-indigo-400 animate-spin" />
                    <div className="absolute w-8 h-8 rounded-full border-2 border-amber-400/20 border-b-amber-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.2s' }} />
                </div>

                {/* Text Status */}
                <p className="text-sm font-medium text-slate-200 tracking-wide animate-pulse">
                    {message}
                </p>
                <span className="text-[11px] text-slate-400 font-mono mt-1">
                    C.L.E. Society Attendance System
                </span>
            </div>
        </div>
    );
}

