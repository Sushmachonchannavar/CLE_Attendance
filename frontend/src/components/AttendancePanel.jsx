import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MapPin,
    CheckCircle,
    XCircle,
    Navigation,
    Clock,
    Shield,
    AlertTriangle,
    KeyRound,
    RefreshCw,
    Radio
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Fix for default marker icons in Leaflet with Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});

// Custom Icons for different states
const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Helper component to recenter map
const RecenterMap = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords) map.setView([coords.lat, coords.lng], 16);
    }, [coords, map]);
    return null;
};

const isPointInPolygon = (lat, lng, polygon) => {
    let x = lat, y = lng;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i].lat, yi = polygon[i].lng;
        let xj = polygon[j].lat, yj = polygon[j].lng;

        let intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
};

const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c * 1000; // Distance in meters
    return d;
};

const DEFAULT_LAT = 16.426026;
const DEFAULT_LNG = 74.589353;
const CAMPUS_LAT = import.meta.env.VITE_CAMPUS_LAT ? parseFloat(import.meta.env.VITE_CAMPUS_LAT) : DEFAULT_LAT;
const CAMPUS_LNG = import.meta.env.VITE_CAMPUS_LNG ? parseFloat(import.meta.env.VITE_CAMPUS_LNG) : DEFAULT_LNG;

const latOffset = CAMPUS_LAT - DEFAULT_LAT;
const lngOffset = CAMPUS_LNG - DEFAULT_LNG;

const CAMPUS_GEOFENCE = [
    { lat: 16.426380 + latOffset, lng: 74.588000 + lngOffset }, // Northwest Corner
    { lat: 16.426380 + latOffset, lng: 74.590506 + lngOffset }, // Northeast Corner
    { lat: 16.425672 + latOffset, lng: 74.590506 + lngOffset }, // Southeast Corner
    { lat: 16.425672 + latOffset, lng: 74.588000 + lngOffset }  // Southwest Corner
];
const GEOFENCE_RADIUS_METERS = 300;
const PRIVACY_RADIUS_METERS = 500; // Hide map if further than this
const DUTY_START_HOUR = 9;   // 9:00 AM
const DUTY_END_HOUR = 18;    // 6:00 PM
const DUTY_END_MINUTE = 30;  // 6:30 PM
const LATE_THRESHOLD_MINUTE = 20; // After 9:20 AM is late

