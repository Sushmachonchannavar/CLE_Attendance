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
    // Proportional dimensions map for emblem and typography across device breakpoints
    const sizes = {
        xs: {
            img: 'h-6 sm:h-7',
            text: 'text-[11px] sm:text-xs',
            sub: 'text-[8px] sm:text-[9px]'
        },
        sm: {
            img: 'h-8 xs:h-9 md:h-10',
            text: 'text-xs xs:text-sm md:text-base',
            sub: 'text-[8.5px] xs:text-[9.5px] md:text-[10px]'
        },
        responsive: {
            img: 'h-8 xs:h-9 sm:h-10 md:h-11',
            text: 'text-xs xs:text-sm sm:text-base md:text-lg',
            sub: 'text-[8.5px] xs:text-[9.5px] sm:text-[10px] md:text-xs'
        },
        md: {
            img: 'h-10 xs:h-11 sm:h-12',
            text: 'text-sm xs:text-base sm:text-lg',
            sub: 'text-[9.5px] xs:text-[10px] sm:text-xs'
        },
        lg: {
            img: 'h-12 xs:h-14 sm:h-16',
            text: 'text-lg xs:text-xl sm:text-2xl',
            sub: 'text-xs sm:text-sm'
        },
        xl: {
            img: 'h-20 xs:h-24 sm:h-28',
            text: 'text-2xl xs:text-3xl',
            sub: 'text-xs sm:text-sm'
        },
        '2xl': {
            img: 'h-28 sm:h-32',
            text: 'text-3xl sm:text-4xl',
            sub: 'text-sm sm:text-base'
        }
    };

    const s = sizes[size] || sizes.md;
    const isLight = variant === 'light';
    const isVertical = layout === 'vertical';

    return (
        <div 
            className={`inline-flex ${
                isVertical
                    ? 'flex-col items-center text-center gap-2'
                    : 'items-center gap-2 xs:gap-2.5 sm:gap-3'
            } select-none group min-w-0 ${className}`}
        >
            {/* Official CLE Crest Emblem (Preserves exact aspect ratio without distortion) */}
            <div className="relative flex-shrink-0 flex items-center justify-center">
                {isLight && (
                    <div className="absolute -inset-1 bg-amber-400/20 rounded-full blur-md opacity-60 group-hover:opacity-100 transition duration-300 pointer-events-none" />
                )}
                <img
                    src={cleLogoImg}
                    alt="CLE Society Official Emblem"
                    className={`relative ${s.img} w-auto object-contain shrink-0 transition-transform duration-300 group-hover:scale-105 ${
                        isLight
                            ? 'drop-shadow-[0_2px_10px_rgba(251,191,36,0.3)]'
                            : 'drop-shadow-md'
                    }`}
                    loading="eager"
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/cle-logo.png';
                    }}
                />
            </div>

            {/* Typography: Heading in bold golden-yellow, subtitle in clear light-grey */}
            {!iconOnly && showText && (
                <div className={`flex flex-col justify-center min-w-0 ${
                    isVertical ? 'items-center text-center' : 'items-start text-left'
                }`}>
                    <div className="flex items-center min-w-0 max-w-full">
                        <span className={`font-display font-black tracking-tight leading-none truncate ${s.text} ${
                            isLight ? 'text-amber-400' : 'text-slate-900'
                        }`}>
                            {title}
                        </span>
                    </div>
                    <span className={`font-medium tracking-normal leading-tight mt-0.5 sm:mt-1 truncate max-w-full ${s.sub} ${
                        isLight ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                        {subText}
                    </span>
                </div>
            )}
        </div>
    );
};

export default CleLogo;
