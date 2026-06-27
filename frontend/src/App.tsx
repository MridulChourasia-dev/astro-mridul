import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  User, 
  MessageSquare, 
  Heart, 
  FileText, 
  LogOut, 
  Calendar, 
  MapPin, 
  Clock, 
  Plus, 
  Download, 
  ChevronRight, 
  Compass, 
  TrendingUp, 
  Moon, 
  Sun,
  Shield,
  HelpCircle,
  RefreshCw
} from 'lucide-react';

const API_BASE = 'http://localhost:8080';

// Type definitions matching backend models
interface PlanetPosition {
  planet: string;
  house: number;
  sign: string;
  degree: number;
}

interface DashaPeriod {
  lord: string;
  start_date: string;
  end_date: string;
}

interface ChartCalculations {
  ascendant: string;
  ascendant_degree: number;
  moon_sign: string;
  sun_sign: string;
  nakshatra: string;
  nakshatra_pada: number;
  nakshatra_lord: string;
  planets: PlanetPosition[];
  houses: { [key: number]: string };
  vimshottari_dasha: DashaPeriod[];
  doshas: string[];
  yogas: string[];
}

interface BirthChart {
  id: string;
  name: string;
  birth_date: string;
  birth_time: string;
  latitude: number;
  longitude: number;
  timezone: string;
  calculations: ChartCalculations;
  created_at: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  subscription: string;
}

interface ChatMessage {
  id?: string;
  sender: 'user' | 'bot';
  text: string;
  citations?: string[];
}

interface DailyHoroscope {
  date: string;
  score: number;
  prediction: string;
  lucky_number: number;
  lucky_color: string;
  lucky_day: string;
}

interface ReportInfo {
  id: string;
  status: 'pending' | 'completed';
  pdf_url: string | null;
  created_at: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'chat' | 'compatibility' | 'reports'>('chart');
  
  // Auth Form State
  const [isRegister, setIsRegister] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  // Birth Chart State
  const [charts, setCharts] = useState<BirthChart[]>([]);
  const [selectedChart, setSelectedChart] = useState<BirthChart | null>(null);
  const [isCreatingChart, setIsCreatingChart] = useState(false);
  
  // Chart Form State
  const [chartName, setChartName] = useState('');
  const [birthDate, setBirthDate] = useState('1998-05-24');
  const [birthTime, setBirthTime] = useState('08:30');
  const [latitude, setLatitude] = useState(28.6139); // Delhi
  const [longitude, setLongitude] = useState(77.2090);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [chartError, setChartError] = useState('');

  // Daily Horoscope State
  const [horoscope, setHoroscope] = useState<DailyHoroscope | null>(null);

  // Predictions State
  const [predictions, setPredictions] = useState<{ [key: string]: string } | null>(null);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Compatibility State
  const [compPartnerName, setCompPartnerName] = useState('');
  const [compBirthDate, setCompBirthDate] = useState('1999-09-12');
  const [compBirthTime, setCompBirthTime] = useState('12:15');
  const [compLatitude, setCompLatitude] = useState(19.0760); // Mumbai
  const [compLongitude, setCompLongitude] = useState(72.8777);
  const [compTimezone, setCompTimezone] = useState('Asia/Kolkata');
  const [compResult, setCompResult] = useState<any | null>(null);
  const [isCompLoading, setIsCompLoading] = useState(false);

  // Reports State
  const [reports, setReports] = useState<ReportInfo[]>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Load User and Charts on Mount / Token Change
  useEffect(() => {
    if (token) {
      fetchUserProfile();
      fetchCharts();
    } else {
      setUser(null);
      setCharts([]);
      setSelectedChart(null);
    }
  }, [token]);

