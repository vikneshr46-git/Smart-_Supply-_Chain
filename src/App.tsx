/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  Truck, 
  CloudSun, 
  ShieldCheck, 
  Search,
  Activity,
  History,
  ChevronRight,
  Zap,
  BarChart3,
  Globe,
  Users,
  Mic,
  Navigation2,
  LifeBuoy,
  HelpCircle,
  Maximize2,
  Lock,
  Layers,
  Map as MapIcon,
  MessageSquare,
  X,
  Camera,
  Upload,
  Phone,
  HeartPulse,
  Shield,
  Baby,
  AlertCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cn } from './lib/utils';
import { predictShipmentRisks, PredictionData } from './services/geminiService';

// Fix Leaflet icon issue using CDN or divIcon
const blueIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const destIcon = L.divIcon({
  className: 'custom-marker-dest',
  html: `<div class="w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-lg"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const userCenterIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div class="relative"><div class="w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-lg relative z-10"></div><div class="absolute inset-0 w-5 h-5 bg-blue-400 rounded-full animate-ping opacity-75"></div></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Types
interface Shipment {
  id: string;
  origin: string;
  destination: string;
  deadline: string;
  status: 'In Transit' | 'Delivered' | 'Pending' | 'Delayed';
  currentLocation: string;
  progress: number;
  weather: string;
  speed: string;
  eta: string;
  prediction?: PredictionData;
}

type TabType = 'Deployment' | 'Volunteer' | 'Tracking' | 'Emergency' | 'Help';

// Helper Map Updater
function ChangeView({ center, zoom, shouldReset }: { center: [number, number], zoom: number, shouldReset?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (shouldReset) {
      map.setView(center, zoom);
    }
  }, [shouldReset]); // Only trigger when we explicitly want to reset/center
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('Deployment');
  const [activeShipment, setActiveShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ origin: '', destination: '', deadline: '' });
  const [isMapMaximized, setIsMapMaximized] = useState(false);
  const [shipmentLog, setShipmentLog] = useState<Record<string, { livePos: [number, number] | null, route: [number, number][] }>>({});
  const [shouldCenter, setShouldCenter] = useState(false);
  const [volunteerMode, setVolunteerMode] = useState<'selection' | 'register' | 'signup'>('selection');
  const [volunteerForm, setVolunteerForm] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    area: '', 
    districtState: '', 
    pincode: '', 
    password: '' 
  });
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRiskPopupOpen, setIsRiskPopupOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [isVolunteerLoggedIn, setIsVolunteerLoggedIn] = useState(false);
  const [problemReport, setProblemReport] = useState({ description: '', severity: 'Low' });
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  
  const handleVolunteerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`${isRegisterModalOpen ? 'Registration' : 'Sign up'} successful! Welcome to the network.`);
    setIsRegisterModalOpen(false);
    setVolunteerForm({ 
      name: '', email: '', phone: '', area: '', districtState: '', pincode: '', password: '' 
    });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVolunteerLoggedIn(true);
    setIsLoginModalOpen(false);
    setLoginForm({ email: '', password: '' });
  };
  
  // Get current shipment state
  const currentLivePos = activeShipment ? shipmentLog[activeShipment.id]?.livePos : null;
  const currentRoute = activeShipment ? shipmentLog[activeShipment.id]?.route : [];
  
  // Fetch real road route from OSRM
  const fetchRoute = async (origin: [number, number], dest: [number, number]) => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      if (data.routes && data.routes[0]) {
        const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        return coords as [number, number][];
      }
    } catch (error) {
      console.error("Routing error:", error);
      return [origin, dest] as [number, number][];
    }
    return [[0,0]]; // Should not happen
  };

  // Simulation for live tracking
  useEffect(() => {
    if (activeShipment?.prediction && !shipmentLog[activeShipment.id]) {
      const { id } = activeShipment;
      const { originCoords, destinationCoords } = activeShipment.prediction;
      
      fetchRoute(originCoords, destinationCoords).then((path) => {
        if (!path || path.length === 0) return;
        
        setShouldCenter(true);
        setTimeout(() => setShouldCenter(false), 1000);

        // Initialize log entry
        setShipmentLog(prev => ({
          ...prev,
          [id]: { livePos: path[0] as [number, number], route: path as [number, number][] }
        }));

        let currentIndex = 0;
        const interval = setInterval(() => {
          currentIndex++;
          if (currentIndex < path.length) {
            setShipmentLog(prev => ({
              ...prev,
              [id]: { ...prev[id], livePos: path[currentIndex] as [number, number] }
            }));
          } else {
            clearInterval(interval);
          }
        }, 4000); // Slower, more stable updates
        
        return () => clearInterval(interval);
      });
    }
  }, [activeShipment, shipmentLog]);

  const [recentShipments] = useState<Shipment[]>([
    {
      id: 'SC-1004',
      origin: 'Port of Rotterdam, NL',
      destination: 'Hamburg, DE',
      deadline: '2026-04-26 14:00',
      status: 'In Transit',
      currentLocation: 'North Sea Transit',
      progress: 65,
      weather: 'Heavy Rain',
      speed: '14.2 knots',
      eta: '8 hrs'
    }
  ]);

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.origin || !formData.destination || !formData.deadline) return;

    setLoading(true);
    const prediction = await predictShipmentRisks(formData.destination, formData.deadline, formData.origin);
    
    if (prediction.confidenceScore <= 0.75) {
      setIsRiskPopupOpen(true);
    }
    
    const newShipment: Shipment = {
      id: `SC-${Math.floor(1000 + Math.random() * 9000).toString()}`,
      origin: formData.origin,
      destination: formData.destination,
      deadline: formData.deadline,
      status: 'In Transit',
      currentLocation: `${formData.origin} Logistics Center`,
      progress: 5,
      weather: prediction.weatherImpact,
      speed: prediction.avgVelocity,
      eta: prediction.etaHours,
      prediction
    };

    setActiveShipment(newShipment);
    setActiveTab('Tracking');
    setLoading(false);
  };

  const [showLocationPopup, setShowLocationPopup] = useState(true);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);

  const handleLocationAllow = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserCoords({ lat: latitude, lng: longitude });
          setFormData(prev => ({ ...prev, origin: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` }));
          setShowLocationPopup(false);
        },
        (error) => {
          console.error("Location error:", error);
          setShowLocationPopup(false);
        }
      );
    } else {
      setShowLocationPopup(false);
    }
  };

  const handleLocationDeny = () => {
    setShowLocationPopup(false);
  };

  const tabs = [
    { id: 'Deployment', label: 'New Deployment', icon: Zap },
    { id: 'Volunteer', label: 'Volunteer System', icon: Users },
    { id: 'Tracking', label: 'Live Tracking', icon: Navigation2 },
    { id: 'Emergency', label: 'Emergency Request', icon: LifeBuoy },
    { id: 'Help', label: 'System Help', icon: HelpCircle },
  ] as const;

  const ActiveTabIcon = tabs.find(t => t.id === activeTab)?.icon || HelpCircle;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Layer */}
      <div className="glow-bg">
        <div className="glow-point-1"></div>
        <div className="glow-point-2"></div>
        <div className="grid-overlay"></div>
      </div>

      {/* Navigation */}
      <nav className="glass-nav sticky top-0 z-50 h-16 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">S</div>
          <span className="text-xl font-semibold tracking-tight text-white">SmartChain <span className="text-blue-400">AI</span></span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Network Status</span>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div>
              <span className="text-xs font-medium text-slate-200 uppercase tracking-tighter">Secure Link</span>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-white/10 transition-colors">
            <Search className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </nav>

      {/* Main Grid Layout - 3-6-3 Column Structure */}
      <main className="max-w-[1600px] mx-auto grid grid-cols-12 gap-6 p-6 h-[calc(100vh-64px)]">
        
        {/* Left Column (3) - Controls & Feature Tabs */}
        <section className="col-span-12 lg:col-span-3 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* New Logistics Plan */}
          <div className="glass p-6">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Deployment Control
            </h3>
            <form onSubmit={handlePredict} className="space-y-4">
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1.5 tracking-wider">From Location</label>
                <div className="relative group">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Origin Point..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1.5 tracking-wider">Delivery Location</label>
                <div className="relative group">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Global Coordinates..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1.5 tracking-wider">Delivery Window</label>
                <div className="relative group">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input 
                    type="datetime-local" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-slate-300"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : 'Calculate Route'}
                {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>
          </div>

          {/* Navigation Sidebar (Feature Tabs) */}
          <div className="glass p-2 flex-1 min-h-[400px]">
            <div className="p-4 border-b border-white/5 mb-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Feature Matrix</h3>
            </div>
            <nav className="space-y-1 px-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative",
                      isActive ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")} />
                    <span className="text-sm font-medium tracking-tight whitespace-nowrap">{tab.label}</span>
                    {isActive && (
                      <motion.div layoutId="activeTab" className="absolute right-3 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </section>

        {/* Middle Column (6) - Dynamic Result & Map View */}
        <section className="col-span-12 lg:col-span-6 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-6 h-full"
            >
              {/* Map Interface - Always visible context or large display depending on tab */}
              <div className="glass flex-1 p-6 flex flex-col relative overflow-hidden group">
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    {activeTab === 'Volunteer' && (
                      <button 
                        onClick={() => setActiveTab('Deployment')}
                        className="p-1.5 glass-card rounded-lg hover:bg-white/10 transition-colors mr-2 flex items-center gap-2 text-slate-400 hover:text-white group/btn"
                        title="Back to Deployment"
                      >
                        <ArrowRight className="w-3 h-3 rotate-180 transition-transform group-hover/btn:-translate-x-1" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
                      </button>
                    )}
                    <MapIcon className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Tactical Interface</h3>
                  </div>
                  
                  {/* Sub-Tabs for Tracking and Volunteer */}
                  {(activeTab === 'Tracking' || activeTab === 'Volunteer') && (
                    <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5 ml-8">
                      {activeTab === 'Tracking' ? (
                        <>
                          <div 
                            className={cn(
                              "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                              "bg-blue-600 text-white"
                            )}
                          >
                            Live
                          </div>
                        </>
                      ) : (
                        <div 
                          className={cn(
                            "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                            "bg-blue-600 text-white"
                          )}
                        >
                          Operations
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 ml-auto">
                    <button className="p-2 glass-card rounded-lg hover:bg-white/10 transition-colors"><Layers className="w-4 h-4 text-slate-400" /></button>
                    {(activeTab === 'Volunteer' || activeTab === 'Tracking') && (
                      <button 
                        onClick={() => setIsMapMaximized(true)}
                        className={cn(
                          "p-2 glass-card rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-blue-400"
                        )}
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-Interface for Tabs */}
                <div className="flex-1 relative rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    {activeTab === 'Tracking' && activeShipment ? (
                      <div className="w-full h-full p-2 relative z-10">
                        <MapContainer 
                          center={activeShipment.prediction?.originCoords || [51.505, -0.09]} 
                          zoom={6} 
                          className="h-full w-full rounded-xl"
                        >
                          <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            attribution='&copy; CARTO'
                          />
                          {userCoords && (
                            <Marker position={[userCoords.lat, userCoords.lng]} icon={userCenterIcon}>
                              <Popup>Your Location</Popup>
                            </Marker>
                          )}
                          {activeShipment.prediction && (
                            <>
                              <Polyline 
                                positions={(currentRoute && currentRoute.length > 0) ? currentRoute : [activeShipment.prediction.originCoords, activeShipment.prediction.destinationCoords]} 
                                color="#3b82f6" 
                                weight={4}
                                opacity={0.8}
                              />
                              <Marker position={activeShipment.prediction.originCoords} icon={blueIcon}>
                                <Popup>Origin: {activeShipment.origin}</Popup>
                              </Marker>
                              <Marker position={activeShipment.prediction.destinationCoords} icon={destIcon}>
                                <Popup>Destination: {activeShipment.destination}</Popup>
                              </Marker>
                              {currentLivePos && (
                                <Marker 
                                  position={currentLivePos}
                                  icon={L.divIcon({
                                    className: 'custom-div-icon',
                                    html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-4 border-[#050b1a] shadow-[0_0_15px_rgba(59,130,246,0.5)] flex items-center justify-center"><div class="w-1 h-1 bg-white rounded-full"></div></div>`,
                                    iconSize: [24, 24],
                                    iconAnchor: [12, 12]
                                  })}
                                >
                                  <Popup>Live Tracking: {activeShipment.id}</Popup>
                                </Marker>
                              )}
                              <ChangeView 
                                center={activeShipment.prediction.originCoords} 
                                zoom={6} 
                                shouldReset={shouldCenter} 
                              />
                            </>
                          )}
                        </MapContainer>

                        {/* Floating Tactical Input Overlay */}
                        <div className="absolute bottom-6 left-6 right-6 z-[1000]">
                          <div className="glass-card p-4 flex items-center gap-4 bg-[#0a1120]/90 backdrop-blur-xl border border-blue-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                              <Activity className="w-4 h-4 text-blue-400" />
                            </div>
                            <input 
                              type="text" 
                              placeholder="Inject tactical override or situation update..." 
                              className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-slate-500 font-medium"
                              onKeyDown={(e) => {
                                if(e.key === 'Enter') {
                                  alert("Situation Buffer Updated: " + (e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                            />
                            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-blue-900/20">
                              Commit
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : activeTab === 'Volunteer' ? (
                      <div className="w-full h-full p-8 overflow-y-auto custom-scrollbar flex items-center justify-center">
                        <AnimatePresence mode="wait">
                          {isVolunteerLoggedIn ? (
                            <motion.div 
                              key="dashboard"
                              initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="w-full h-full flex flex-col gap-6"
                              >
                                <div className="flex justify-between items-center bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                                      <span className="text-white font-bold">JD</span>
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-bold text-white">Volunteer Dashboard</h3>
                                      <p className="text-xs text-blue-400">Status: Active Deployer</p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => setIsVolunteerLoggedIn(false)}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-all"
                                  >
                                    Logout
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                                  {/* Problems Tab */}
                                  <div className="glass p-6 border-white/5 space-y-6 flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="w-5 h-5 text-orange-400" />
                                      <h4 className="text-sm font-bold text-white uppercase tracking-widest">Report Problems</h4>
                                    </div>

                                    <div className="space-y-4 flex-1">
                                      <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-slate-500">Problem Description</label>
                                        <textarea 
                                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none h-32"
                                          placeholder="Identify bottlenecks or hazardous conditions..."
                                          value={problemReport.description}
                                          onChange={(e) => setProblemReport({...problemReport, description: e.target.value})}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-slate-500">Severity Level</label>
                                        <div className="flex gap-2">
                                          {['Low', 'Medium', 'High', 'Critical'].map(level => (
                                            <button
                                              key={level}
                                              onClick={() => setProblemReport({...problemReport, severity: level})}
                                              className={cn(
                                                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                                problemReport.severity === level 
                                                  ? "bg-blue-500 text-white" 
                                                  : "bg-white/5 text-slate-400"
                                              )}
                                            >
                                              {level}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <button 
                                        onClick={() => {
                                          alert("Situation Report Dispatched");
                                          setProblemReport({ description: '', severity: 'Low' });
                                        }}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all"
                                      >
                                        Dispatch Report
                                      </button>
                                    </div>
                                  </div>

                                  {/* Upload Photo Tab */}
                                  <div className="glass p-6 border-white/5 space-y-6 flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <Camera className="w-5 h-5 text-blue-400" />
                                      <h4 className="text-sm font-bold text-white uppercase tracking-widest">Upload Photo Evidence</h4>
                                    </div>

                                    <div className="flex-1 flex flex-col space-y-4">
                                      <div 
                                        className="border-2 border-dashed border-white/10 rounded-2xl flex-1 flex flex-col items-center justify-center p-8 hover:bg-white/5 transition-all cursor-pointer bg-slate-900/40"
                                        onClick={() => document.getElementById('photo-upload')?.click()}
                                      >
                                        <Upload className="w-10 h-10 text-slate-500 mb-4" />
                                        <p className="text-sm text-slate-300 font-medium">Drop tactical images here</p>
                                        <p className="text-xs text-slate-500 mt-2">or browse device storage</p>
                                        <input 
                                          type="file" 
                                          id="photo-upload" 
                                          className="hidden" 
                                          accept="image/*"
                                          onChange={(e) => {
                                            if(e.target.files?.[0]) alert("Image cached for upload: " + e.target.files[0].name);
                                          }}
                                        />
                                      </div>
                                      
                                      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                                          <Activity className="w-3 h-3" />
                                          Recent Telemetry Images
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                          {[1,2,3,4].map(i => (
                                            <div key={i} className="aspect-square bg-slate-800 rounded-xl animate-pulse" />
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                          ) : volunteerMode !== 'signup' ? (
                            <motion.div 
                              key="selection"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 1.05 }}
                              className="text-center space-y-8 max-w-sm"
                            >
                              <div className="inline-flex p-6 rounded-full bg-blue-500/10 border border-blue-500/20">
                                <Users className="w-12 h-12 text-blue-400" />
                              </div>
                              <div className="space-y-2">
                                <h2 className="text-3xl font-light tracking-tighter text-white">Join the Network</h2>
                                <p className="text-slate-400 text-sm">Become a vital part of the decentralized logistics response team.</p>
                              </div>
                              <div className="grid grid-cols-1 gap-4">
                                <button 
                                  onClick={() => setIsRegisterModalOpen(true)}
                                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-900/40 border border-blue-400/20"
                                >
                                  Register as a Volunteer
                                </button>
                                <button 
                                  onClick={() => setIsLoginModalOpen(true)}
                                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-200 font-bold rounded-2xl transition-all border border-white/10"
                                >
                                  Login
                                </button>
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    ) : activeTab === 'Emergency' ? (
                      <div className="w-full h-full p-8 overflow-y-auto custom-scrollbar">
                        <div className="max-w-4xl mx-auto space-y-8">
                          <div className="flex flex-col items-center text-center space-y-4 mb-12">
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                              <AlertCircle className="w-10 h-10 text-red-500" />
                            </div>
                            <div>
                              <h2 className="text-4xl font-light text-white tracking-tighter">Emergency Response Network</h2>
                              <p className="text-slate-400 max-w-md mx-auto">Immediate tactical assistance and critical helpline integration.</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                              { label: "Central Toll Free", number: "1033", desc: "Towing, Vehicle breakdown, Accident help", bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", icon: Phone },
                              { label: "Medical Emergency", number: "112", desc: "Ambulance and first response", bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: HeartPulse },
                              { label: "Women Helpline", number: "1091", desc: "Safety and security assistance", bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", icon: Shield },
                              { label: "Child Helpline", number: "1098", desc: "Protection and support services", bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400", icon: Baby }
                            ].map((item, idx) => {
                              const ItemIcon = item.icon;
                              return (
                                <motion.div 
                                  key={item.number}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.1 }}
                                  className="glass-card p-6 rounded-2xl border border-white/5 hover:border-white/20 transition-all group"
                                >
                                  <div className="flex items-start gap-4">
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform", item.bg, item.border)}>
                                      <ItemIcon className={cn("w-6 h-6", item.text)} />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                                        <div className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-bold text-slate-400">ACTIVE</div>
                                      </div>
                                      <a href={`tel:${item.number}`} className="text-3xl font-bold text-white block mb-2 hover:text-blue-400 transition-colors">
                                        {item.number}
                                      </a>
                                      <p className="text-xs text-slate-400 leading-relaxed">
                                        {item.desc}
                                      </p>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>

                          <div className="p-6 glass border-red-500/20 bg-red-500/5 rounded-2xl mt-8">
                            <div className="flex items-center gap-3 text-red-400 mb-2">
                              <AlertTriangle className="w-5 h-5" />
                              <span className="text-sm font-bold uppercase tracking-wider">Critical Protocol</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Use these channels for life-threatening situations or immediate structural danger only. Tactical dispatch units are on standby mapped to your current GPS coordinates.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : activeTab === 'Help' ? (
                      <div className="w-full h-full p-8 overflow-y-auto custom-scrollbar">
                        <div className="max-w-4xl mx-auto space-y-12">
                           <div className="flex flex-col items-center text-center space-y-4">
                              <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                                <HelpCircle className="w-10 h-10 text-blue-400" />
                              </div>
                              <div>
                                <h2 className="text-4xl font-light text-white tracking-tighter">System Intelligence Help</h2>
                                <p className="text-slate-400 max-w-sm mx-auto">Knowledge base and operational support protocols.</p>
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="glass-card p-8 rounded-3xl border border-white/5 hover:border-blue-500/20 transition-all group">
                                 <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                      <MessageSquare className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Feedback</h3>
                                 </div>
                                 <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                    Submit tactical feedback or suggest interface optimizations directly to the Logistics Core.
                                 </p>
                                 <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20">
                                    Launch Feedback Portal
                                 </button>
                              </div>

                              <div className="glass-card p-8 rounded-3xl border border-white/5 hover:border-emerald-500/20 transition-all group">
                                 <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                      <HelpCircle className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Help?</h3>
                                 </div>
                                 <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                    Access the full operational manual and system documentation for advanced logistics management.
                                 </p>
                                 <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20">
                                    Browse Documentation
                                 </button>
                              </div>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="inline-flex p-6 rounded-full bg-blue-500/10 border border-blue-500/20 animate-pulse">
                          <ActiveTabIcon className="w-12 h-12 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-light tracking-tighter text-slate-100">{tabs.find(t => t.id === activeTab)?.label}</h2>
                        <p className="text-slate-400 text-sm max-w-sm mx-auto">Accessing global systems... initializing {activeTab.toLowerCase()} data buffers for deployment {activeShipment?.id || 'ALPHA-0'}.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Overlay Stats (Always Tracking related) */}
                {activeTab !== 'Volunteer' && activeTab !== 'Emergency' && activeTab !== 'Help' && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-card p-4 rounded-2xl text-center group/card hover:border-blue-500/30 transition-all">
                      <div className="text-2xl font-light tracking-tighter text-blue-400">{activeShipment?.prediction?.distanceKm || (activeShipment?.progress ? '1,240' : '--')} <span className="text-xs text-slate-500">km</span></div>
                      <div className="text-[10px] text-slate-500 uppercase mt-1 font-bold tracking-widest">Rem. Distance</div>
                    </div>
                    <div className="glass-card p-4 rounded-2xl text-center group/card hover:border-blue-500/30 transition-all">
                      <div className="text-2xl font-light tracking-tighter text-indigo-400">{activeShipment?.speed || '--'}</div>
                      <div className="text-[10px] text-slate-500 uppercase mt-1 font-bold tracking-widest">Avg. Velocity</div>
                    </div>
                    <div className="glass-card p-4 rounded-2xl text-center group/card hover:border-blue-500/30 transition-all">
                      <div className="text-2xl font-light tracking-tighter text-orange-400">{activeShipment?.eta || '--'} <span className="text-xs text-slate-500">hrs:min</span></div>
                      <div className="text-[10px] text-slate-500 uppercase mt-1 font-bold tracking-widest">ETA Window</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom AI Insight Box */}
              <div className="glass bg-blue-600/10 border-blue-500/20 p-8 flex items-center justify-between overflow-hidden relative group">
                  <div className="relative z-10 max-w-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></div>
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">AI Logistics Core</span>
                    </div>
                    <h4 className="text-xl font-medium leading-snug text-slate-100">
                      Efficiency Optimization: <span className="text-blue-400 font-bold">+14.2%</span> yield relative to legacy maritime standards.
                    </h4>
                  </div>
                  <div className="text-right relative z-10">
                      <div className="text-5xl font-thin tracking-tighter text-slate-200">
                        {activeShipment?.prediction?.confidenceScore ? Math.round(activeShipment.prediction.confidenceScore * 100) : '94'}
                        <span className="text-xl text-blue-400">%</span>
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-2">AI Confidence Engine</div>
                  </div>
                  <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px] group-hover:scale-125 transition-transform duration-1000"></div>
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Right Column (3) - Predictive Risks & Alternative Paths */}
        <section className="col-span-12 lg:col-span-3 flex flex-col gap-6 overflow-y-auto pl-2 custom-scrollbar">
          {/* Live Transit Map Box */}
          <div className="glass p-6 flex flex-col h-[400px] mb-2">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-4 flex items-center justify-between">
              Live Transit Map
              <MapIcon className="w-3.5 h-3.5" />
            </h3>
            <div className="flex-1 rounded-xl overflow-hidden border border-white/5 relative bg-slate-900 group">
              <MapContainer 
                center={activeShipment?.prediction?.originCoords || [20, 78]} 
                zoom={4} 
                zoomControl={false}
                attributionControl={false}
                className="h-full w-full"
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                {userCoords && (
                  <Marker position={[userCoords.lat, userCoords.lng]} icon={userCenterIcon}>
                    <Popup>Current Location</Popup>
                  </Marker>
                )}
                {activeShipment?.prediction && (
                  <>
                    <Polyline 
                      positions={(currentRoute && currentRoute.length > 0) ? currentRoute : [activeShipment.prediction.originCoords, activeShipment.prediction.destinationCoords]} 
                      color="#3b82f6" 
                      weight={3}
                    />
                    <Marker position={activeShipment.prediction.originCoords} icon={blueIcon}>
                      <Popup>From: {activeShipment.origin}</Popup>
                    </Marker>
                    <Marker position={activeShipment.prediction.destinationCoords} icon={destIcon}>
                      <Popup>Delivery: {activeShipment.destination}</Popup>
                    </Marker>
                  </>
                )}
              </MapContainer>
              <div className="absolute top-2 right-2 flex flex-col gap-2 z-[1000]">
                <button 
                  onClick={() => setIsMapMaximized(true)}
                  className="p-1.5 glass-card rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600/30"
                >
                  <Maximize2 className="w-3 h-3 text-blue-400" />
                </button>
              </div>
              {!activeShipment && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-[1001]">
                   <Lock className="w-8 h-8 text-slate-600 mb-2" />
                   <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Telemetry Locked</div>
                   <div className="text-[9px] text-slate-600 mt-1 max-w-[120px]">Deploy a shipment to authorize satellite view.</div>
                </div>
              )}
            </div>
          </div>

          <div className="glass p-6 flex flex-col min-h-0">
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-8 border-b border-white/5 pb-4 flex items-center justify-between">
              Core Risk Forecaster
              <AlertTriangle className="w-3.5 h-3.5" />
            </h3>
            
            <div className="space-y-8">
              {/* Risk Score Display */}
              <div className="p-5 glass-card bg-orange-500/5 border-orange-500/20 rounded-2xl relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <BarChart3 className="w-16 h-16 -mr-4 -mt-4 text-orange-500" />
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Delay Intensity</span>
                  <span className="text-xs font-mono text-orange-400/80">{activeShipment?.prediction?.riskScore || '--'}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${activeShipment?.prediction?.riskScore || 0}%` }}
                  />
                </div>
                <p className="text-xs leading-relaxed text-slate-300 min-h-[40px]">
                  {activeShipment?.prediction?.delaySummary || "Awaiting telemetry to initialize risk modeling for localized port congestions."}
                </p>
              </div>

              {/* Environmental Layer */}
              <div className="space-y-4">
                <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] mb-2 px-1">Atmospheric Impact</h4>
                <div className="flex items-center gap-4 p-4 glass-card rounded-2xl">
                  <CloudSun className="w-10 h-10 text-yellow-400" />
                  <div>
                    <div className="text-sm font-semibold text-slate-200">Precipitation: {activeShipment?.weather || 'Analyzing'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 tracking-wider">Estimated velocity impact: -0.4 knots</div>
                  </div>
                </div>
              </div>

              </div>

              {/* Encryption Info */}
              <div className="mt-auto pt-8">
              <div className="flex justify-between items-end mb-2">
                 <span className="text-[11px] text-slate-500 uppercase font-bold tracking-widest">Encryption Ping</span>
                 <span className="text-xs text-blue-400 font-mono tracking-tighter">0.024 ms</span>
              </div>
              <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                <div className="bg-blue-500 w-3/4 h-full rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Location Permission Popup */}
      <AnimatePresence>
        {showLocationPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass max-w-md w-full p-8 border-blue-500/30"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                  <MapPin className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Give access to your Location</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Accessing your coordinates allows SmartChain AI to provide high-precision origin targeting and real-time transit telemetry.
                  </p>
                </div>
                <div className="flex w-full gap-4 pt-2">
                  <button 
                    onClick={handleLocationDeny}
                    className="flex-1 px-6 py-3 rounded-xl border border-white/10 text-slate-300 font-bold hover:bg-white/5 transition-colors"
                  >
                    Deny
                  </button>
                  <button 
                    onClick={handleLocationAllow}
                    className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/30"
                  >
                    Allow
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* High Risk Warning Popup */}
      <AnimatePresence>
        {isRiskPopupOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md px-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass max-w-md w-full p-8 border-red-500/60 bg-red-950/30"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white mb-2 tracking-tighter uppercase italic">Warning Signal</h3>
                  <p className="text-red-100 font-medium text-lg leading-tight">
                    High risk, Consider Volunteer suggestions
                  </p>
                </div>
                <div className="flex w-full gap-4 pt-4">
                  <button 
                    onClick={() => setIsRiskPopupOpen(false)}
                    className="flex-1 px-6 py-4 rounded-2xl border-2 border-red-500/30 text-red-300 font-black uppercase tracking-widest hover:bg-red-500/10 transition-all text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      setIsRiskPopupOpen(false);
                      setActiveTab('Volunteer');
                    }}
                    className="flex-1 px-6 py-4 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(239,68,68,0.5)] text-xs border-b-4 border-red-800 active:border-b-0 active:translate-y-1"
                  >
                    OK
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass max-w-sm w-full p-8 border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.1)] relative"
            >
              <button 
                onClick={() => setIsLoginModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex flex-col items-center text-center space-y-4 mb-8">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/30">
                  <Lock className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Volunteer Login</h3>
                  <p className="text-slate-400 text-sm">Access your response dashboard.</p>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Email Address</label>
                  <input 
                    type="email" 
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="john@example.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Password</label>
                  <input 
                    type="password" 
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/40"
                  >
                    Login to System
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Volunteer Registration Modal */}
      <AnimatePresence>
        {isRegisterModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass max-w-lg w-full p-8 border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <button 
                onClick={() => setIsRegisterModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex flex-col items-center text-center space-y-4 mb-8">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/30">
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Register as a Volunteer</h3>
                  <p className="text-slate-400 text-sm">Fill in your details to join the rapid response team.</p>
                </div>
              </div>

              <form onSubmit={handleVolunteerSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Full Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="John Doe"
                      value={volunteerForm.name}
                      onChange={(e) => setVolunteerForm({...volunteerForm, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Phone Number</label>
                    <input 
                      type="tel" 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="+1 (555) 000-0000"
                      value={volunteerForm.phone}
                      onChange={(e) => setVolunteerForm({...volunteerForm, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Email Address</label>
                  <input 
                    type="email" 
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="john@example.com"
                    value={volunteerForm.email}
                    onChange={(e) => setVolunteerForm({...volunteerForm, email: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Area</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="Neighborhood or Locality"
                    value={volunteerForm.area}
                    onChange={(e) => setVolunteerForm({...volunteerForm, area: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">District, State</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="e.g. Brooklyn, NY"
                      value={volunteerForm.districtState}
                      onChange={(e) => setVolunteerForm({...volunteerForm, districtState: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Pincode</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="123456"
                      value={volunteerForm.pincode}
                      onChange={(e) => setVolunteerForm({...volunteerForm, pincode: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Password</label>
                  <input 
                    type="password" 
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                    value={volunteerForm.password}
                    onChange={(e) => setVolunteerForm({...volunteerForm, password: e.target.value})}
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/40"
                  >
                    Register as a Volunteer
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Tactical Modal */}
      <AnimatePresence>
        {isMapMaximized && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black px-4 md:px-0"
          >
            <div className="absolute top-6 right-6 z-[120] flex gap-4">
              <button 
                onClick={() => setIsMapMaximized(false)}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl flex items-center justify-center text-white transition-all border border-white/10"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="w-full h-full p-4 md:p-12">
              <div className="w-full h-full glass border-blue-500/20 overflow-hidden relative">
                {(activeTab === 'Deployment' || activeTab === 'Tracking') ? (
                  <MapContainer 
                    center={activeShipment?.prediction?.originCoords || [40, -100]} 
                    zoom={10} 
                    className="h-full w-full"
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      attribution='&copy; CARTO'
                    />
                    {userCoords && (
                      <Marker position={[userCoords.lat, userCoords.lng]} icon={userCenterIcon}>
                        <Popup>Your Location</Popup>
                      </Marker>
                    )}
                    {activeShipment?.prediction && (
                      <>
                        <Polyline 
                          positions={(currentRoute && currentRoute.length > 0) ? currentRoute : [activeShipment.prediction.originCoords, activeShipment.prediction.destinationCoords]} 
                          color="#3b82f6" 
                          weight={5}
                        />
                        <Marker position={activeShipment.prediction.originCoords} icon={blueIcon}>
                          <Popup>Origin: {activeShipment.origin}</Popup>
                        </Marker>
                        <Marker position={activeShipment.prediction.destinationCoords} icon={destIcon}>
                          <Popup>Destination: {activeShipment.destination}</Popup>
                        </Marker>
                        {currentLivePos && (
                          <Marker 
                            position={currentLivePos}
                            icon={L.divIcon({
                              className: 'custom-div-icon',
                              html: `<div class="w-8 h-8 bg-blue-500 rounded-full border-4 border-[#050b1a] shadow-[0_0_25px_rgba(59,130,246,0.8)] flex items-center justify-center"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div>`,
                              iconSize: [32, 32],
                              iconAnchor: [16, 16]
                            })}
                          />
                        )}
                        <ChangeView 
                          center={activeShipment.prediction.originCoords} 
                          zoom={8} 
                          shouldReset={shouldCenter || isMapMaximized} 
                        />
                      </>
                    )}
                  </MapContainer>
                ) : (
                  <div className="w-full h-full p-8 md:p-12 overflow-y-auto custom-scrollbar flex items-center justify-center bg-[#050b1a]">
                    <AnimatePresence mode="wait">
                      {isVolunteerLoggedIn ? (
                        <motion.div 
                          key="dashboard-max"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="w-full max-w-6xl h-full flex flex-col gap-8"
                        >
                          <div className="flex justify-between items-center bg-blue-500/5 p-6 rounded-2xl border border-blue-500/10">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xl font-bold">JD</span>
                              </div>
                              <div>
                                <h3 className="text-2xl font-bold text-white">Volunteer Command Center</h3>
                                <p className="text-sm text-blue-400">Tactical Status: Optimized Deployment</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setIsVolunteerLoggedIn(false)}
                              className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold rounded-xl transition-all"
                            >
                              Terminate Session
                            </button>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                            {/* Problems Tab */}
                            <div className="glass p-8 border-white/5 space-y-8 flex flex-col">
                              <div className="flex items-center gap-3">
                                <AlertTriangle className="w-6 h-6 text-orange-400" />
                                <h4 className="text-lg font-bold text-white uppercase tracking-widest leading-none">Incident Report Log</h4>
                              </div>

                              <div className="space-y-6 flex-1">
                                <div className="space-y-3">
                                  <label className="text-xs uppercase font-black text-slate-500 tracking-wider">Tactical Description</label>
                                  <textarea 
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-base focus:ring-2 focus:ring-blue-500 outline-none h-48 transition-all"
                                    placeholder="Report hazardous conditions or structural disruptions..."
                                    value={problemReport.description}
                                    onChange={(e) => setProblemReport({...problemReport, description: e.target.value})}
                                  />
                                </div>
                                <div className="space-y-3">
                                  <label className="text-xs uppercase font-black text-slate-500 tracking-wider">Threat Assessment</label>
                                  <div className="flex gap-3">
                                    {['Low', 'Medium', 'High', 'Critical'].map(level => (
                                      <button
                                        key={level}
                                        onClick={() => setProblemReport({...problemReport, severity: level})}
                                        className={cn(
                                          "px-5 py-2.5 rounded-xl text-xs font-bold transition-all border",
                                          problemReport.severity === level 
                                            ? "bg-blue-500 text-white border-blue-400" 
                                            : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
                                        )}
                                      >
                                        {level}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    alert("Situation Report Dispatched to Core Command");
                                    setProblemReport({ description: '', severity: 'Low' });
                                  }}
                                  className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-900/40 text-lg"
                                >
                                  Finalize and Dispatch Report
                                </button>
                              </div>
                            </div>

                            {/* Upload Photo Tab */}
                            <div className="glass p-8 border-white/5 space-y-8 flex flex-col">
                              <div className="flex items-center gap-3">
                                <Camera className="w-6 h-6 text-blue-400" />
                                <h4 className="text-lg font-bold text-white uppercase tracking-widest leading-none">Photo Evidence Link</h4>
                              </div>

                              <div className="flex-1 flex flex-col space-y-6">
                                <div 
                                  className="border-2 border-dashed border-white/10 rounded-3xl flex-1 flex flex-col items-center justify-center p-12 hover:bg-white/5 transition-all cursor-pointer bg-slate-900/40 group"
                                  onClick={() => document.getElementById('photo-upload-max')?.click()}
                                >
                                  <Upload className="w-16 h-16 text-slate-500 mb-6 group-hover:text-blue-400 transition-colors" />
                                  <p className="text-xl text-slate-300 font-bold mb-2">Tactical Image Capture</p>
                                  <p className="text-sm text-slate-500">Drag high-resolution telemetry frames or select files</p>
                                  <input 
                                    type="file" 
                                    id="photo-upload-max" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => {
                                      if(e.target.files?.[0]) alert("Tactical frame buffered for sync: " + e.target.files[0].name);
                                    }}
                                  />
                                </div>
                                
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                  <div className="flex items-center gap-3 text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
                                    <Activity className="w-4 h-4" />
                                    Synchronized Visual Stream
                                  </div>
                                  <div className="grid grid-cols-4 gap-4">
                                    {[1,2,3,4,5,6,7,8].map(i => (
                                      <div key={i} className="aspect-square bg-slate-800 rounded-xl animate-pulse" />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center text-center space-y-8">
                          <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                            <Lock className="w-12 h-12 text-blue-400" />
                          </div>
                          <div className="space-y-2">
                            <h2 className="text-4xl font-light text-white tracking-tighter">Restricted Interface</h2>
                            <p className="text-slate-400 text-lg">Please authenticate via the Tactical Portal to access full-view response tools.</p>
                          </div>
                          <button 
                            onClick={() => setIsMapMaximized(false)}
                            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 transition-all font-bold"
                          >
                            Return to Dashboard
                          </button>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* HUD Overlay for Modal Map */}
                {(activeTab === 'Deployment' || activeTab === 'Tracking') && (
                  <div className="absolute bottom-8 left-8 z-[1000] p-6 glass border-blue-500/30 max-w-sm pointer-events-none">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-4 h-4 text-blue-400" />
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Tactical Telemetry</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Current Coordinates</div>
                        <div className="text-xl font-light text-slate-100 font-mono tracking-tighter">
                          {currentLivePos ? `${currentLivePos[0].toFixed(4)}°N, ${currentLivePos[1].toFixed(4)}°W` : 'Awaiting Link...'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <div>
                          <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">Speed</div>
                          <div className="text-sm font-bold text-blue-400">{activeShipment?.speed || '0 km/h'}</div>
                        </div>
                        <div>
                          <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">ETA</div>
                          <div className="text-sm font-bold text-orange-400">{activeShipment?.eta || '--:--'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global CSS for scrollbar */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.3); }
      `}} />
    </div>
  );
}
