import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { getBaseURL } from '../utils/api';
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { 
    Radio, 
    ShieldCheck, 
    WifiOff, 
    AlertTriangle, 
    Info, 
    Settings, 
    X,
    CheckCircle2
} from 'lucide-react';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

const OFFLINE_QUEUE_KEY = 'cle_offline_location_queue';
const MAX_QUEUE_SIZE = 50;
const ACCURACY_THRESHOLD_METERS = 80;

// Reusable Haversine distance helper
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const getOfflineQueue = () => {
    try {
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveOfflineQueue = (queue) => {
    try {
        // Enforce FIFO limit to minimize storage and prevent accumulation
        const trimmed = queue.slice(-MAX_QUEUE_SIZE);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.error('Failed to save offline queue:', e);
    }
};

const LocationTracker = () => {
    const { user } = useAuth();
    const [isTracking, setIsTracking] = useState(false);
    const [lastFix, setLastFix] = useState(null);
    const [queueCount, setQueueCount] = useState(0);
    const [permissionError, setPermissionError] = useState(null);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const isPunchedInRef = useRef(false);
    const nativeWatcherIdRef = useRef(null);
    const webWatchIdRef = useRef(null);
    const intervalIdRef = useRef(null);
    const lastSentLocationRef = useRef(null);
    const isFlushingRef = useRef(false);

    // Keep online state in sync
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            flushOfflineQueue();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        setQueueCount(getOfflineQueue().length);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Post location update via native HTTP plugin or standard web api
    const postLocationPayload = useCallback(async (payload) => {
        const token = localStorage.getItem('token');
        if (!token) return { success: false, error: 'No auth token' };

        const targetUrl = `${getBaseURL()}/employee/location`;

        if (Capacitor.isNativePlatform()) {
            // CapacitorHttp avoids background WebView HTTP suspension on Android/iOS
            const response = await CapacitorHttp.post({
                url: targetUrl,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                data: payload
            });

            if (response.status >= 200 && response.status < 300) {
                return { success: true, data: response.data };
            }
            throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
        } else {
            // Web browser mode
            const res = await api.post('/employee/location', payload);
            return { success: true, data: res.data };
        }
    }, []);

    // Flush any offline queued locations once network is accessible
    const flushOfflineQueue = useCallback(async () => {
        if (isFlushingRef.current) return;
        const queue = getOfflineQueue();
        if (queue.length === 0) return;

        isFlushingRef.current = true;
        try {
            await postLocationPayload({ locations: queue });
            localStorage.removeItem(OFFLINE_QUEUE_KEY);
            setQueueCount(0);
        } catch (err) {
            console.warn('Queue flush retry deferred:', err?.message || err);
        } finally {
            isFlushingRef.current = false;
        }
    }, [postLocationPayload]);

    // Securely queue location when offline
    const queueLocation = useCallback((point) => {
        const queue = getOfflineQueue();
        // Prevent duplicate consecutive entries with identical coordinates
        const last = queue[queue.length - 1];
        if (last && Math.abs(last.lat - point.lat) < 0.00001 && Math.abs(last.lng - point.lng) < 0.00001) {
            return;
        }
        queue.push({
            lat: point.lat,
            lng: point.lng,
            accuracy: point.accuracy,
            timestamp: point.timestamp || new Date().toISOString()
        });
        saveOfflineQueue(queue);
        setQueueCount(queue.length);
    }, []);

    // Process a new incoming location reading
    const handleNewLocation = useCallback(
        async (lat, lng, accuracy, rawTimestamp) => {
            // Discard readings with excessive GPS inaccuracy
            if (accuracy && accuracy > ACCURACY_THRESHOLD_METERS) {
                return;
            }

            const timestamp = rawTimestamp ? new Date(rawTimestamp).toISOString() : new Date().toISOString();
            const point = { lat, lng, accuracy, timestamp };

            setLastFix({ lat, lng, accuracy, time: new Date() });
            setPermissionError(null);

            // If offline, queue immediately
            if (!navigator.onLine) {
                queueLocation(point);
                return;
            }

            try {
                await postLocationPayload(point);
                lastSentLocationRef.current = { lat, lng, time: Date.now() };

                // If queue has pending points, flush them now
                const pendingQueue = getOfflineQueue();
                if (pendingQueue.length > 0) {
                    flushOfflineQueue();
                }
            } catch (err) {
                console.warn('Location delivery failed, buffering to offline queue:', err?.message || err);
                queueLocation(point);
            }
        },
        [postLocationPayload, queueLocation, flushOfflineQueue]
    );

    // Stop all tracking services
    const stopTracking = useCallback(async () => {
        if (nativeWatcherIdRef.current) {
            try {
                await BackgroundGeolocation.removeWatcher({ id: nativeWatcherIdRef.current });
            } catch (err) {
                console.warn('Error removing native watcher:', err);
            }
            nativeWatcherIdRef.current = null;
        }

        if (webWatchIdRef.current) {
            navigator.geolocation.clearWatch(webWatchIdRef.current);
            webWatchIdRef.current = null;
        }

        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        lastSentLocationRef.current = null;
        setIsTracking(false);
    }, []);

    // Start tracking services
    const startTracking = useCallback(async () => {
        if (nativeWatcherIdRef.current || webWatchIdRef.current) {
            return; // Already tracking
        }

        setIsTracking(true);
        setPermissionError(null);

        // Native Mobile Path (Capacitor on Android / iOS)
        if (Capacitor.isNativePlatform()) {
            try {
                const watcherId = await BackgroundGeolocation.addWatcher(
                    {
                        backgroundTitle: 'CLE Campus Duty Active',
                        backgroundMessage: 'Attendance location tracking active while on duty.',
                        requestPermissions: true,
                        stale: false,
                        distanceFilter: 15
                    },
                    (location, error) => {
                        if (error) {
                            if (error.code === 'NOT_AUTHORIZED') {
                                setPermissionError('Background location permission denied. Tap to open Settings.');
                            } else {
                                setPermissionError(error.message || 'GPS location error');
                            }
                            return;
                        }

                        if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
                            handleNewLocation(
                                location.latitude,
                                location.longitude,
                                location.accuracy,
                                location.time
                            );
                        }
                    }
                );
                nativeWatcherIdRef.current = watcherId;
                return;
            } catch (nativeErr) {
                console.warn('Native background watcher failed, falling back to web geolocation:', nativeErr);
            }
        }

        // Web Browser / Fallback Path
        if (!navigator.geolocation) {
            setPermissionError('Geolocation is not supported on this browser.');
            return;
        }

        // Immediate initial fix
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                handleNewLocation(latitude, longitude, accuracy, pos.timestamp);
            },
            (err) => {
                console.warn('Initial fix error:', err.message);
                if (err.code === 1) setPermissionError('Location permission denied.');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );

        // Watch continuous movements
        webWatchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                if (accuracy && accuracy > ACCURACY_THRESHOLD_METERS) return;

                const lastSent = lastSentLocationRef.current;
                if (!lastSent) {
                    handleNewLocation(latitude, longitude, accuracy, pos.timestamp);
                } else {
                    const dist = getDistance(latitude, longitude, lastSent.lat, lastSent.lng);
                    if (dist >= 10) {
                        handleNewLocation(latitude, longitude, accuracy, pos.timestamp);
                    }
                }
            },
            (err) => {
                console.warn('Web watch error:', err.message);
                if (err.code === 1) setPermissionError('Location permission denied.');
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );

        // Periodic heartbeat check (every 30 seconds)
        const checkInterval = import.meta.env.VITE_LOCATION_INTERVAL
            ? parseInt(import.meta.env.VITE_LOCATION_INTERVAL, 10)
            : 30000;

        intervalIdRef.current = setInterval(() => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude, longitude, accuracy } = pos.coords;
                        const lastSent = lastSentLocationRef.current;
                        const now = Date.now();
                        if (!lastSent || now - lastSent.time >= checkInterval) {
                            handleNewLocation(latitude, longitude, accuracy, pos.timestamp);
                        }
                    },
                    () => {},
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            }
        }, checkInterval);
    }, [handleNewLocation]);

    // Check attendance punch status on backend before initiating tracking
    const checkPunchStatus = useCallback(async () => {
        try {
            const res = await api.get('/attendance/status');
            const isPunched = res.data.punchedIn && !res.data.punchedOut;
            isPunchedInRef.current = isPunched;
            if (isPunched) {
                startTracking();
            } else {
                stopTracking();
            }
        } catch (err) {
            console.error('Failed to check punch status for tracking:', err?.message || err);
            stopTracking();
        }
    }, [startTracking, stopTracking]);

    // Lifecycle manager
    useEffect(() => {
        if (!user || user.role?.toLowerCase() !== 'staff') {
            stopTracking();
            return;
        }

        checkPunchStatus();

        const handleStatusChange = (e) => {
            const isPunched = e.detail?.punchedIn;
            isPunchedInRef.current = isPunched;
            if (isPunched) {
                startTracking();
            } else {
                stopTracking();
            }
        };

        window.addEventListener('punch-status-change', handleStatusChange);

        return () => {
            window.removeEventListener('punch-status-change', handleStatusChange);
            stopTracking();
        };
    }, [user, checkPunchStatus, startTracking, stopTracking]);

    // Open device settings for permission troubleshooting
    const handleOpenSettings = async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                await BackgroundGeolocation.openSettings();
            } catch (err) {
                console.error('Cannot open native settings:', err);
            }
        } else {
            alert('Please enable location permissions in your browser address bar.');
        }
    };

    // Do not render anything if user is not staff or not punched in
    if (!user || user.role?.toLowerCase() !== 'staff' || !isTracking) {
        return null;
    }

    return (
        <>
            {/* Persistent, privacy-conscious tracking status bar for active staff */}
            <aside 
                aria-label="Attendance Location Tracking Status"
                className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg p-3.5 text-slate-800 transition-all duration-300"
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {/* Status beacon */}
                        <div className="relative flex-shrink-0">
                            <span className="flex h-3 w-3">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${permissionError ? 'bg-rose-400' : isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${permissionError ? 'bg-rose-500' : isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            </span>
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <Radio className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-xs font-semibold tracking-tight text-slate-900 truncate">
                                    Duty Tracking Active
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {permissionError ? (
                                    <span className="text-rose-600 font-medium">Permission required</span>
                                ) : queueCount > 0 ? (
                                    <span className="text-amber-600 font-medium">Offline: {queueCount} fixes queued</span>
                                ) : lastFix ? (
                                    `Acc: ±${Math.round(lastFix.accuracy)}m • Synced ${lastFix.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                ) : (
                                    'Acquiring GPS fix...'
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {permissionError ? (
                            <button
                                onClick={handleOpenSettings}
                                className="px-2.5 py-1 text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors flex items-center gap-1"
                                title="Open Device Settings"
                            >
                                <Settings className="w-3 h-3" />
                                Settings
                            </button>
                        ) : null}

                        <button
                            onClick={() => setShowPrivacyModal(true)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Location Tracking & Privacy Policy"
                            aria-label="View Location Privacy Policy"
                        >
                            <Info className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Battery and permission advisory if an issue is detected */}
                {permissionError && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-start gap-2 text-[11px] text-rose-700">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{permissionError}</span>
                    </div>
                )}
            </aside>

            {/* Transparent Disclosure & Privacy Policy Modal */}
            {showPrivacyModal && (
                <div 
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="privacy-modal-title"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
                >
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2 text-blue-700 font-bold text-base" id="privacy-modal-title">
                                <ShieldCheck className="w-5 h-5 text-blue-600" />
                                Location Tracking & Privacy Policy
                            </div>
                            <button
                                onClick={() => setShowPrivacyModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                                aria-label="Close dialog"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-h-80 overflow-y-auto pr-1">
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-900">
                                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <strong className="block font-semibold">Strictly Active-Duty Only</strong>
                                    Location is recorded exclusively between an authorized punch-in and punch-out. Tracking terminates automatically the moment you punch out.
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <strong className="block font-semibold">Admin-Restricted Access</strong>
                                    Only authorized campus administrators can review duty location status. Other staff members cannot view your coordinates.
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
                                <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <strong className="block font-semibold">Offline Buffering</strong>
                                    If network connectivity is temporarily interrupted, permitted fixes are securely queued on your device and synced automatically upon reconnection.
                                </div>
                            </div>

                            <div className="text-[11px] text-slate-500 pt-1">
                                <strong>Battery notice:</strong> On Android devices, disable aggressive battery optimization for this app in your device Settings to ensure uninterrupted attendance recording while your screen is locked.
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2">
                            {Capacitor.isNativePlatform() && (
                                <button
                                    onClick={handleOpenSettings}
                                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                >
                                    Device Settings
                                </button>
                            )}
                            <button
                                onClick={() => setShowPrivacyModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
                            >
                                Understood
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default LocationTracker;