  // Load Horoscope and Predictions when chart selected
  useEffect(() => {
    if (selectedChart) {
      fetchDailyHoroscope(selectedChart);
      fetchPredictions(selectedChart);
    } else {
      setHoroscope(null);
      setPredictions(null);
    }
  }, [selectedChart]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCharts = async () => {
    try {
      const res = await fetch(`${API_BASE}/chart/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCharts(data);
        if (data.length > 0) {
          setSelectedChart(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDailyHoroscope = async (chart: BirthChart) => {
    try {
      const res = await fetch(`${API_BASE}/daily`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ chart_id: chart.id, calculations: chart.calculations })
      });
      if (res.ok) {
        const data = await res.json();
        setHoroscope(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPredictions = async (chart: BirthChart) => {
    setIsLoadingPredictions(true);
    try {
      const res = await fetch(`${API_BASE}/prediction`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ chart_id: chart.id, calculations: chart.calculations })
      });
      if (res.ok) {
        const data = await res.json();
        setPredictions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPredictions(false);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_BASE}/prediction/report/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger loading reports when Reports tab clicked
  useEffect(() => {
    if (activeTab === 'reports' && token) {
      fetchReports();
      // Auto refresh every 5 seconds if there are pending reports
      const interval = setInterval(() => {
        fetchReports();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    const payload = isRegister 
      ? { name: authName, email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Unable to connect to gateway');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const handleCreateChart = async (e: React.FormEvent) => {
    e.preventDefault();
    setChartError('');
    try {
      const res = await fetch(`${API_BASE}/chart/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: chartName,
          birth_date: birthDate,
          birth_time: birthTime,
          latitude: Number(latitude),
          longitude: Number(longitude),
          timezone: timezone
        })
      });
      if (res.ok) {
        const newChart = await res.json();
        setCharts([newChart, ...charts]);
        setSelectedChart(newChart);
        setIsCreatingChart(false);
        setChartName('');
      } else {
        const data = await res.json();
        setChartError(data.error || 'Failed to create chart');
      }
    } catch (err) {
      setChartError('Server communication error');
    }
  };

  const handleSendMessage = async (customQuery?: string) => {
    const textToSend = customQuery || chatInput;
    if (!textToSend.trim() || !selectedChart) return;

    const userMsg: ChatMessage = { sender: 'user', text: textToSend };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: textToSend,
          chart_id: selectedChart.id,
          calculations: selectedChart.calculations
        })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { 
          sender: 'bot', 
          text: data.response,
          citations: data.citations
        }]);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setChatMessages(prev => [...prev, { 
          sender: 'bot', 
          text: `Failed to retrieve response: ${errorData.error || 'Astrology chat service returned an error. Please verify the prediction service is running.'}`
        }]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { 
        sender: 'bot', 
        text: "Connection error: Unable to contact the backend service. Please check your network connection and verify that all services are running."
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCheckCompatibility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChart) return;
    setIsCompLoading(true);

    try {
      // Step 1: Calculate partner's chart temporarily
      const partnerRes = await fetch(`${API_BASE}/chart/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: compPartnerName,
          birth_date: compBirthDate,
          birth_time: compBirthTime,
          latitude: Number(compLatitude),
          longitude: Number(compLongitude),
          timezone: compTimezone
        })
      });

      if (partnerRes.ok) {
        const partnerChart = await partnerRes.json();
        // Step 2: Compare
        const compRes = await fetch(`${API_BASE}/compatibility`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            chart1: selectedChart,
            chart2: partnerChart
          })
        });

        if (compRes.ok) {
          const scoreData = await compRes.json();
          setCompResult(scoreData);
          // Delete temporary chart from db so we don't clutter history
          await fetch(`${API_BASE}/chart/${partnerChart.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCompLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedChart) return;
    setIsGeneratingReport(true);
    try {
      const res = await fetch(`${API_BASE}/report/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chart_id: selectedChart.id,
          calculations: selectedChart.calculations,
          name: selectedChart.name,
          birth_date: selectedChart.birth_date,
          birth_time: selectedChart.birth_time,
          latitude: selectedChart.latitude,
          longitude: selectedChart.longitude
        })
      });
      if (res.ok) {
        fetchReports();
        alert("Report generation has started in the background. It will show up below in a few seconds!");
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Failed to start report generation: ${errorData.error || 'The report service returned an error. Please verify the prediction service and MinIO are running.'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Connection error: Unable to contact the backend report service. Please check your connection and verify all services are started.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(parseFloat(position.coords.latitude.toFixed(4)));
          setLongitude(parseFloat(position.coords.longitude.toFixed(4)));
          
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) setTimezone(tz);
          } catch (e) {
            console.error("Failed to detect timezone", e);
          }
        },
        (error) => {
          alert("Error detecting location: " + error.message);
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleDetectPartnerLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCompLatitude(parseFloat(position.coords.latitude.toFixed(4)));
          setCompLongitude(parseFloat(position.coords.longitude.toFixed(4)));
          
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) setCompTimezone(tz);
          } catch (e) {
            console.error("Failed to detect timezone", e);
          }
        },
        (error) => {
          alert("Error detecting location: " + error.message);
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };


  // Helper to render interactive SVG birth chart wheel
  const renderBirthChartSVG = (calc: ChartCalculations) => {
    const center = 225;
    const rOuter = 200;
    const rMiddle = 150;
    const rInner = 100;
    
    // Draw concentric circles and dividing house lines
    const lines = [];
    const zodiacs = [];
    const planetsLabels = [];

    // Calculate zodiac placements and draw house boundaries
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 - 90) * (Math.PI / 180);
      const xOuter = center + rOuter * Math.cos(angle);
      const yOuter = center + rOuter * Math.sin(angle);
      const xInner = center + rInner * Math.cos(angle);
      const yInner = center + rInner * Math.sin(angle);
      
      lines.push(
        <line 
          key={`line-${i}`} 
          x1={xInner} 
          y1={yInner} 
          x2={xOuter} 
          y2={yOuter} 
          className="wheel-house-line" 
        />
      );

      // Label zodiac sign in outer ring center
      const labelAngle = (i * 30 + 15 - 90) * (Math.PI / 180);
      const xLabel = center + (rOuter + rMiddle) / 2 * Math.cos(labelAngle);
      const yLabel = center + (rOuter + rMiddle) / 2 * Math.sin(labelAngle) + 4;
      const zodiacName = astronomyZodiacNameForHouse(calc, i + 1);
      zodiacs.push(
        <text 
          key={`zodiac-${i}`} 
          x={xLabel} 
          y={yLabel} 
          textAnchor="middle" 
          className="wheel-zodiac-text"
        >
          {zodiacName.substring(0, 3)}
        </text>
      );
    }

    // Place planets inside middle ring
    calc.planets.forEach((p, idx) => {
      const houseIndex = p.house - 1;
      // Stagger planets slightly inside the house segment
      const offsetAngle = (houseIndex * 30 + 10 + (idx * 3) - 90) * (Math.PI / 180);
      const xPlanet = center + (rMiddle + rInner) / 2 * Math.cos(offsetAngle);
      const yPlanet = center + (rMiddle + rInner) / 2 * Math.sin(offsetAngle) + 4;
      
      planetsLabels.push(
        <text 
          key={`planet-${p.planet}`} 
          x={xPlanet} 
          y={yPlanet} 
          textAnchor="middle" 
          className="wheel-planet-text"
        >
          {p.planet.substring(0, 2)}
        </text>
      );
    });

    return (
      <svg className="wheel-svg" viewBox="0 0 450 450">
        <circle cx={center} cy={center} r={rOuter} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
        <circle cx={center} cy={center} r={rMiddle} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <circle cx={center} cy={center} r={rInner} fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
        
        {/* House boundary lines */}
        {lines}
        {/* Zodiac labels */}
        {zodiacs}
        {/* Planet markers */}
        {planetsLabels}

        {/* Center Star Element */}
        <path d={`M ${center} ${center - 15} L ${center + 4} ${center - 4} L ${center + 15} ${center} L ${center + 4} ${center + 4} L ${center} ${center + 15} L ${center - 4} ${center + 4} L ${center - 15} ${center} L ${center - 4} ${center - 4} Z`} fill="var(--color-accent)" opacity="0.8" />
        
        {/* Ascendant indicator arrow */}
        <path d={`M ${center - rInner} ${center} L ${center - rInner - 12} ${center - 6} L ${center - rInner - 12} ${center + 6} Z`} fill="var(--color-secondary)" />
        <text x={center - rInner - 25} y={center + 4} fill="var(--color-secondary)" fontSize="10" fontWeight="bold">ASC</text>
      </svg>
    );
  };

  // Helper to map index to Zodiac Sign of the House
  const astronomyZodiacNameForHouse = (calc: ChartCalculations, houseNum: number) => {
    return calc.houses[houseNum] || "Aries";
  };

  if (!token) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '16px' }}>
        <div className="glass-panel" style={{ maxWidth: '420px', width: '100%', boxShadow: 'var(--shadow-glow-purple)' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div className="nav-brand" style={{ justifyContent: 'center', fontSize: '28px' }}>
              <Sparkles size={28} /> AstroNLP AI
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
              Personalized Vedic Astrology & RAG-Powered AI Consultant
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isRegister && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={authName} 
                  onChange={e => setAuthName(e.target.value)} 
                  placeholder="e.g. Mridul Chourasia" 
                  required 
                />
              </div>
            )}
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-input" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)} 
                placeholder="you@example.com" 
                required 
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={authPassword} 
                onChange={e => setAuthPassword(e.target.value)} 
                placeholder="Min 6 characters" 
                required 
              />
            </div>

            {authError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '13px', fontWeight: 500, textAlign: 'center' }}>
                {authError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
              {isRegister ? 'Create Cosmic Account' : 'Embark on Journey'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {isRegister ? 'Already have an account?' : "New to the platform?"}{' '}
            <span 
              onClick={() => { setIsRegister(!isRegister); setAuthError(''); }}
              style={{ color: 'var(--color-primary-light)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isRegister ? 'Sign In' : 'Sign Up'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="nav-brand" onClick={() => setActiveTab('chart')}>
          <Sparkles size={24} /> AstroNLP AI
        </div>
        <div className="nav-links">
          <span 
            className={`nav-link ${activeTab === 'chart' ? 'active' : ''}`}
            onClick={() => setActiveTab('chart')}
          >
            <Compass size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Natal Chart
          </span>
          <span 
            className={`nav-link ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> AI Chat
          </span>
          <span 
            className={`nav-link ${activeTab === 'compatibility' ? 'active' : ''}`}
            onClick={() => setActiveTab('compatibility')}
          >
            <Heart size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Compatibility
          </span>
          <span 
            className={`nav-link ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <FileText size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Reports
          </span>
          
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', borderRadius: 'var(--radius-sm)' }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Welcome Section / Active Chart Picker */}
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Welcome, {user?.name || 'Astro Traveler'}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Tier: <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{user?.subscription.toUpperCase()}</span>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {charts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Selected Profile:</span>
                <select 
                  value={selectedChart?.id || ''} 
                  onChange={e => setSelectedChart(charts.find(c => c.id === e.target.value) || null)}
                  className="form-input"
                  style={{ padding: '8px 12px', minWidth: '160px', height: '38px' }}
                >
                  {charts.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.calculations.ascendant} Asc)</option>
                  ))}
                </select>
              </div>
            )}
            
            <button 
              onClick={() => setIsCreatingChart(true)} 
              className="btn btn-primary"
              style={{ padding: '8px 16px', height: '38px', marginTop: '16px' }}
            >
              <Plus size={16} /> New Chart
            </button>
          </div>
        </div>

        {/* Modal for Chart Creation */}
        {isCreatingChart && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
            <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', boxShadow: 'var(--shadow-glow-purple)' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Generate Cosmic Birth Chart</h3>
              <form onSubmit={handleCreateChart} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Profile Name (e.g. Self, Spouse)</label>
                  <input type="text" className="form-input" value={chartName} onChange={e => setChartName(e.target.value)} required />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Birth Date</label>
                    <input type="date" className="form-input" value={birthDate} onChange={e => setBirthDate(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Birth Time (Local)</label>
                    <input type="time" className="form-input" value={birthTime} onChange={e => setBirthTime(e.target.value)} required />
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={handleDetectLocation} 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
                >
                  📍 Detect Current Location
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Latitude</label>
                    <input type="number" step="0.0001" className="form-input" value={latitude} onChange={e => setLatitude(Number(e.target.value))} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Longitude</label>
                    <input type="number" step="0.0001" className="form-input" value={longitude} onChange={e => setLongitude(Number(e.target.value))} required />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Timezone ID</label>
                  <input type="text" className="form-input" value={timezone} onChange={e => setTimezone(e.target.value)} required />
                </div>

                {chartError && <div style={{ color: 'var(--color-danger)', fontSize: '13px' }}>{chartError}</div>}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="button" onClick={() => setIsCreatingChart(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Generate</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 1: Natal Chart Calculations & Daily Dashboard */}
        {activeTab === 'chart' && (
          <div>
            {!selectedChart ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Compass size={48} style={{ color: 'var(--color-primary-light)', marginBottom: '16px' }} />
                <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>No Birth Charts Found</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Generate a cosmic birth chart to start exploring personalized predictions, AI chats, and horoscopes.</p>
                <button onClick={() => setIsCreatingChart(true)} className="btn btn-primary">Generate Birth Chart</button>
              </div>
            ) : (
              <div className="grid-2">
                {/* Left Side: SVG Chart Wheel & Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--color-primary-light)' }}>Birth Chart Wheel</h3>
                    {renderBirthChartSVG(selectedChart.calculations)}
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px', justifyContent: 'center' }}>
                      <span style={{ fontSize: '13px', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
                        Ascendant: {selectedChart.calculations.ascendant} ({selectedChart.calculations.ascendant_degree.toFixed(1)}°)
                      </span>
                      <span style={{ fontSize: '13px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-accent)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
                        Sun Sign: {selectedChart.calculations.sun_sign}
                      </span>
                      <span style={{ fontSize: '13px', background: 'rgba(168, 85, 247, 0.1)', color: 'var(--color-primary-light)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
                        Moon Sign: {selectedChart.calculations.moon_sign}
                      </span>
                    </div>
                  </div>

                  {/* Yogas & Doshas */}
                  <div className="glass-panel">
                    <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Astrological Configurations</h3>
                    
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Yogas Present:</div>
                      {selectedChart.calculations.yogas.length > 0 ? (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {selectedChart.calculations.yogas.map(y => (
                            <span key={y} style={{ fontSize: '12px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-accent)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                              {y}
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No major Yogas calculated.</span>}
                    </div>

                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Doshas Present:</div>
                      {selectedChart.calculations.doshas.length > 0 ? (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {selectedChart.calculations.doshas.map(d => (
                            <span key={d} style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                              {d}
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No major Doshas (e.g. Manglik) present.</span>}
                    </div>
                  </div>
                </div>

                {/* Right Side: Daily Horoscope & Interpretations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Daily Horoscope Widget */}
                  {horoscope && (
                    <div className="glass-panel" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <TrendingUp style={{ color: 'var(--color-accent)' }} /> Transit Daily Insights
                        </h3>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{horoscope.date}</span>
                      </div>
                      
                      <p style={{ fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>{horoscope.prediction}</p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div className="stat-card">
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Lucky Color</span>
                          <span className="stat-value" style={{ fontSize: '16px' }}>{horoscope.lucky_color}</span>
                        </div>
                        <div className="stat-card">
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Lucky Number</span>
                          <span className="stat-value" style={{ fontSize: '16px' }}>{horoscope.lucky_number}</span>
                        </div>
                        <div className="stat-card">
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Lucky Day</span>
                          <span className="stat-value" style={{ fontSize: '16px' }}>{horoscope.lucky_day}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Predictions Details */}
                  <div className="glass-panel">
                    <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--color-secondary)' }}>Planetary Placements</h3>
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <table className="custom-table" style={{ fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th>Planet</th>
                            <th>House</th>
                            <th>Sign</th>
                            <th>Degree</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedChart.calculations.planets.map(p => (
                            <tr key={p.planet}>
                              <td style={{ fontWeight: 600 }}>{p.planet}</td>
                              <td>{p.house}</td>
                              <td>{p.sign}</td>
                              <td>{p.degree.toFixed(2)}°</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Life Area Interpretations */}
                  <div className="glass-panel">
                    <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--color-primary-light)' }}>Cosmic Life Path</h3>
                    {isLoadingPredictions ? (
                      <div style={{ textAlign: 'center', padding: '24px' }}>
                        <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--color-primary-light)' }} />
                        <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>Calculating planetary influences...</p>
                      </div>
                    ) : predictions ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-secondary)', fontSize: '14px', marginBottom: '4px' }}>Career & Purpose</div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{predictions.career}</p>
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-secondary)', fontSize: '14px', marginBottom: '4px' }}>Marriage & Love</div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{predictions.marriage}</p>
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-secondary)', fontSize: '14px', marginBottom: '4px' }}>Finance & Wealth</div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{predictions.finance}</p>
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-secondary)', fontSize: '14px', marginBottom: '4px' }}>Suggested Remedies</div>
                          <p style={{ fontSize: '13px', color: 'var(--color-accent)', lineHeight: 1.5, fontWeight: 500 }}>{predictions.remedies}</p>
                        </div>
                      </div>
                    ) : <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Select chart to view interpretations.</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: AI Chatbot Console */}
        {activeTab === 'chat' && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', color: 'var(--color-primary-light)' }}>AstroNLP RAG Chatbot</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Ask specific planetary questions. The AI will retrieve literature and analyze your current chart.</p>
            </div>

            <div className="chat-console">
              <div className="chat-messages">
                {chatMessages.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '16px' }}>
                    <MessageSquare size={32} />
                    <div style={{ textAlign: 'center' }}>
                      <p>Ask a question about your birth chart, transits, or Mahadasha.</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>E.g., "Explain Rahu Mahadasha." or "What is my strongest planet?"</p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={`message-bubble ${msg.sender}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>{msg.text}</div>
                      {msg.citations && msg.citations.length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>Citations:</span>
                          <ul style={{ paddingLeft: '12px', marginTop: '4px' }}>
                            {msg.citations.map((cit, cIdx) => (
                              <li key={cIdx}>{cit}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="message-bubble bot" style={{ alignSelf: 'flex-start' }}>
                    <RefreshCw className="animate-spin" size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Consoles aligning...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Questions Options */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '6px' }}>
                <button onClick={() => handleSendMessage("Will I get married soon?")} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                  💍 Will I get married?
                </button>
                <button onClick={() => handleSendMessage("What is my strongest planet?")} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                  🪐 Strongest planet?
                </button>
                <button onClick={() => handleSendMessage("Explain Rahu Mahadasha and its remedies.")} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                  🐉 Rahu Mahadasha
                </button>
                <button onClick={() => handleSendMessage("Which gemstone suits my birth chart?")} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                  💎 Best Gemstone?
                </button>
              </div>

              <div className="chat-input-wrapper">
                <input 
                  type="text" 
                  className="form-input" 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask a cosmic question..."
                  disabled={!selectedChart}
                />
                <button 
                  onClick={() => handleSendMessage()} 
                  className="btn btn-primary"
                  disabled={!selectedChart || isChatLoading}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Compatibility analysis */}
        {activeTab === 'compatibility' && (
          <div className="grid-2">
            {/* Input Form */}
            <div className="glass-panel">
              <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--color-primary-light)' }}>Compatibility Matcher</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
                Enter the birth details of your partner or friend to check Ashtakoota compatibility against your selected chart profile.
              </p>

              <form onSubmit={handleCheckCompatibility} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Partner's Name</label>
                  <input type="text" className="form-input" value={compPartnerName} onChange={e => setCompPartnerName(e.target.value)} placeholder="e.g. Partner" required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Birth Date</label>
                    <input type="date" className="form-input" value={compBirthDate} onChange={e => setCompBirthDate(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Birth Time (Local)</label>
                    <input type="time" className="form-input" value={compBirthTime} onChange={e => setCompBirthTime(e.target.value)} required />
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={handleDetectPartnerLocation} 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
                >
                  📍 Detect Partner's Location
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Latitude</label>
                    <input type="number" step="0.0001" className="form-input" value={compLatitude} onChange={e => setCompLatitude(Number(e.target.value))} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Longitude</label>
                    <input type="number" step="0.0001" className="form-input" value={compLongitude} onChange={e => setCompLongitude(Number(e.target.value))} required />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Timezone ID</label>
                  <input type="text" className="form-input" value={compTimezone} onChange={e => setCompTimezone(e.target.value)} required />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={isCompLoading || !selectedChart}>
                  {isCompLoading ? 'Comparing Orbits...' : 'Evaluate Match'}
                </button>
              </form>
            </div>

            {/* Results Display */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {!compResult ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                  <Heart size={48} style={{ color: 'rgba(239, 68, 68, 0.2)', marginBottom: '16px' }} />
                  <h4>Awaiting Comparison Details</h4>
                  <p style={{ fontSize: '13px', marginTop: '6px' }}>Input partner details to run compatibility score.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      display: 'inline-flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      width: '100px', 
                      height: '100px', 
                      borderRadius: '50%', 
                      border: '4px solid var(--color-accent)', 
                      fontSize: '28px', 
                      fontWeight: 800,
                      color: 'var(--color-accent)',
                      boxShadow: 'var(--shadow-glow-gold)',
                      marginBottom: '12px'
                    }}>
                      {compResult.score}%
                    </div>
                    <h4>Overall Match Rating</h4>
                  </div>

                  {/* Attribute Bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>Emotional Compatibility</span>
                        <span>{compResult.emotional}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${compResult.emotional}%`, background: 'var(--color-secondary)' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>Marriage & Harmony</span>
                        <span>{compResult.marriage}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${compResult.marriage}%`, background: 'var(--color-primary-light)' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>Communication Compatibility</span>
                        <span>{compResult.communication}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${compResult.communication}%`, background: 'var(--color-accent)' }}></div>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '16px', marginTop: '8px' }}>
                    <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--color-danger)' }}>Challenges:</span> {compResult.challenges}
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--color-secondary)' }}>Suggestions:</span> {compResult.suggestions}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: PDF Report Wizard */}
        {activeTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', color: 'var(--color-primary-light)' }}>PDF Report Generator</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Compile all house placements, planetary degrees, careers, marriage analyses, and remedies into a beautifully bound PDF report.</p>
              </div>
              <button 
                onClick={handleGenerateReport} 
                className="btn btn-primary"
                disabled={isGeneratingReport || !selectedChart}
              >
                {isGeneratingReport ? 'Processing...' : 'Generate New PDF'}
              </button>
            </div>

            {/* Past reports list */}
            <div className="glass-panel">
              <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Report Archives</h3>
              {reports.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '30px' }}>
                  <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                  <p>No reports generated yet. Click "Generate New PDF" above to build your first report.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Date Requested</th>
                        <th>Status</th>
                        <th>Download Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map(rep => (
                        <tr key={rep.id}>
                          <td>{new Date(rep.created_at).toLocaleString()}</td>
                          <td>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 600,
                              background: rep.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: rep.status === 'completed' ? '#4ade80' : 'var(--color-accent)',
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}>
                              {rep.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {rep.status === 'completed' && rep.pdf_url ? (
                              <a 
                                href={rep.pdf_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', textDecoration: 'none', display: 'inline-flex' }}
                              >
                                <Download size={12} style={{ marginRight: '4px' }} /> Save Report
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Generating in background...</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--border-glass)', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: 'auto' }}>
        <p>© 2026 AstroNLP AI. Engineered with Go, Python FastAPI, Qdrant & React.</p>
        <p style={{ marginTop: '4px', fontSize: '11px' }}>Disclaimer: AstroNLP AI is intended for informational and entertainment purposes only.</p>
      </footer>
    </div>
  );
}
