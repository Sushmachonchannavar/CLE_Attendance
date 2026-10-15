import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
    Smartphone, 
    Download, 
    QrCode, 
    CheckCircle2, 
    ShieldCheck, 
    ArrowRight, 
    ExternalLink, 
    Share2, 
    ChevronRight,
    Sparkles,
    Laptop,
    AlertCircle,
    Building2,
    HelpCircle
} from 'lucide-react';
import CleLogo from '../components/CleLogo';

export default function DownloadApp() {
    const [deviceType, setDeviceType] = useState('unknown'); // 'android', 'ios', or 'desktop'
    const [activeTab, setActiveTab] = useState('auto'); // 'auto', 'android', 'ios', 'qr'
    const [downloadUrl, setDownloadUrl] = useState('');
    const [apkUrl, setApkUrl] = useState('');

    useEffect(() => {
        // Detect OS
        const ua = navigator.userAgent.toLowerCase();
        const isAndroid = ua.includes('android');
        const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isAndroid) {
            setDeviceType('android');
            setActiveTab('android');
        } else if (isIOS) {
            setDeviceType('ios');
            setActiveTab('ios');
        } else {
            setDeviceType('desktop');
            setActiveTab('qr');
        }

        // Determine current page URL for QR code and APK download
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://attendance.clesociety.edu.in';
        setDownloadUrl(`${currentOrigin}/download`);
        // Direct GitHub Release link ensures download works immediately on any deployed host
        setApkUrl('https://github.com/Sushmachonchannavar/CLE_Attendance/releases/download/v1.0.0-mobile/cle-attendance.apk');
    }, []);

    const selectedTab = activeTab === 'auto' ? (deviceType === 'android' ? 'android' : deviceType === 'ios' ? 'ios' : 'qr') : activeTab;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-indigo-950 text-slate-100 flex flex-col justify-between">
            {/* Header / Navbar */}
            <header className="border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
                    <Link to="/login" className="flex items-center gap-3 group">
                        <CleLogo className="w-10 h-10 object-contain drop-shadow" />
                        <div>
                            <span className="block text-base font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
                                C.L.E. Society
                            </span>
                            <span className="block text-xs text-slate-400 font-medium">
                                Staff Attendance & Location System
                            </span>
                        </div>
                    </Link>

                    <Link 
                        to="/login"
                        className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white shadow-sm transition-all"
                    >
                        Web Login
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </header>

            {/* Main Hero & Installation Content */}
            <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full flex flex-col items-center">
                
                {/* Hero Badge & Heading */}
                <div className="text-center max-w-2xl mx-auto mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
                        <Sparkles className="w-3.5 h-3.5" />
                        Official Mobile Applications
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                        Download CLE Staff Attendance
                    </h1>
                    <p className="text-slate-300 text-sm sm:text-base mt-2">
                        Mark geofenced attendance, submit leaves and OD requests, and receive real-time SMS notifications directly on your phone.
                    </p>
                </div>

                {/* Device Selector Tabs */}
                <div className="flex items-center gap-2 p-1 bg-slate-800/80 border border-slate-700/80 rounded-xl mb-8 w-full max-w-md shadow-inner">
                    <button
                        onClick={() => setActiveTab('android')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                            selectedTab === 'android'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Smartphone className="w-4 h-4" />
                        Android
                        {deviceType === 'android' && (
                            <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded-full font-bold">You</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('ios')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                            selectedTab === 'ios'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Laptop className="w-4 h-4" />
                        iPhone / iOS
                        {deviceType === 'ios' && (
                            <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded-full font-bold">You</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('qr')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                            selectedTab === 'qr'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <QrCode className="w-4 h-4" />
                        Scan QR
                    </button>
                </div>

                {/* Main Card Container */}
                <div className="w-full max-w-2xl bg-slate-800/90 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
                    
                    {/* TAB 1: ANDROID DOWNLOAD */}
                    {selectedTab === 'android' && (
                        <div className="space-y-6">
                            <div className="flex items-start justify-between border-b border-slate-700/60 pb-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                        <Smartphone className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">CLE Attendance for Android</h2>
                                        <p className="text-xs text-slate-400 mt-0.5">Compatible with Android 8.0 to Android 15</p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    APK v1.0.0
                                </span>
                            </div>

                            {/* Direct Download Button */}
                            <div className="space-y-3">
                                <a
                                    href={apkUrl}
                                    download="cle-attendance.apk"
                                    className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                >
                                    <Download className="w-5 h-5" />
                                    Download Android APK Directly
                                </a>
                                <p className="text-center text-xs text-slate-400">
                                    Verified institutional package • Size: ~5.8 MB • SHA-256 Validated
                                </p>
                                <a
                                    href="https://github.com/Sushmachonchannavar/CLE_Attendance/releases"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-600 transition-all"
                                >
                                    <ExternalLink className="w-4 h-4 text-indigo-400" />
                                    Download from GitHub Releases (Cloud Mirror)
                                </a>
                            </div>

                            {/* Android 3-Step Install Guide */}
                            <div className="bg-slate-900/60 border border-slate-700/70 rounded-xl p-4 space-y-3">
                                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                    <HelpCircle className="w-4 h-4 text-indigo-400" />
                                    How to Install the APK on Your Android Device:
                                </h3>
                                <div className="space-y-2.5 text-xs text-slate-300">
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">1</span>
                                        <span>Tap <strong>Download Android APK Directly</strong> above. If your browser warns <em>"File might be harmful"</em>, tap <strong>Download anyway</strong> (this is standard for direct APK installs outside Play Store).</span>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">2</span>
                                        <span>Open the downloaded file from your notification bar or <strong>Downloads</strong> folder.</span>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">3</span>
                                        <span>Tap <strong>Install</strong>. If prompted, toggle <strong>Allow from this source</strong> in your phone settings to complete installation.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: iOS / IPHONE DOWNLOAD */}
                    {selectedTab === 'ios' && (
                        <div className="space-y-6">
                            <div className="flex items-start justify-between border-b border-slate-700/60 pb-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                                        <Laptop className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">CLE Attendance for iOS</h2>
                                        <p className="text-xs text-slate-400 mt-0.5">iPhone & iPad (iOS 15.0 or newer)</p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[11px] font-semibold border border-indigo-500/20">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Apple TestFlight / Web
                                </span>
                            </div>

                            {/* Option A: TestFlight or App Store */}
                            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/70 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Option 1: Apple TestFlight Preview</h3>
                                        <p className="text-xs text-slate-400">For beta testing and institutionally signed iOS builds</p>
                                    </div>
                                    <a
                                        href="https://testflight.apple.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shrink-0"
                                    >
                                        Open TestFlight
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>

                            {/* Option B: Fast Progressive Web App (Add to Home Screen) */}
                            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/70 space-y-3">
                                <div className="flex items-center gap-2 text-slate-200 font-bold text-xs uppercase tracking-wider">
                                    <Share2 className="w-4 h-4 text-emerald-400" />
                                    Option 2: Instant Install via Safari (No App Store Needed)
                                </div>
                                <div className="space-y-2.5 text-xs text-slate-300">
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">1</span>
                                        <span>Open <strong>Safari</strong> on your iPhone and visit this website.</span>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">2</span>
                                        <span>Tap the <strong>Share</strong> button (the square icon with an arrow pointing up at the bottom of Safari).</span>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">3</span>
                                        <span>Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong> in the top-right corner.</span>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">4</span>
                                        <span>The CLE Society icon will appear on your iPhone home screen and run in standalone fullscreen app mode.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: UNIVERSAL ONE QR CODE */}
                    {selectedTab === 'qr' && (
                        <div className="text-center space-y-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">Scan with Your Phone Camera</h2>
                                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                                    This universal QR code automatically detects whether you are using Android or iPhone and delivers the correct installation option.
                                </p>
                            </div>

                            {/* High-Contrast Crisp QR Code Container */}
                            <div className="flex justify-center my-4">
                                <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-indigo-500/40 inline-block">
                                    {downloadUrl ? (
                                        <QRCodeSVG
                                            value={downloadUrl}
                                            size={220}
                                            level="H"
                                            includeMargin={false}
                                        />
                                    ) : (
                                        <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-400 text-xs">
                                            Generating QR Code...
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Direct URL text for copy/sharing */}
                            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between max-w-md mx-auto text-xs">
                                <span className="font-mono text-slate-300 truncate mr-2">{downloadUrl}</span>
                                <button
                                    onClick={() => {
                                        if (navigator.clipboard) {
                                            navigator.clipboard.writeText(downloadUrl);
                                            alert('Installation link copied to clipboard!');
                                        }
                                    }}
                                    className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium shrink-0 transition-colors"
                                >
                                    Copy Link
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Key Features Banner */}
                    <div className="mt-8 pt-6 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center sm:text-left">
                        <div className="flex items-center gap-2.5 text-xs text-slate-300">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Real SMS OTP Verification</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-slate-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Campus Geofence (300m)</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-slate-300">
                            <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Leaves & OD Approvals</span>
                        </div>
                    </div>

                </div>

                {/* Back to Login Link */}
                <div className="mt-8 text-center">
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Already have access? Return to Web Login
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 bg-slate-900/60 py-4 text-center text-xs text-slate-500">
                <p>© {new Date().getFullYear()} C.L.E. Society's Sr Sec School. All rights reserved.</p>
                <p className="mt-1">Staff Attendance & Location Verification System • Internal Institutional Distribution</p>
            </footer>
        </div>
    );
}
