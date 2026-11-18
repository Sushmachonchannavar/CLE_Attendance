import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Users, Compass, Clock, MapPin, CheckCircle, ShieldAlert } from 'lucide-react';

// Distance calculation between two lat/lng points in meters (Haversine formula)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Calculate spiderfy radial positions around a center point (in meters)
function getSpiderfyPositions(centerLat, centerLng, count) {
    const radiusMeters = count === 2 ? 16 : Math.min(32, 14 + count * 3.5);
    const positions = [];

    for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2;
        const dLat = (radiusMeters / 111320) * Math.sin(angle);
        const dLng =
            (radiusMeters / (111320 * Math.cos((centerLat * Math.PI) / 180))) *
            Math.cos(angle);
        positions.push([centerLat + dLat, centerLng + dLng]);
    }
    return positions;
}

// Custom staff DivIcon
const createCustomStaffIcon = (staff, isSelected, isSpiderfied = false) => {
    const isInside = staff.isInsideCampus;
    const bgColor = isInside ? 'bg-emerald-600' : 'bg-rose-600';
    const initials = (staff.name || 'S')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    const firstName = (staff.name || 'Staff').split(' ')[0];

    const containerStyle = isSelected
        ? 'scale-110 z-[1000]'
        : 'hover:scale-105 transition-transform';

    const ringStyle = isSelected
        ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-white shadow-2xl shadow-amber-500/80'
        : 'shadow-lg border-2 border-white';

    const selectedPing = isSelected
        ? `<span class="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
             <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
             <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border border-white"></span>
           </span>`
        : '';

    const spiderBadge = isSpiderfied
        ? `<span class="absolute -bottom-1 -right-1 px-1 bg-slate-900 text-[8px] text-white rounded font-mono">loc</span>`
        : '';

    return L.divIcon({
        className: 'custom-staff-icon bg-transparent border-0',
        html: `
            <div class="relative flex flex-col items-center cursor-pointer ${containerStyle}">
                ${selectedPing}
                <div class="w-9 h-9 ${bgColor} text-white rounded-2xl flex items-center justify-center ${ringStyle} relative">
                    <span class="font-black text-xs tracking-tight">${initials}</span>
                    ${spiderBadge}
                </div>
                <div class="mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap shadow-sm border border-slate-200/80 ${
                    isSelected
                        ? 'bg-amber-400 text-slate-950 font-black ring-1 ring-amber-500 shadow-md'
                        : 'bg-white/95 text-slate-800'
                }">
                    ${firstName}
                </div>
            </div>
        `,
        iconSize: [44, 52],
        iconAnchor: [22, 26],
        popupAnchor: [0, -26]
    });
};

// Custom cluster DivIcon
const createClusterIcon = (count, hasOutside, isExpanded) => {
    const gradient = hasOutside
        ? 'from-amber-600 to-rose-600'
        : 'from-blue-600 to-indigo-700';

    return L.divIcon({
        className: 'custom-cluster-icon bg-transparent border-0',
        html: `
            <div class="relative flex flex-col items-center cursor-pointer group transition-transform hover:scale-110">
                <div class="w-11 h-11 bg-gradient-to-tr ${gradient} text-white rounded-2xl flex flex-col items-center justify-center border-2 border-white shadow-xl ring-2 ring-indigo-400/40">
                    <span class="text-xs font-black tracking-tight leading-none">${count}</span>
                    <span class="text-[9px] font-bold uppercase tracking-tighter opacity-90 leading-none mt-0.5">STAFF</span>
                </div>
                <div class="mt-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold whitespace-nowrap shadow-md bg-slate-900 text-white border border-slate-700">
                    ${isExpanded ? 'Collapse' : 'Tap to Expand'}
                </div>
            </div>
        `,
        iconSize: [52, 54],
        iconAnchor: [26, 27],
        popupAnchor: [0, -28]
    });
};

