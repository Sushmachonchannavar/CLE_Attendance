import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

// Reusable distance calculation helper (Haversine formula) at module scope
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // in meters
};

const LocationTracker = () => {
    const { user } = useAuth();
    const isPunchedInRef = useRef(false);
    const watchIdRef = useRef(null);
    const intervalIdRef = useRef(null);
    const lastSentLocationRef = useRef(null);

    const stopTracking = useCallback(() => {
        if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }
        lastSentLocationRef.current = null;
        console.log("Location tracking stopped.");
    }, []);

    const sendLocation = useCallback(async (lat, lng, accuracy) => {
        try {
            console.log("Sending background location update:", { lat, lng, accuracy });
            await api.post('/employee/location', { lat, lng, accuracy });
            lastSentLocationRef.current = { lat, lng, time: Date.now() };
        } catch (err) {
            console.error("Failed to send location update:", err.message || err);
        }
    }, []);

    const startTracking = useCallback(() => {
        if (watchIdRef.current) return; // already tracking

        if (!navigator.geolocation) {
            console.error("Geolocation not supported for tracking.");
            return;
        }

        console.log("Location tracking started.");

        // First immediate request to get a quick lock
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                sendLocation(latitude, longitude, accuracy);
            },
            (err) => {
                console.error("Initial position watch failed:", err.message || err);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );

        // Set up watchPosition to get high-accuracy coordinates
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;

                // Check if accuracy is within limits (ignore extremely poor GPS signals > 100m)
                if (accuracy && accuracy > 100) return;

                const lastSent = lastSentLocationRef.current;
                if (!lastSent) {
                    sendLocation(latitude, longitude, accuracy);
                } else {
                    const dist = getDistance(latitude, longitude, lastSent.lat, lastSent.lng);
                    // If moved more than 10 meters, update immediately
                    if (dist > 10) {
                        console.log(`User moved ${dist.toFixed(1)}m. Sending immediate update.`);
                        sendLocation(latitude, longitude, accuracy);
                    }
                }
            },
            (err) => {
                console.error("Watch position failed in tracker:", err.message || err);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );

        // Set up interval for periodic check
        const checkInterval = import.meta.env.VITE_LOCATION_INTERVAL
            ? parseInt(import.meta.env.VITE_LOCATION_INTERVAL, 10)
            : 30000; // default 30 seconds

        intervalIdRef.current = setInterval(() => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude, longitude, accuracy } = pos.coords;
                        const lastSent = lastSentLocationRef.current;
                        const now = Date.now();
                        // If no location has been sent, or if checkInterval has passed, send it
                        if (!lastSent || (now - lastSent.time >= checkInterval)) {
                            sendLocation(latitude, longitude, accuracy);
                        }
                    },
                    (err) => {
                        console.error("Periodic getCurrentPosition failed:", err.message || err);
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            }
        }, checkInterval);
    }, [sendLocation]);

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
            console.error("Failed to check status in location tracker:", err.message || err);
            stopTracking();
        }
    }, [startTracking, stopTracking]);

    useEffect(() => {
        if (!user || user.role?.toLowerCase() !== 'staff') {
            stopTracking();
            return;
        }

        // Check status on mount
        checkPunchStatus();

        // Listen for punch status change events from AttendancePanel
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

    return null; // This component doesn't render anything visually
};

export default LocationTracker;
