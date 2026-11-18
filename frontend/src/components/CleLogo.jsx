import React from 'react';
import cleLogoImg from '../assets/cle-logo.png';

const CleLogo = ({
    size = 'md',
    className = '',
    variant = 'dark',
    iconOnly = false,
    showText = true,
    layout = 'horizontal',
    subText = 'Staff Attendance & Location System',
    title = 'CLE SOCIETY'
}) => {
    // Dimensions map - balanced proportions for crest emblem
    const sizes = {
        xs: { img: 'h-7', text: 'text-xs', sub: 'text-[8px]' },
        sm: { img: 'h-9 sm:h-10', text: 'text-sm sm:text-base', sub: 'text-[9px] sm:text-[10px]' },
        md: { img: 'h-11 sm:h-12', text: 'text-base sm:text-lg', sub: 'text-[10px] sm:text-xs' },
        lg: { img: 'h-14 sm:h-16', text: 'text-xl sm:text-2xl', sub: 'text-xs sm:text-sm' },
        xl: { img: 'h-24 sm:h-28', text: 'text-3xl', sub: 'text-sm' },
        '2xl': { img: 'h-32', text: 'text-4xl', sub: 'text-base' }
    };

    const s = sizes[size] || sizes.md;
    const isLight = variant === 'light';
    const isVertical = layout === 'vertical';

    return (
        <div 
            className={`inline-flex ${isVertical ? 'flex-col items-center text-center gap-2' : 'items-center gap-2.5 sm:gap-3'} select-none group ${className}`}
        >
            {/* Official CLE Crest Emblem */}
            <div className="relative flex-shrink-0 flex items-center justify-center">
                {isLight && (
                    <div className="absolute -inset-1 bg-amber-400/20 rounded-full blur-md opacity-60 group-hover:opacity-100 transition duration-300 pointer-events-none" />
                )}
                <img
                    src={cleLogoImg}
                    alt="CLE Society Official Emblem"
                    className={`relative ${s.img} w-auto object-contain transition-transform duration-300 group-hover:scale-105 ${
                        isLight
                            ? 'drop-shadow-[0_4px_14px_rgba(251,191,36,0.35)]'
                            : 'drop-shadow-md'
                    }`}
                    loading="eager"
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/cle-logo.png';
                    }}
                />
            </div>

            {/* Typography */}
            {!iconOnly && showText && (
                <div className={`flex flex-col justify-center min-w-0 ${isVertical ? 'items-center text-center' : 'items-start text-left'}`}>
                    <div className="flex items-center">
                        <span className={`font-display font-black tracking-tight leading-none ${s.text} ${
                            isLight ? 'text-amber-400' : 'text-slate-900'
                        }`}>
                            {title}
                        </span>
                    </div>
                    <span className={`font-medium tracking-normal leading-tight mt-1 ${s.sub} ${
                        isLight ? 'text-slate-300' : 'text-slate-500'
                    } whitespace-nowrap`}>
                        {subText}
                    </span>
                </div>
            )}
        </div>
    );
};

export default CleLogo;
