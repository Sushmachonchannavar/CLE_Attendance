import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation } from 'lucide-react';

// Setup custom marker icon using Leaflet divIcon for styling via Tailwind
const createCustomIcon = (name) => {
    return L.divIcon({
        className: 'custom-icon bg-transparent border-0',
        html: `<div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-lg shadow-blue-500/50">
                 <span class="text-white font-bold text-xs">${name.charAt(0)}</span>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
};

const defaultCenter = [16.42578, 74.58970]; // Default fallback coordinate (Campus)

// Utility for calculating distance in meters between two coordinates
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Distance in meters
};

const AdminMapDashboard = ({ staffList = [], centralCoordinate = defaultCenter }) => {
    const [showWorkZone, setShowWorkZone] = useState(true);

    // Filter staff to ONLY those within the 100m radius of the campus center
    const activeStaffOnCampus = staffList.filter((staff) => {
        const distance = getDistanceFromLatLonInMeters(
            staff.lat, 
            staff.lng, 
            centralCoordinate[0], 
            centralCoordinate[1]
        );
        return distance <= 100;
    });

    return (
        <div className="flex flex-col h-[600px] w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            {/* Header / Controls */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
                <div className="flex items-center gap-2">
                    <MapPin className="text-cyan-400" />
                    <h2 className="text-lg font-bold">Live Staff Tracker</h2>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <span className={showWorkZone ? 'text-cyan-400' : 'text-gray-400 transition-colors'}>Work Zone</span>
                        <div className={`relative w-10 h-5 transition duration-200 ease-linear rounded-full ${showWorkZone ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                            <input 
                                type="checkbox" 
                                className="sr-only" 
                                checked={showWorkZone}
                                onChange={() => setShowWorkZone(!showWorkZone)}
                            />
                            <span className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white border-2 rounded-full transition-transform duration-200 ease-linear ${showWorkZone ? 'translate-x-5 border-cyan-500' : 'translate-x-0 border-gray-600'}`}></span>
                        </div>
                    </label>
                </div>
            </div>
            
            {/* Privacy Notification Bar */}
            <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center justify-between text-xs text-indigo-700 font-medium">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    Privacy Shield Active: Location tracing is restricted to campus bounds only (100m radius).
                </div>
                <div className="font-bold bg-white px-2 py-1 rounded text-indigo-900 shadow-sm">
                    {activeStaffOnCampus.length} Staff on Campus
                </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative z-0">
                <MapContainer center={centralCoordinate} zoom={15} className="w-full h-full z-0">
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    
                    {/* Work Zone Radius */}
                    {showWorkZone && (
                        <Circle 
                            center={centralCoordinate} 
                            radius={100} 
                            pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.15, weight: 2 }} 
                        />
                    )}

                    {/* Staff Markers (Filtered to on-campus only) */}
                    {activeStaffOnCampus.map((staff, idx) => (
                        <Marker 
                            key={idx} 
                            position={[staff.lat, staff.lng]} 
                            icon={createCustomIcon(staff.name)}
                        >
                            <Popup className="rounded-lg overflow-hidden">
                                <div className="p-1 min-w-[160px]">
                                    <div className="font-bold text-gray-800 text-base mb-1">{staff.name}</div>
                                    <div className="text-xs text-gray-500 mb-3">
                                        Last Updated: <span className="font-medium text-gray-700">{staff.lastUpdated || 'Just now'}</span>
                                    </div>
                                    <button 
                                        onClick={() => alert(`Fetching route history for ${staff.name}...`)}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-3 rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition shadow-md active:scale-95"
                                    >
                                        <Navigation size={14} />
                                        View History
                                    </button>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
};

export default AdminMapDashboard;
