import React from 'react';

const CleLogo = ({ size = 'md', className = '', variant = 'dark' }) => {
    // Dimensions map
    const sizes = {
        sm: { box: 32, text: 'text-base', sub: 'text-[9px]' },
        md: { box: 44, text: 'text-xl', sub: 'text-[10px]' },
        lg: { box: 56, text: 'text-2xl', sub: 'text-xs' },
        xl: { box: 72, text: 'text-3xl', sub: 'text-sm' }
    };

    const s = sizes[size] || sizes.md;
    const isLight = variant === 'light';

    return (
        <div className={`inline-flex items-center gap-3 select-none ${className}`}>
            {/* Crest Emblem SVG */}
            <div 
                className="relative flex items-center justify-center rounded-2xl shadow-md transition-transform duration-300 hover:scale-105 overflow-hidden flex-shrink-0"
                style={{
                    width: s.box,
                    height: s.box,
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)',
                    boxShadow: '0 4px 14px 0 rgba(30, 64, 175, 0.35)',
                    border: '1.5px solid rgba(251, 191, 36, 0.5)'
                }}
            >
                <svg 
                    viewBox="0 0 100 100" 
                    className="w-full h-full p-1.5"
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="CLE Society Crest"
                >
                    {/* Outer Laurel Garland Arc */}
                    <path
                        d="M20 50 C20 72, 35 85, 50 88 C65 85, 80 72, 80 50"
                        stroke="#f59e0b"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray="1 7"
                    />
                    
                    {/* Central Shield */}
                    <path
                        d="M50 16 L76 26 C76 56, 50 78, 50 78 C50 78, 24 56, 24 26 Z"
                        fill="url(#shieldGrad)"
                        stroke="#fbbf24"
                        strokeWidth="2.5"
                    />

                    {/* Book of Knowledge / Learning */}
                    <path
                        d="M36 50 C42 46, 48 48, 50 52 C52 48, 58 46, 64 50 L64 60 C58 56, 52 58, 50 62 C48 58, 42 56, 36 60 Z"
                        fill="#ffffff"
                        stroke="#d97706"
                        strokeWidth="1.5"
                    />
                    
                    {/* Torch of Enlightenment Flame */}
                    <path
                        d="M50 28 C53 33, 55 36, 53 40 C51 43, 49 43, 47 40 C45 36, 47 33, 50 28 Z"
                        fill="#f59e0b"
                    />
                    <circle cx="50" cy="38" r="2" fill="#ef4444" />

                    <defs>
                        <linearGradient id="shieldGrad" x1="24" y1="16" x2="76" y2="78" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#1e3a8a" />
                            <stop offset="1" stopColor="#0f172a" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            {/* Typography */}
            <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                    <span className={`font-display font-extrabold tracking-tight leading-none ${s.text} ${isLight ? 'text-white' : 'text-slate-900'}`}>
                        CLE <span className="text-amber-500 font-black">SOCIETY</span>
                    </span>
                </div>
                <span className={`font-semibold tracking-wider uppercase leading-none mt-1 ${s.sub} ${isLight ? 'text-blue-200' : 'text-slate-500'}`}>
                    Staff Attendance System
                </span>
            </div>
        </div>
    );
};

export default CleLogo;
