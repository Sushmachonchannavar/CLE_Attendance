import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Setup custom marker icon using Leaflet divIcon for styling via Tailwind
const createCustomIcon = (name, isInside) => {
    const bgColor = isInside ? 'bg-emerald-600 border-white shadow-emerald-500/40' : 'bg-rose-600 border-white shadow-rose-500/40';
    return L.divIcon({
        className: 'custom-icon bg-transparent border-0',
        html: `<div class="w-8 h-8 ${bgColor} rounded-2xl flex items-center justify-center border-2 shadow-lg transition-transform hover:scale-110">
                 <span class="text-white font-extrabold text-xs tracking-tight">${name.charAt(0).toUpperCase()}</span>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
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

const defaultCenter = [CAMPUS_LAT, CAMPUS_LNG];

// Helper component to recenter map dynamically when centralCoordinate changes
const RecenterMap = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.setView(coords, 16);
        }
    }, [coords, map]);
    return null;
};

const AdminMapDashboard = ({ staffList = [], centralCoordinate = defaultCenter }) => {
    return (
        <div className="flex-1 relative z-0 h-full w-full">
            <MapContainer center={centralCoordinate} zoom={16} className="w-full h-full z-0" style={{ minHeight: '480px' }}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <RecenterMap coords={centralCoordinate} />

                {/* Campus Geofence Polygon */}
                <Polygon
                    positions={CAMPUS_GEOFENCE.map(p => [p.lat, p.lng])}
                    pathOptions={{ color: '#1e40af', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2.5 }}
                />

                {/* Staff Markers */}
                {staffList.map((staff, idx) => {
                    const lat = parseFloat(staff.latitude);
                    const lng = parseFloat(staff.longitude);
                    if (isNaN(lat) || isNaN(lng)) return null;

                    return (
                        <Marker
                            key={staff.userId || idx}
                            position={[lat, lng]}
                            icon={createCustomIcon(staff.name, staff.isInsideCampus)}
                        >
                            <Popup className="rounded-2xl overflow-hidden">
                                <div className="p-1 min-w-[210px] text-xs">
                                    <div className="font-bold text-sm border-b border-slate-100 pb-1.5 mb-2 flex items-center justify-between">
                                        <span className="text-slate-900">{staff.name}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">ID: {staff.employeeId}</span>
                                    </div>
                                    <div className="space-y-1.5 text-slate-600">
                                        <div>
                                            <span className="font-semibold text-slate-400">Status:</span>{' '}
                                            <span className={`font-bold uppercase ${staff.isInsideCampus ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {staff.isInsideCampus ? 'Inside Campus' : 'Outside Campus'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-400">Punch-In:</span>{' '}
                                            <span className="font-medium text-slate-800">{staff.punchInTime || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-400">Last Telemetry:</span>{' '}
                                            <span className="font-medium text-slate-800">
                                                {staff.lastUpdatedText || 'Just now'}
                                            </span>
                                        </div>
                                        {staff.accuracy !== null && staff.accuracy !== undefined && (
                                            <div>
                                                <span className="font-semibold text-slate-400">GPS Accuracy:</span>{' '}
                                                <span className="font-mono text-slate-800">{Math.round(staff.accuracy)}m</span>
                                            </div>
                                        )}
                                        <div className="text-[10px] text-slate-400 mt-2 font-mono pt-1 border-t border-slate-100">
                                            Coords: {lat.toFixed(5)}, {lng.toFixed(5)}
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
};

export default AdminMapDashboard;
