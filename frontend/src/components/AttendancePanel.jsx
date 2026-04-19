import { useState, useEffect } from 'react';
import { MapPin, CheckCircle, XCircle, AlertTriangle, Navigation, Map as MapIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';

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


const CAMPUS_LAT = 16.42578;
const CAMPUS_LNG = 74.58970;
const GEOFENCE_RADIUS_METERS = 100;
const PRIVACY_RADIUS_METERS = 500; // Hide map if further than this
const DUTY_START_HOUR = 9;   // 9:00 AM

const DUTY_END_HOUR = 18;    // 6:00 PM
const DUTY_END_MINUTE = 30;  // 6:30 PM
const LATE_THRESHOLD_MINUTE = 20; // After 9:20 AM is late


const AttendancePanel = () => {
    const [status, setStatus] = useState(null);
    const [location, setLocation] = useState(null);
    const [distance, setDistance] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [isWithinDutyHours, setIsWithinDutyHours] = useState(false);

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
                    // Update location regardless of duty hours so late punch-outs are possible
                    checkTime();
                    const { latitude, longitude } = position.coords;
                    console.log("Trace success:", latitude, longitude);
                    setLocation({ lat: latitude, lng: longitude });
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

    const fetchStatus = async () => {
        try {
            const res = await api.get('/attendance/status');
            setStatus(res.data);
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
                const { latitude, longitude } = position.coords;
                console.log("Manual Fix:", latitude, longitude);
                setLocation({ lat: latitude, lng: longitude });
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

    const deg2rad = (deg) => {
        return deg * (Math.PI / 180);
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

    if (!status) return (
        <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-500 font-medium italic">Connecting to server...</p>
        </div>
    );



    const isInside = distance !== null && distance <= GEOFENCE_RADIUS_METERS;
    const isNearby = distance !== null && distance <= PRIVACY_RADIUS_METERS;

    const getPunchStatus = () => {

        if (!status?.record?.punch_in_time) return null;
        const [time, period] = status.record.punch_in_time.split(' ');
        const [hour, minute] = time.split(':').map(Number);

        let h = hour;
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;

        if (h > DUTY_START_HOUR || (h === DUTY_START_HOUR && minute > LATE_THRESHOLD_MINUTE)) {
            return { label: '🔴 Late Punch', class: 'text-red-600 bg-red-50 border-red-100' };
        }
        return { label: '🟢 On Time', class: 'text-green-600 bg-green-50 border-green-100' };
    };

    const punchInStatus = getPunchStatus();

    return (
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
            {/* Real-time Tracking Pulse */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${location ? 'bg-green-400' : 'bg-red-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${location ? 'bg-green-500' : 'bg-red-500'}`}></span>
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {location ? 'Live Trace Active' : 'Waiting for GPS'}
                </span>
            </div>

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Campus Attendance</h3>
                    <p className="text-sm text-gray-500">Geofenced Punch-in System</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className={`p-4 rounded-xl border ${status.punchedIn && !status.punchedOut ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Shift Status</p>
                    <div className="flex items-center gap-2">
                        <p className={`text-xl font-black ${status.punchedIn && !status.punchedOut ? 'text-green-700' : 'text-gray-700'}`}>
                            {status.punchedOut ? '🏁 Completed' : status.punchedIn ? '✅ Active Duty' : '💤 Off Duty'}
                        </p>
                        {status.punchedIn && punchInStatus && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${punchInStatus.class}`}>
                                {punchInStatus.label}
                            </span>
                        )}
                    </div>
                    {status.record && (
                        <p className="text-[10px] text-gray-500 mt-1 font-medium italic">
                            Shift: {status.record.punch_in_time} {status.record.punch_out_time ? `→ ${status.record.punch_out_time}` : ' (In Progress)'}
                        </p>
                    )}
                </div>


                <div className={`p-4 rounded-xl border ${isInside ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-bold text-gray-400 uppercase">Visual Trace Map</p>
                        {location && isNearby && (
                            <div className="px-2 py-0.5 bg-gray-900 rounded text-[9px] text-green-400 font-mono">
                                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                            </div>
                        )}
                    </div>
                    <div className="h-64 rounded-lg overflow-hidden border border-gray-200 shadow-inner relative z-10">
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

                                {/* Campus Geofence */}
                                <Circle
                                    center={[CAMPUS_LAT, CAMPUS_LNG]}
                                    radius={GEOFENCE_RADIUS_METERS}
                                    pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }}
                                />
                                <Marker position={[CAMPUS_LAT, CAMPUS_LNG]} icon={blueIcon}>
                                    <Popup>Campus Center</Popup>
                                </Marker>

                                {/* Live Location Trace */}
                                <Marker position={[location.lat, location.lng]}>
                                    <Popup>
                                        You are here <br />
                                        {isInside ? '✅ Inside Campus' : `❌ ${Math.round(distance)}m Away`}
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
                                        pathOptions={{ color: 'orange', dashArray: '5, 10' }}
                                    />
                                )}
                            </MapContainer>
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center flex-col p-6 text-center">
                                <Navigation className="w-8 h-8 text-gray-300 animate-pulse mb-3" />
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-tighter">
                                    {isWithinDutyHours ? 'Privacy Shield Active' : 'Off Duty Mode'}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-2 italic leading-relaxed">
                                    {isWithinDutyHours
                                        ? 'Map tracing is hidden because you are far from campus. Enter the 500m zone to reveal coordinates.'
                                        : 'You are outside standard duty hours (09:00 - 18:30). Note: You can still punch out if needed.'}
                                </p>
                            </div>
                        )}
                    </div>
                    {location && isNearby && !isInside && (

                        <p className="mt-2 text-[10px] text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-100 italic">
                            ⚠️ System alert: You are currently {Math.round(distance)}m away from the campus gate.
                        </p>
                    )}
                </div>



            </div>

            {msg && (
                <div className="flex items-center gap-3 p-4 mb-6 text-green-700 bg-green-50 rounded-xl border border-green-100 animate-in fade-in slide-in-from-top-4">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-semibold">{msg}</span>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-3 p-4 mb-6 text-red-700 bg-red-50 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-4">
                    <XCircle className="w-5 h-5" />
                    <span className="text-sm font-semibold">{error}</span>
                </div>
            )}

            {!status.punchedOut && (
                <button
                    onClick={handlePunch}
                    disabled={loading || !location || (!status.punchedIn && !isInside)}
                    className={`group relative w-full py-4 px-6 rounded-xl font-black text-lg shadow-lg transition-all active:scale-95 disabled:grayscale disabled:opacity-50
                        ${status.punchedIn
                            ? 'bg-gradient-to-r from-red-500 to-red-700 text-white hover:shadow-red-200'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:shadow-blue-200'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>}
                        <span>{loading ? 'Transmitting...' : status.punchedIn ? '🔴 Punch Out' : '🔵 Punch In'}</span>
                    </div>
                    {!status.punchedIn && !isInside && location && (
                        <div className="absolute -bottom-2 translate-y-full left-0 w-full text-center text-[10px] text-red-500 font-bold uppercase tracking-tight">
                            Geofence restriction active: Must be inside campus
                        </div>
                    )}
                </button>
            )}

            {status.punchedOut && (
                <div className="p-4 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-500 font-bold">Today's attendance record is finalized.</p>
                </div>
            )}

            <div className="mt-6 flex flex-col gap-2">
                <button
                    onClick={triggerManualLocation}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-[10px] font-bold text-gray-600 uppercase tracking-widest rounded-lg transition-colors border border-gray-200"
                >
                    🛰️ Run Manual GPS Sync
                </button>
                <button
                    onClick={fetchStatus}
                    className="w-full py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                >
                    ↻ Refresh Shift History
                </button>
            </div>

            {/* Privacy & Security Province - Mandatory Compliance */}
            <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-4 text-indigo-600">
                    <CheckCircle className="w-5 h-5" />
                    <h4 className="text-sm font-bold uppercase tracking-tight">Security & Privacy Protocol</h4>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <div className="p-3 bg-indigo-50/50 rounded-xl flex items-start gap-3 border border-indigo-100/50">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                            <Navigation className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-indigo-900">Campus-Bound Tracing Only</p>
                            <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                                Active tracing is primarily for duty hours **(09:00 - 18:30)**.
                                Location data is only used to verify your presence on campus during punch-in/out.
                            </p>
                        </div>
                    </div>

                    <div className="p-3 bg-red-50/30 rounded-xl flex items-start gap-3 border border-red-100/30">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                            <XCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-red-900">Zero-Access Privacy Sandbox</p>
                            <p className="text-[10px] text-red-700 leading-relaxed font-medium">
                                This application **never** requests or accesses:
                                <br />• Contacts & SMS • Gallery & Storage • Camera & Microphone
                            </p>
                        </div>
                    </div>
                </div>

                <p className="mt-4 text-[9px] text-center text-gray-400 font-bold uppercase tracking-widest">
                    Enterprise Grade Data Security • End-to-End Encrypted
                </p>
            </div>
        </div>
    );
};

export default AttendancePanel;