// Center anchor icon for spiderfied cluster
const createCenterAnchorIcon = () => {
    return L.divIcon({
        className: 'custom-anchor-icon bg-transparent border-0',
        html: `
            <div class="w-3.5 h-3.5 bg-slate-900 border-2 border-white rounded-full shadow-md flex items-center justify-center cursor-pointer hover:scale-125 transition-transform" title="Click to collapse group">
                <div class="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></div>
            </div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -10]
    });
};

// Campus center landmark icon
const campusCenterIcon = L.divIcon({
    className: 'custom-campus-center bg-transparent border-0',
    html: `
        <div class="relative flex flex-col items-center">
            <div class="w-8 h-8 bg-blue-900 border-2 border-white rounded-xl shadow-lg flex items-center justify-center text-white ring-2 ring-blue-500/40">
                <svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zm0 8.5l-8-4 8-4 8 4-8 4zm0 3.5l-10-5v6l10 5 10-5v-6l-10 5z"/>
                </svg>
            </div>
            <div class="mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-950 text-amber-300 border border-blue-700 shadow whitespace-nowrap">
                CAMPUS CENTER
            </div>
        </div>
    `,
    iconSize: [80, 48],
    iconAnchor: [40, 20],
    popupAnchor: [0, -20]
});

// Campus Center & Geofence defaults
const DEFAULT_LAT = 16.426026;
const DEFAULT_LNG = 74.589250;
const CAMPUS_LAT = import.meta.env.VITE_CAMPUS_LAT ? parseFloat(import.meta.env.VITE_CAMPUS_LAT) : DEFAULT_LAT;
const CAMPUS_LNG = import.meta.env.VITE_CAMPUS_LNG ? parseFloat(import.meta.env.VITE_CAMPUS_LNG) : DEFAULT_LNG;

const GEOFENCE_RADIUS_METERS = 300;
const GEOFENCE_SCALE = GEOFENCE_RADIUS_METERS / 600;

// Campus geofence polygon (12-point perimeter matching institutional boundary)
const CAMPUS_GEOFENCE = [
    { lat: CAMPUS_LAT + 0.005396 * GEOFENCE_SCALE, lng: CAMPUS_LNG + 0.000000 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT + 0.004673 * GEOFENCE_SCALE, lng: CAMPUS_LNG + 0.002813 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT + 0.002698 * GEOFENCE_SCALE, lng: CAMPUS_LNG + 0.004872 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT + 0.000000 * GEOFENCE_SCALE, lng: CAMPUS_LNG + 0.005626 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT - 0.002698 * GEOFENCE_SCALE, lng: CAMPUS_LNG + 0.004872 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT - 0.004673 * GEOFENCE_SCALE, lng: CAMPUS_LNG + 0.002813 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT - 0.005396 * GEOFENCE_SCALE, lng: CAMPUS_LNG + 0.000000 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT - 0.004673 * GEOFENCE_SCALE, lng: CAMPUS_LNG - 0.002813 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT - 0.002698 * GEOFENCE_SCALE, lng: CAMPUS_LNG - 0.004872 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT + 0.000000 * GEOFENCE_SCALE, lng: CAMPUS_LNG - 0.005626 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT + 0.002698 * GEOFENCE_SCALE, lng: CAMPUS_LNG - 0.004872 * GEOFENCE_SCALE },
    { lat: CAMPUS_LAT + 0.004673 * GEOFENCE_SCALE, lng: CAMPUS_LNG - 0.002813 * GEOFENCE_SCALE }
];

const geofenceBounds = L.latLngBounds(CAMPUS_GEOFENCE.map(p => [p.lat, p.lng]));
const defaultCenter = [CAMPUS_LAT, CAMPUS_LNG];

// Tile configuration - Defaulting to free OpenStreetMap without API key requirements
const MAP_TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Map controller to handle initial framing and user selection without reset-jitter on polling
const MapController = ({ selectedStaff, focusTrigger, onResetReady }) => {
    const map = useMap();
    const initializedRef = useRef(false);

    // Initial mount: fit campus geofence bounds with clean margin
    useEffect(() => {
        if (!initializedRef.current && map) {
            map.fitBounds(geofenceBounds, { padding: [35, 35], maxZoom: 17 });
            initializedRef.current = true;
        }
    }, [map]);

    // Provide reset view callback to parent
    useEffect(() => {
        if (onResetReady && map) {
            onResetReady(() => {
                map.fitBounds(geofenceBounds, { padding: [35, 35], maxZoom: 17 });
            });
        }
    }, [map, onResetReady]);

    // Fly to selected staff ONLY when user initiates a selection
    useEffect(() => {
        if (!selectedStaff || !map) return;
        const lat = parseFloat(selectedStaff.latitude);
        const lng = parseFloat(selectedStaff.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
            map.flyTo([lat, lng], 18, {
                duration: 1.2,
                easeLinearity: 0.25
            });
        }
    }, [selectedStaff?.userId, focusTrigger, map]);

    return null;
};

const AdminMapDashboard = ({
    staffList = [],
    selectedEmployeeId = null,
    onSelectEmployee = () => {},
    focusTrigger = 0
}) => {
    const [expandedClusterIds, setExpandedClusterIds] = useState(new Set());
    const resetViewRef = useRef(null);
    const markerRefs = useRef({});

    // Filter valid coordinates
    const validStaff = useMemo(() => {
        return (staffList || []).filter(s => {
            const lat = parseFloat(s.latitude);
            const lng = parseFloat(s.longitude);
            return !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0);
        });
    }, [staffList]);

    // Identify selected staff record
    const selectedStaff = useMemo(() => {
        return validStaff.find(s => s.userId === selectedEmployeeId);
    }, [validStaff, selectedEmployeeId]);

    // Cluster detection: group staff within 10 meters of each other
    const clusters = useMemo(() => {
        const result = [];
        const visited = new Set();
        const CLUSTER_THRESHOLD_METERS = 10;

        for (let i = 0; i < validStaff.length; i++) {
            const current = validStaff[i];
            if (visited.has(current.userId)) continue;

            const group = [current];
            visited.add(current.userId);
            const lat1 = parseFloat(current.latitude);
            const lng1 = parseFloat(current.longitude);

            for (let j = i + 1; j < validStaff.length; j++) {
                const other = validStaff[j];
                if (visited.has(other.userId)) continue;

                const lat2 = parseFloat(other.latitude);
                const lng2 = parseFloat(other.longitude);
                const dist = getDistanceMeters(lat1, lng1, lat2, lng2);

                if (dist <= CLUSTER_THRESHOLD_METERS) {
                    group.push(other);
                    visited.add(other.userId);
                }
            }

            const avgLat = group.reduce((sum, s) => sum + parseFloat(s.latitude), 0) / group.length;
            const avgLng = group.reduce((sum, s) => sum + parseFloat(s.longitude), 0) / group.length;
            const clusterId = `cluster-${group.map(s => s.userId).sort().join('-')}`;

            result.push({
                id: clusterId,
                center: [avgLat, avgLng],
                members: group,
                count: group.length,
                hasOutside: group.some(s => !s.isInsideCampus)
            });
        }

        return result;
    }, [validStaff]);

    // Automatically expand cluster if selected employee belongs to a cluster
    useEffect(() => {
        if (selectedEmployeeId) {
            for (const cluster of clusters) {
                if (cluster.count > 1 && cluster.members.some(m => m.userId === selectedEmployeeId)) {
                    setExpandedClusterIds(prev => {
                        if (prev.has(cluster.id)) return prev;
                        const next = new Set(prev);
                        next.add(cluster.id);
                        return next;
                    });
                    break;
                }
            }
        }
    }, [selectedEmployeeId, clusters]);

    // Auto-open popup on selected staff marker
    useEffect(() => {
        if (selectedEmployeeId && markerRefs.current[selectedEmployeeId]) {
            const timer = setTimeout(() => {
                const marker = markerRefs.current[selectedEmployeeId];
                if (marker && marker.openPopup) {
                    marker.openPopup();
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [selectedEmployeeId, focusTrigger, expandedClusterIds]);

    const toggleCluster = (clusterId) => {
        setExpandedClusterIds(prev => {
            const next = new Set(prev);
            if (next.has(clusterId)) {
                next.delete(clusterId);
            } else {
                next.add(clusterId);
            }
            return next;
        });
    };

    const renderPopupContent = (staff, isSpiderfied = false) => {
        const lat = parseFloat(staff.latitude);
        const lng = parseFloat(staff.longitude);

        return (
            <Popup className="rounded-2xl overflow-hidden shadow-xl border border-slate-200">
                <div className="p-1 min-w-[220px] text-xs">
                    {/* Header */}
                    <div className="font-bold text-sm border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                        <span className="text-slate-900 font-extrabold">{staff.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                            ID: {staff.employeeId}
                        </span>
                    </div>

                    {/* Details list */}
                    <div className="space-y-1.5 text-slate-600">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-400">Campus Status:</span>
                            <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-full border ${
                                staff.isInsideCampus
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                                {staff.isInsideCampus ? 'Inside Campus' : 'Outside Campus'}
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-400">Punch-In Time:</span>
                            <span className="font-medium text-slate-800">{staff.punchInTime || 'N/A'}</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-400">GPS Telemetry:</span>
                            <span className={`font-medium ${staff.stale ? 'text-amber-600 font-bold' : 'text-slate-800'}`}>
                                {staff.stale ? `Stale (${staff.lastUpdatedText})` : staff.lastUpdatedText || 'Just now'}
                            </span>
                        </div>

                        {staff.accuracy !== null && staff.accuracy !== undefined && (
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-400">GPS Accuracy:</span>
                                <span className="font-mono text-slate-800">±{Math.round(staff.accuracy)}m</span>
                            </div>
                        )}

                        {/* Coordinates Footer */}
                        <div className="pt-2 mt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex flex-col gap-0.5">
                            <div className="flex justify-between">
                                <span>Actual Latitude:</span>
                                <span className="text-slate-700 font-bold">{lat.toFixed(5)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Actual Longitude:</span>
                                <span className="text-slate-700 font-bold">{lng.toFixed(5)}</span>
                            </div>
                            {isSpiderfied && (
                                <div className="text-amber-600 font-sans font-semibold text-[10px] mt-0.5">
                                    * Spiderfied layout (co-located staff)
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Popup>
        );
    };

    return (
        <div className="flex-1 relative z-0 h-full w-full">
            {/* Floating Quick Action Overlay */}
            <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2 pointer-events-auto">
                <button
                    onClick={() => {
                        if (resetViewRef.current) resetViewRef.current();
                    }}
                    title="Fit whole campus geofence"
                    className="px-3 py-2 bg-white/95 hover:bg-white text-slate-700 hover:text-blue-700 text-xs font-bold rounded-xl shadow-lg border border-slate-200/90 backdrop-blur-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                    <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Campus View</span>
                </button>
            </div>

            <MapContainer
                center={defaultCenter}
                zoom={16}
                minZoom={11}
                maxZoom={20}
                scrollWheelZoom={true}
                touchZoom={true}
                doubleClickZoom={true}
                zoomControl={true}
                className="w-full h-full z-0"
                style={{ minHeight: '480px' }}
            >
                <TileLayer
                    url={MAP_TILE_URL}
                    attribution={MAP_ATTRIBUTION}
                    maxZoom={20}
                />

                <MapController
                    selectedStaff={selectedStaff}
                    focusTrigger={focusTrigger}
                    onResetReady={(fn) => {
                        resetViewRef.current = fn;
                    }}
                />

                {/* Campus Geofence Perimeter Polygon */}
                <Polygon
                    positions={CAMPUS_GEOFENCE.map(p => [p.lat, p.lng])}
                    pathOptions={{
                        color: '#1e40af',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.15,
                        weight: 2.5
                    }}
                />

                {/* Campus Center Landmark Marker */}
                <Marker position={[CAMPUS_LAT, CAMPUS_LNG]} icon={campusCenterIcon}>
                    <Popup className="rounded-2xl">
                        <div className="p-1 text-xs">
                            <h5 className="font-extrabold text-slate-900 text-sm">CLE Society Campus Center</h5>
                            <p className="text-slate-500 mt-1">Institutional Geofence Origin (Radius 300m)</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-1">
                                {CAMPUS_LAT.toFixed(6)}, {CAMPUS_LNG.toFixed(6)}
                            </p>
                        </div>
                    </Popup>
                </Marker>

                {/* Render Staff Clusters / Markers */}
                {clusters.map((cluster) => {
                    // Single staff member at this location
                    if (cluster.count === 1) {
                        const staff = cluster.members[0];
                        const lat = parseFloat(staff.latitude);
                        const lng = parseFloat(staff.longitude);
                        const isSelected = staff.userId === selectedEmployeeId;

                        return (
                            <Marker
                                key={staff.userId}
                                ref={el => {
                                    if (el) markerRefs.current[staff.userId] = el;
                                }}
                                position={[lat, lng]}
                                icon={createCustomStaffIcon(staff, isSelected, false)}
                                zIndexOffset={isSelected ? 1000 : 0}
                                eventHandlers={{
                                    click: () => onSelectEmployee(staff.userId)
                                }}
                            >
                                {renderPopupContent(staff, false)}
                            </Marker>
                        );
                    }

                    // Multiple staff members at this location
                    const isExpanded = expandedClusterIds.has(cluster.id);

                    if (!isExpanded) {
                        // Collapsed Cluster Marker
                        return (
                            <Marker
                                key={cluster.id}
                                position={cluster.center}
                                icon={createClusterIcon(cluster.count, cluster.hasOutside, false)}
                                eventHandlers={{
                                    click: () => toggleCluster(cluster.id)
                                }}
                            >
                                <Popup className="rounded-2xl">
                                    <div className="p-1 min-w-[210px] text-xs">
                                        <div className="font-extrabold text-slate-900 pb-1.5 mb-1.5 border-b border-slate-100 flex items-center justify-between">
                                            <span>Staff Cluster</span>
                                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                                {cluster.count} Personnel
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mb-2">
                                            Multiple staff members co-located at this point:
                                        </p>
                                        <div className="space-y-1 mb-2 max-h-36 overflow-y-auto">
                                            {cluster.members.map((m) => (
                                                <button
                                                    key={m.userId}
                                                    onClick={() => {
                                                        toggleCluster(cluster.id);
                                                        onSelectEmployee(m.userId);
                                                    }}
                                                    className="w-full text-left px-2 py-1.5 bg-slate-50 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                                                >
                                                    <span>{m.name}</span>
                                                    <span className={`text-[9px] uppercase font-bold ${
                                                        m.isInsideCampus ? 'text-emerald-600' : 'text-rose-600'
                                                    }`}>
                                                        {m.isInsideCampus ? 'Inside' : 'Outside'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => toggleCluster(cluster.id)}
                                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold text-center transition-colors cursor-pointer"
                                        >
                                            Spiderfy / Separate Markers
                                        </button>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    }

                    // Expanded (Spiderfied) Cluster
                    const spiderPositions = getSpiderfyPositions(
                        cluster.center[0],
                        cluster.center[1],
                        cluster.count
                    );

                    return (
                        <React.Fragment key={cluster.id}>
                            {/* Physical center anchor dot */}
                            <Marker
                                position={cluster.center}
                                icon={createCenterAnchorIcon()}
                                eventHandlers={{
                                    click: () => toggleCluster(cluster.id)
                                }}
                            >
                                <Popup className="rounded-2xl">
                                    <div className="p-1 text-xs">
                                        <div className="font-bold text-slate-800">Cluster Origin Point</div>
                                        <p className="text-slate-500 text-[11px] mt-0.5">
                                            {cluster.count} staff members are physically at this coordinate.
                                        </p>
                                        <button
                                            onClick={() => toggleCluster(cluster.id)}
                                            className="mt-2 w-full py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold"
                                        >
                                            Collapse Spiderfy
                                        </button>
                                    </div>
                                </Popup>
                            </Marker>

                            {/* Render spider legs and offset markers */}
                            {cluster.members.map((staff, idx) => {
                                const visualPos = spiderPositions[idx];
                                const isSelected = staff.userId === selectedEmployeeId;

                                return (
                                    <React.Fragment key={staff.userId}>
                                        {/* Connecting spider leg polyline */}
                                        <Polyline
                                            positions={[cluster.center, visualPos]}
                                            pathOptions={{
                                                color: isSelected ? '#d97706' : '#64748b',
                                                weight: isSelected ? 2.5 : 1.75,
                                                dashArray: '4, 4',
                                                opacity: 0.85
                                            }}
                                        />

                                        {/* Individual spiderfied marker */}
                                        <Marker
                                            ref={el => {
                                                if (el) markerRefs.current[staff.userId] = el;
                                            }}
                                            position={visualPos}
                                            icon={createCustomStaffIcon(staff, isSelected, true)}
                                            zIndexOffset={isSelected ? 1000 : 0}
                                            eventHandlers={{
                                                click: () => onSelectEmployee(staff.userId)
                                            }}
                                        >
                                            {renderPopupContent(staff, true)}
                                        </Marker>
                                    </React.Fragment>
                                );
                            })}
                        </React.Fragment>
                    );
                })}
            </MapContainer>
        </div>
    );
};

export default AdminMapDashboard;
