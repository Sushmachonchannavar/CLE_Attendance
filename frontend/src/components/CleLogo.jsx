import React from 'react';
import cleLogoImg from '../assets/cle-logo.png';

const CleLogo = ({
    size = 'md',
    className = '',
    variant = 'dark',
    iconOnly = false,
    showText = true,
    layout = 'horizontal',
    subText = 'Staff Attendance System',
    title = 'CLE SOCIETY'
}) => {
    // Dimensions map - balanced proportions for crest emblem
    const sizes = {
        xs: { img: 'h-7', text: 'text-sm', sub: 'text-[8px]' },
        sm: { img: 'h-10', text: 'text-base', sub: 'text-[9px]' },
        md: { img: 'h-12', text: 'text-xl', sub: 'text-[10px]' },
        lg: { img: 'h-16', text: 'text-2xl', sub: 'text-xs' },
        xl: { img: 'h-24 sm:h-28', text: 'text-3xl', sub: 'text-sm' },
        '2xl': { img: 'h-32', text: 'text-4xl', sub: 'text-base' }
    };

    const s = sizes[size] || sizes.md;
    const isLight = variant === 'light';
    const isVertical = layout === 'vertical';

    // Title formatting: highlight the second word if available
    const titleParts = title.split(' ');
    const firstWord = titleParts[0];
    const restWords = titleParts.slice(1).join(' ');

    return (
        <div 
            className={`inline-flex ${isVertical ? 'flex-col items-center text-center gap-2' : 'items-center gap-3'} select-none group ${className}`}
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
                <div className={`flex flex-col ${isVertical ? 'items-center' : ''}`}>
                    <div className="flex items-center gap-1.5">
                        <span className={`font-display font-extrabold tracking-tight leading-none ${s.text} ${isLight ? 'text-white' : 'text-slate-900'}`}>
                            {firstWord} {restWords && <span className="text-amber-500 font-black">{restWords}</span>}
                        </span>
                    </div>
                    <span className={`font-semibold tracking-wider uppercase leading-none mt-1 ${s.sub} ${isLight ? 'text-blue-200' : 'text-slate-500'}`}>
                        {subText}
                    </span>
                </div>
            )}
        </div>
    );
};

export default CleLogo;
