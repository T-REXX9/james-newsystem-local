import React, { useEffect, useState } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { AlertCircle, Map, Users, Sparkles, Zap } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import SalesMapSidebar from './SalesMapSidebar';

// Using the valid GeoJSON Source we found
const GEOJSON_URL = 'https://raw.githubusercontent.com/macoymejia/geojsonph/master/Province/Provinces.json';

const generateMockCustomerData = (provinceName: string) => {
    // Generate random customer count (0-20 range for demo)
    const customerCount = Math.floor(Math.random() * 21);
    return {
        customerCount,
        revenue: Math.floor(Math.random() * 800000) + 100000,
    };
};

const MapController = () => {
    const map = useMap();
    useEffect(() => {
        map.invalidateSize();

        const timer = setTimeout(() => {
            const southWest = L.latLng(4.2, 116.0);
            const northEast = L.latLng(21.5, 128.5);
            const bounds = L.latLngBounds(southWest, northEast);

            const fitZoom = map.getBoundsZoom(bounds);

            map.setMaxBounds(bounds);
            // @ts-ignore
            map.options.maxBoundsViscosity = 1.0;

            map.setMinZoom(fitZoom);
            map.options.minZoom = fitZoom;

            map.fitBounds(bounds);
        }, 100);

        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

const SalesMap = () => {
    const [geoData, setGeoData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

    useEffect(() => {
        const fetchGeoJSON = async () => {
            try {
                const response = await fetch(GEOJSON_URL);
                if (!response.ok) throw new Error('Failed to load map data');
                const data = await response.json();

                const enhancedFeatures = data.features.map((feature: any) => {
                    const name = feature.properties.PROVINCE || feature.properties.NAME_1 || "Unknown";
                    return {
                        ...feature,
                        properties: {
                            ...feature.properties,
                            provinceName: name,
                            customerData: generateMockCustomerData(name)
                        }
                    };
                });

                setGeoData({ ...data, features: enhancedFeatures });
            } catch (err) {
                console.error("GeoJSON Error:", err);
                setError("Could not load high-fidelity map data.");
            } finally {
                setLoading(false);
            }
        };
        fetchGeoJSON();
    }, []);

    const getCustomerColor = (count: number): string => {
        if (count === 0) return '#ef4444'; // Red - No customers
        if (count <= 5) return '#3b82f6';  // Blue - 1-5 customers (contingent)
        if (count <= 10) return '#22c55e'; // Green - 6-10 customers (above 5)
        return '#eab308';                   // Yellow - 10+ customers (many)
    };

    const styleFeature = (feature: any) => {
        const isSelected = selectedProvince === feature.properties.provinceName;
        const customerCount = feature.properties.customerData.customerCount;
        const fillColor = getCustomerColor(customerCount);

        return {
            fillColor,
            weight: isSelected ? 3 : 1,
            opacity: 1,
            color: isSelected ? '#6366f1' : '#94a3b8',
            dashArray: '',
            fillOpacity: isSelected ? 0.95 : 0.85,
        };
    };

    const onEachFeature = (feature: any, layer: any) => {
        const provinceName = feature.properties.provinceName;

        layer.on({
            mouseover: (e: any) => {
                const layer = e.target;
                if (selectedProvince !== provinceName) {
                    layer.setStyle({
                        weight: 2,
                        color: '#64748b',
                        fillOpacity: 1,
                    });
                    layer.bringToFront();
                }
            },
            mouseout: (e: any) => {
                const layer = e.target;
                if (selectedProvince !== provinceName) {
                    layer.setStyle({
                        weight: 1,
                        color: '#cbd5e1',
                        fillOpacity: 0.8,
                    });
                }
            },
            click: () => {
                setSelectedProvince(prev => prev === provinceName ? null : provinceName);
            }
        });

        layer.bindTooltip(provinceName, {
            permanent: false,
            direction: 'center',
            className: 'map-tooltip-light'
        });
    };

    // Calculate stats from geoData based on customer counts
    const stats = geoData ? {
        total: geoData.features.length,
        none: geoData.features.filter((f: any) => f.properties.customerData.customerCount === 0).length,
        contingent: geoData.features.filter((f: any) => f.properties.customerData.customerCount >= 1 && f.properties.customerData.customerCount <= 5).length,
        above5: geoData.features.filter((f: any) => f.properties.customerData.customerCount >= 6 && f.properties.customerData.customerCount <= 10).length,
        many: geoData.features.filter((f: any) => f.properties.customerData.customerCount > 10).length,
    } : { total: 0, none: 0, contingent: 0, above5: 0, many: 0 };

    return (
        <div className="h-full w-full relative overflow-hidden flex bg-slate-100">
            {/* Subtle Grid Pattern Overlay */}
            <div
                className="absolute inset-0 opacity-[0.4]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(148,163,184,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(148,163,184,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                }}
            />

            {/* Ambient Glow Effects - Light Theme */}
            <div className="absolute top-20 left-20 w-[500px] h-[500px] bg-indigo-200/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-20 right-20 w-[400px] h-[400px] bg-emerald-200/30 rounded-full blur-[100px]" />

            {/* Main Map Container */}
            <div className={`flex-1 flex flex-col transition-all duration-500 ease-out ${selectedProvince ? 'mr-0' : ''}`}>

                {/* Premium Header Card */}
                <div className="absolute top-6 left-6 z-[1000] pointer-events-auto">
                    <div className="relative group">
                        {/* Glow Effect Behind Card */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-400/20 via-purple-400/20 to-pink-400/20 rounded-3xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Main Card */}
                        <div className="relative bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
                                    <Map className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold tracking-tight text-slate-800">Sales Territory Map</h1>
                                    <p className="text-xs text-slate-500">Real-time performance overview</p>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="flex flex-wrap gap-2">
                                <div className="flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                    <span className="text-[11px] font-medium text-red-700">None</span>
                                    <span className="text-[10px] font-bold text-red-700 bg-red-200 px-1.5 rounded-full">{stats.none}</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                    <span className="text-[11px] font-medium text-blue-700">1-5</span>
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-200 px-1.5 rounded-full">{stats.contingent}</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                    <span className="text-[11px] font-medium text-green-700">6-10</span>
                                    <span className="text-[10px] font-bold text-green-700 bg-green-200 px-1.5 rounded-full">{stats.above5}</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-yellow-50 px-2.5 py-1 rounded-full border border-yellow-300">
                                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                                    <span className="text-[11px] font-medium text-yellow-700">10+</span>
                                    <span className="text-[10px] font-bold text-yellow-700 bg-yellow-200 px-1.5 rounded-full">{stats.many}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Floating Stats Badge */}
                <div className="absolute top-6 right-6 z-[1000] pointer-events-auto">
                    <div className="flex items-center gap-2 bg-white/90 backdrop-blur-xl px-4 py-2 rounded-full border border-slate-200 shadow-lg shadow-slate-200/50">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-medium text-slate-600">{stats.total} Provinces</span>
                    </div>
                </div>

                {/* Elevated Map Frame */}
                <div className="flex-1 relative p-6">
                    {/* Outer Glow */}
                    <div className="absolute inset-6 bg-gradient-to-br from-indigo-200/40 via-purple-200/20 to-pink-200/40 rounded-[32px] blur-2xl" />

                    {/* Map Container with Elevated Frame */}
                    <div className="relative h-full w-full rounded-3xl overflow-hidden shadow-2xl shadow-slate-300/70">
                        {/* Inner Frame Border */}
                        <div className="absolute inset-0 rounded-3xl border border-white/60 z-10 pointer-events-none" />

                        {/* Inner Shadow for Depth */}
                        <div className="absolute inset-0 rounded-3xl z-10 pointer-events-none"
                            style={{
                                boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.06), inset 0 -2px 20px rgba(255,255,255,0.8)'
                            }}
                        />

                        {/* Top Highlight */}
                        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white to-transparent z-10 pointer-events-none" />

                        {/* Map Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50" />

                        {/* Loading State */}
                        {loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-[500] bg-white/90 backdrop-blur-sm">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-indigo-200 rounded-full blur-xl animate-pulse" />
                                    <div className="relative mb-4">
                                        <CustomLoadingSpinner label="Loading" />
                                    </div>
                                </div>
                                <span className="text-slate-600 font-medium">Loading Topology...</span>
                                <div className="flex gap-1 mt-3">
                                    {[0, 1, 2].map((i) => (
                                        <div
                                            key={i}
                                            className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
                                            style={{ animationDelay: `${i * 0.15}s` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {!loading && error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-[500] bg-slate-50">
                                <div className="p-4 bg-rose-100 rounded-full mb-4">
                                    <AlertCircle className="h-10 w-10 text-rose-500" />
                                </div>
                                <span className="text-rose-600 font-medium">{error}</span>
                            </div>
                        )}

                        {/* The Map */}
                        {!loading && !error && (
                            <MapContainer
                                center={[12.8797, 121.7740]}
                                zoom={6}
                                scrollWheelZoom={true}
                                className="h-full w-full outline-none"
                                style={{ background: 'transparent' }}
                                zoomControl={false}
                                // @ts-ignore
                                renderer={L.canvas({ padding: 0.5 })}
                            >
                                <MapController />

                                {geoData && (
                                    <GeoJSON
                                        key="ph-provinces"
                                        data={geoData}
                                        style={styleFeature}
                                        onEachFeature={onEachFeature}
                                    />
                                )}
                            </MapContainer>
                        )}

                        {/* Bottom Gradient Fade */}
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-100/80 to-transparent z-10 pointer-events-none" />

                        {/* Corner Decorations */}
                        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-slate-300/50 rounded-tl-lg z-10 pointer-events-none" />
                        <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-slate-300/50 rounded-tr-lg z-10 pointer-events-none" />
                        <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-slate-300/50 rounded-bl-lg z-10 pointer-events-none" />
                        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-slate-300/50 rounded-br-lg z-10 pointer-events-none" />
                    </div>
                </div>

                {/* Bottom Info Bar */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
                    <div className="flex items-center gap-3 bg-white/90 backdrop-blur-xl px-5 py-2.5 rounded-full border border-slate-200 shadow-lg shadow-slate-200/50">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-slate-500">Click on a province to view detailed insights</span>
                    </div>
                </div>
            </div>

            {/* Slide-out Sidebar */}
            {selectedProvince && (
                <SalesMapSidebar
                    provinceName={selectedProvince}
                    onClose={() => setSelectedProvince(null)}
                />
            )}

            {/* Custom Tooltip Styles */}
            <style>{`
                .map-tooltip-light {
                    background: rgba(255, 255, 255, 0.95) !important;
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(148, 163, 184, 0.3) !important;
                    border-radius: 10px !important;
                    padding: 8px 14px !important;
                    font-size: 12px !important;
                    font-weight: 600 !important;
                    color: #1e293b !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1) !important;
                }
                .map-tooltip-light::before {
                    display: none !important;
                }
                .leaflet-container {
                    background: transparent !important;
                }
            `}</style>
        </div>
    );
};

export default SalesMap;