const AttendancePanel = () => {
    const { user, logout } = useAuth();
    const outsideCountRef = useRef(0);
    const [status, setStatus] = useState(null);
    const [location, setLocation] = useState(null);
    const [distance, setDistance] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [isWithinDutyHours, setIsWithinDutyHours] = useState(false);

    // Secure OTP states
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpInput, setOtpInput] = useState('');
    const [otpErrorText, setOtpErrorText] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);

    useEffect(() => {
        fetchStatus();

        // Check duty hours initially and every minute
        const checkTime = () => {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();

            // Check if 09:00 <= current time < 18:30
            const isAfterStart = hour >= DUTY_START_HOUR;
            const isBeforeEnd = hour < DUTY_END_HOUR || (hour === DUTY_END_HOUR && minute < DUTY_END_MINUTE);

            const within = isAfterStart && isBeforeEnd;
            setIsWithinDutyHours(within);
            return within;
        };

        const timer = setInterval(checkTime, 60000);
        checkTime();

        let watchId;
        const startWatching = () => {
            if (!navigator.geolocation) {
                setError('Geolocation is not supported by this browser.');
                return;
            }

            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    setLocation({ lat: latitude, lng: longitude, accuracy: accuracy || 0 });
                    const dist = getDistanceFromLatLonInMeters(latitude, longitude, CAMPUS_LAT, CAMPUS_LNG);
                    setDistance(dist);
                    setError('');
                },
                (err) => {
                    console.error("Location error:", err);
                    let errMsg = 'Unable to retrieve your location.';
                    if (err.code === 1) errMsg = 'Location permission denied. Please allow location access.';
                    else if (err.code === 2) errMsg = 'Location position unavailable. Try moving to an open area.';
                    else if (err.code === 3) errMsg = 'Location request timed out. Retrying...';

                    setError(errMsg);
                    if (err.code !== 3) {
                        setLocation(null);
                        setDistance(null);
                    }
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
            );
        };

        startWatching();

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
            clearInterval(timer);
        };
    }, []);

    const handleAutoLogoutAndPunchOut = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        setError('Auto-logout: Outside geofence boundary.');
        try {
            console.log("Auto-logout: Attempting automatic punch-out...");
            if (location) {
                await api.post('/attendance/punch', {
                    lat: location.lat,
                    lng: location.lng
                });
            }
        } catch (err) {
            console.error("Auto punch-out API call failed:", err);
        } finally {
            setLoading(false);
            console.log("Auto-logout: Clearing session and logging out...");
            logout();
            alert("You are outside the authorized campus area. You have been automatically logged out.");
        }
    }, [loading, location, logout]);

    useEffect(() => {
        if (!location || !status || !status.punchedIn || status.punchedOut) {
            outsideCountRef.current = 0;
            return;
        }

        const dist = getDistanceFromLatLonInMeters(location.lat, location.lng, CAMPUS_LAT, CAMPUS_LNG);
        const isInsideGeo = isPointInPolygon(location.lat, location.lng, CAMPUS_GEOFENCE) || dist <= GEOFENCE_RADIUS_METERS;
        if (isInsideGeo) {
            outsideCountRef.current = 0;
        } else {
            if (location.accuracy && location.accuracy > 40) {
                console.log("GPS accuracy is poor, ignoring outside reading:", location.accuracy);
                return;
            }

            outsideCountRef.current += 1;
            console.log(`User is outside geofence polygon. Consecutive outside count: ${outsideCountRef.current}`);

            if (outsideCountRef.current >= 3) {
                console.log("User outside polygon for 3 consecutive updates. Triggering auto punch-out and logout...");
                handleAutoLogoutAndPunchOut();
            }
        }
    }, [location, status, handleAutoLogoutAndPunchOut]);

    const fetchStatus = async () => {
        try {
            const res = await api.get('/attendance/status');
            setStatus(res.data);

            const isPunched = res.data.punchedIn && !res.data.punchedOut;
            window.dispatchEvent(new CustomEvent('punch-status-change', {
                detail: { punchedIn: isPunched }
            }));
        } catch (err) {
            console.error("Failed to fetch status", err);
        }
    };

    const triggerManualLocation = () => {
        setError('Requesting fresh GPS lock...');
        if (!navigator.geolocation) {
            setError('Geolocation not supported.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setLocation({ lat: latitude, lng: longitude, accuracy: accuracy || 0 });
                const dist = getDistanceFromLatLonInMeters(latitude, longitude, CAMPUS_LAT, CAMPUS_LNG);
                setDistance(dist);
                setError('');
            },
            (err) => {
                console.error("Manual location failed:", err);
                setError(`Location failed: ${err.message}. Ensure location is ON in system settings.`);
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    const handlePunch = async () => {
        if (!location) {
            setError('Location not available. Please wait for GPS.');
            return;
        }

        setLoading(true);
        setError('');
        setMsg('');

        try {
            const res = await api.post('/attendance/punch', location);
            setMsg(res.data.message);
            fetchStatus();
        } catch (err) {
            console.error("Punch failed", err);
            setError(err.response?.data?.error || 'Punch failed. Check your geofence status.');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestOTP = async () => {
        if (!location) {
            setError('Location not available. Please wait for GPS lock.');
            return;
        }

        const phone = user?.phone || '1234567890';
        setSendingOtp(true);
        setError('');
        setMsg('');
        setOtpErrorText('');
        setOtpInput('');

        try {
            await api.post('/attendance/send-otp', { phone });
            setShowOtpModal(true);
        } catch (err) {
            console.error("Failed to request OTP:", err);
            setError(err.response?.data?.error || 'Failed to request OTP code. Please check server logs.');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyAndPunchIn = async (e) => {
        e.preventDefault();
        if (!otpInput || otpInput.length !== 6) {
            setOtpErrorText('Please enter a valid 6-digit OTP.');
            return;
        }

        setLoading(true);
        setOtpErrorText('');

        const phone = user?.phone || '1234567890';

        try {
            const res = await api.post('/attendance/verify-otp', {
                phone,
                otp: otpInput,
                lat: location.lat,
                lng: location.lng
            });

            if (res.data.success) {
                setMsg(res.data.message || 'Punched In successfully!');
                setShowOtpModal(false);
                fetchStatus();
            } else {
                setOtpErrorText(res.data.error || 'Verification failed.');
            }
        } catch (err) {
            console.error("OTP Punch-in failed:", err);
            setOtpErrorText(err.response?.data?.error || 'Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!status) return (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="animate-spin rounded-full h-9 w-9 border-3 border-blue-600 border-t-transparent mb-4" />
            <p className="text-slate-600 font-semibold text-sm">Connecting to attendance service...</p>
        </div>
    );

    const isInside = location !== null && (isPointInPolygon(location.lat, location.lng, CAMPUS_GEOFENCE) || (distance !== null && distance <= GEOFENCE_RADIUS_METERS));
    const isNearby = distance !== null && distance <= PRIVACY_RADIUS_METERS;

    const getPunchStatus = () => {
        if (!status?.record?.punch_in_time) return null;
        const [time, period] = status.record.punch_in_time.split(' ');
        const [hour, minute] = time.split(':').map(Number);

        let h = hour;
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;

        if (h > DUTY_START_HOUR || (h === DUTY_START_HOUR && minute > LATE_THRESHOLD_MINUTE)) {
            return { label: 'Late Punch', class: 'text-amber-700 bg-amber-50 border-amber-200' };
        }
        return { label: 'On Time', class: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    };

    const punchInStatus = getPunchStatus();

    // Determine current step index for the visual workflow ribbon (0 to 5)
    // 0: Location Check, 1: Location Verified, 2: Punch In, 3: Attendance Active, 4: Location Tracking, 5: Punch Out
    const getCurrentStep = () => {
        if (status.punchedOut) return 5;
        if (status.punchedIn) return 3; // active duty & tracking
        if (isInside) return 2; // ready to punch in
        if (location) return 1; // location obtained
        return 0; // checking location
    };
    const currentStep = getCurrentStep();

    const steps = [
        'Location Check',
        'Location Verified',
        'Punch In',
        'Attendance Active',
        'Location Tracking',
        'Punch Out'
    ];

    return (
        <div className="p-6 sm:p-8 bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden relative">
            {/* Header / Institutional Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm flex-shrink-0">
                        <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight">CLE Campus Attendance Portal</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">High-Precision Geofenced Punching & Live Verification</p>
                    </div>
                </div>

                {/* Real-time GPS Pulse Indicator */}
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 self-start sm:self-auto">
                    <span className="flex h-2.5 w-2.5 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${location ? 'bg-emerald-400' : 'bg-rose-400'} opacity-75`} />
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${location ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    </span>
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        {location ? 'GPS Locked & Active' : 'Acquiring GPS Signal'}
                    </span>
                </div>
            </div>

            {/* Attendance Step / Status Design Ribbon */}
            <div className="mb-8 bg-slate-50/80 p-4 rounded-2xl border border-slate-150">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Attendance Verification Flow</span>
                    <span className="text-[11px] font-bold text-blue-600">Step {currentStep + 1} of 6</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {steps.map((label, idx) => {
                        const isDone = idx < currentStep;
                        const isCurrent = idx === currentStep;
                        return (
                            <div
                                key={label}
                                className={`flex flex-col items-center text-center p-2 rounded-xl transition-all duration-200 ${
                                    isCurrent
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold'
                                        : isDone
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                                        : 'bg-white text-slate-400 border border-slate-200/60 font-medium'
                                }`}
                            >
                                <span className="text-[10px] uppercase tracking-tighter line-clamp-1">{label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Status & Map Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Left Card: Shift Status & Metrics */}
                <div className="flex flex-col justify-between p-6 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white shadow-sm space-y-5">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Attendance State</span>
                            {status.punchedIn && punchInStatus && (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${punchInStatus.class}`}>
                                    {punchInStatus.label}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <h4 className={`text-2xl sm:text-3xl font-black ${
                                status.punchedOut ? 'text-slate-700' : status.punchedIn ? 'text-emerald-600' : 'text-slate-600'
                            }`}>
                                {status.punchedOut ? 'Shift Completed' : status.punchedIn ? 'Active On-Duty' : 'Not Punched In'}
                            </h4>
                        </div>
                        {status.record && (
                            <div className="mt-4 p-3 bg-slate-100/70 rounded-xl border border-slate-200/60 text-xs font-medium text-slate-700 space-y-1">
                                <p className="flex justify-between">
                                    <span className="text-slate-500">Punch-In:</span>
                                    <strong className="text-slate-800">{status.record.punch_in_time || '—'}</strong>
                                </p>
                                <p className="flex justify-between">
                                    <span className="text-slate-500">Punch-Out:</span>
                                    <strong className="text-slate-800">{status.record.punch_out_time || 'In Progress'}</strong>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Geofence & Duty Hour Information */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 text-xs">
                            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                                <Radio className="w-4 h-4 text-blue-500" />
                                Geofence Status:
                            </span>
                            <span className={`font-bold px-2.5 py-0.5 rounded-full uppercase text-[10px] ${
                                isInside
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                                {isInside ? 'Inside Campus' : 'Outside Campus'}
                            </span>
                        </div>

                        {distance !== null && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 text-xs">
                                <span className="font-semibold text-slate-600">Distance to Campus Center:</span>
                                <span className="font-mono font-bold text-slate-800">{Math.round(distance)} meters</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 text-xs">
                            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-slate-400" />
                                Official Duty Window:
                            </span>
                            <span className="font-bold text-slate-700">09:00 AM – 06:30 PM</span>
                        </div>
                    </div>
                </div>

                {/* Right Card: Interactive Visual Geofence Map */}
                <div className={`p-4 rounded-2xl border ${isInside ? 'bg-blue-50/50 border-blue-200' : 'bg-rose-50/40 border-rose-200'} flex flex-col justify-between`}>
                    <div className="flex justify-between items-center mb-2 px-1">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-blue-600" />
                            Campus Geofence Area
                        </span>
                        {location && isNearby && (
                            <span className="px-2 py-0.5 bg-slate-900 text-emerald-400 rounded-md font-mono text-[10px]">
                                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                            </span>
                        )}
                    </div>

                    <div className="h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative z-10">
                        {location && isNearby ? (
                            <MapContainer
                                center={[location.lat, location.lng]}
                                zoom={16}
                                style={{ height: '100%', width: '100%' }}
                                scrollWheelZoom={false}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <RecenterMap coords={location} />

                                {/* Campus Geofence Polygon */}
                                <Polygon
                                    positions={CAMPUS_GEOFENCE.map(p => [p.lat, p.lng])}
                                    pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2.5 }}
                                />
                                <Marker position={[CAMPUS_LAT, CAMPUS_LNG]} icon={blueIcon}>
                                    <Popup>CLE Society Campus Center</Popup>
                                </Marker>

                                {/* Live Location Trace */}
                                <Marker position={[location.lat, location.lng]}>
                                    <Popup>
                                        You are here <br />
                                        {isInside ? 'Inside Campus' : `${Math.round(distance)}m Away`}
                                    </Popup>
                                </Marker>

                                {/* Punch In Marker */}
                                {status.record?.location_lat && (
                                    <Marker position={[status.record.location_lat, status.record.location_lng]} icon={greenIcon}>
                                        <Popup>Punched In at {status.record.punch_in_time}</Popup>
                                    </Marker>
                                )}

                                {/* Punch Out Marker */}
                                {status.record?.location_lat_out && (
                                    <Marker position={[status.record.location_lat_out, status.record.location_lng_out]} icon={redIcon}>
                                        <Popup>Punched Out at {status.record.punch_out_time}</Popup>
                                    </Marker>
                                )}

                                {/* Trace Polyline if Punched Out */}
                                {status.record?.location_lat && status.record?.location_lat_out && (
                                    <Polyline
                                        positions={[
                                            [status.record.location_lat, status.record.location_lng],
                                            [status.record.location_lat_out, status.record.location_lng_out]
                                        ]}
                                        pathOptions={{ color: '#f59e0b', dashArray: '6, 10', weight: 3 }}
                                    />
                                )}
                            </MapContainer>
                        ) : (
                            <div className="w-full h-full bg-slate-100 flex items-center justify-center flex-col p-6 text-center">
                                <Navigation className="w-10 h-10 text-slate-300 animate-pulse mb-3" />
                                <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">
                                    {isWithinDutyHours ? 'Privacy Zone Active' : 'Off Duty Mode'}
                                </p>
                                <p className="text-xs text-slate-500 mt-2 italic max-w-xs leading-relaxed">
                                    {isWithinDutyHours
                                        ? 'Map tracing activates within the 500m campus perimeter. Move closer to the institutional gate to reveal coordinates.'
                                        : 'Outside standard operating hours (09:00 - 18:30). Late punch-out is enabled whenever ready.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {location && isNearby && !isInside && (
                        <p className="mt-2.5 text-xs text-rose-700 font-semibold bg-white p-2.5 rounded-xl border border-rose-200 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                            <span>Campus Alert: You are {Math.round(distance)}m from the campus perimeter.</span>
                        </p>
                    )}
                </div>
            </div>

            {/* Notification Messages */}
            {msg && (
                <div className="flex items-center gap-3 p-4 mb-6 text-emerald-800 bg-emerald-50 rounded-2xl border border-emerald-200 animate-in fade-in">
                    <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
                    <span className="text-sm font-semibold">{msg}</span>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-3 p-4 mb-6 text-rose-800 bg-rose-50 rounded-2xl border border-rose-200 animate-in fade-in">
                    <XCircle className="w-5 h-5 shrink-0 text-rose-600" />
                    <span className="text-sm font-semibold">{error}</span>
                </div>
            )}

            {/* Main Punch Action Button */}
            {!status.punchedOut && (
                <div className="relative">
                    <button
                        onClick={status.punchedIn ? handlePunch : handleRequestOTP}
                        disabled={loading || sendingOtp || !location || !isInside}
                        className={`w-full py-4.5 px-6 rounded-2xl font-black text-lg tracking-wide shadow-xl transition-all duration-200 active:scale-[0.99] disabled:grayscale disabled:opacity-50 disabled:cursor-not-allowed ${
                            status.punchedIn
                                ? 'bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white shadow-rose-600/30 hover:shadow-rose-600/40'
                                : 'bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white shadow-blue-600/30 hover:shadow-blue-600/40'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-3">
                            {(loading || sendingOtp) && <RefreshCw className="w-5 h-5 animate-spin" />}
                            <span>
                                {sendingOtp
                                    ? 'Sending OTP...'
                                    : loading
                                    ? 'Transmitting punch...'
                                    : status.punchedIn
                                    ? 'Punch Out (End Shift)'
                                    : 'Punch In (Verify & Begin)'}
                            </span>
                        </div>
                    </button>
                    {!isInside && location && (
                        <p className="text-center text-xs text-rose-600 font-bold uppercase tracking-tight mt-2 flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Geofence Enforcement Active: Must be located inside campus boundary
                        </p>
                    )}
                </div>
            )}

            {status.punchedOut && (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-slate-800 font-bold text-base">Today's Attendance Finalized</p>
                    <p className="text-slate-500 text-xs mt-1">Your punch-in and punch-out records have been recorded.</p>
                </div>
            )}

            {/* Sync Utilities */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                    onClick={triggerManualLocation}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider rounded-xl transition-colors border border-slate-200 flex items-center justify-center gap-2"
                >
                    <Navigation className="w-4 h-4" />
                    Sync GPS Coordinate Lock
                </button>
                <button
                    onClick={fetchStatus}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider rounded-xl transition-colors border border-slate-200 flex items-center justify-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Shift Status
                </button>
            </div>

            {/* Privacy & Security Province */}
            <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3 text-blue-700">
                    <Shield className="w-5 h-5" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider">Institutional Privacy & Security Guarantee</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-blue-900 leading-relaxed font-medium">
                        <strong>Campus-Bound Tracing Only:</strong> Location tracking operates strictly during approved shift hours and verifies presence exclusively within the authorized campus perimeter.
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed font-medium">
                        <strong>Zero-Access Privacy Sandbox:</strong> This system does not access private device storage, camera, microphone, or external contacts.
                    </div>
                </div>
            </div>

            {/* Secure OTP Verification Modal */}
            {showOtpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => !loading && setShowOtpModal(false)}
                    />

                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-7 border border-slate-100 z-10 animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <KeyRound className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Verify Punch-In Authorization</h3>
                            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                                Enter the 6-digit OTP sent to registered number <br />
                                <strong className="text-slate-700">+91 {user?.phone || 'N/A'}</strong>
                            </p>
                        </div>

                        {['9999999999', '8888888888', '9876543210', '1234567890'].includes((user?.phone || '').replace(/\D/g, '').slice(-10)) && (
                            <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-2xl text-center">
                                <span className="text-xs font-bold text-blue-800">
                                    Demo Account • Punch-in OTP: <span className="font-mono font-extrabold underline">123456</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOtpInput('123456');
                                        setOtpErrorText('');
                                    }}
                                    className="mt-1.5 block w-full py-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                                >
                                    Auto-fill Demo Punch OTP (123456)
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleVerifyAndPunchIn} className="space-y-4">
                            <div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    className={`w-full px-4 py-3.5 bg-slate-50 border ${
                                        otpErrorText ? 'border-rose-400 ring-2 ring-rose-400/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                    } rounded-2xl text-center text-2xl font-black tracking-[0.5rem] text-slate-900 focus:outline-none transition-all`}
                                    value={otpInput}
                                    onChange={(e) => {
                                        setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                                        setOtpErrorText('');
                                    }}
                                    placeholder="------"
                                    required
                                    autoFocus
                                    disabled={loading}
                                />
                                {otpErrorText && (
                                    <p className="mt-2 text-xs text-rose-600 font-bold flex items-center justify-center gap-1">
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>{otpErrorText}</span>
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading || otpInput.length !== 6}
                                className="w-full py-3.5 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Authorizing...</span>
                                    </>
                                ) : (
                                    <span>Verify & Punch In</span>
                                )}
                            </button>

                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={handleRequestOTP}
                                    disabled={loading}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
                                >
                                    Resend Verification Code
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendancePanel;
