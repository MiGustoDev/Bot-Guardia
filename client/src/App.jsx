import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Components
import Navbar from './components/Navbar';
import QRConnectView from './components/QRConnectView';
import StatsStrip from './components/StatsStrip';
import ActivityFeed from './components/ActivityFeed';
import SidebarInfo from './components/SidebarInfo';
import RulesModal from './components/RulesModal';
import DetectionSimulator from './components/DetectionSimulator';

// Socket URL logic:
// If Vite dev server on 3000 or 5173, proxy to 5000 or connect directly.
const SOCKET_URL = window.location.hostname === 'localhost' && window.location.port !== '5000'
  ? 'http://localhost:5000'
  : '';

function App() {
  const [status, setStatus] = useState('CONNECTING'); // 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED'
  const [qrCode, setQrCode] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  
  // Loading states for actions
  const [isRestarting, setIsRestarting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  useEffect(() => {
    // 1. Initial REST fetch for status
    fetch(`${SOCKET_URL}/api/status`)
      .then(res => res.json())
      .then(data => {
        if (data.status) setStatus(data.status);
        if (data.qr) setQrCode(data.qr);
      })
      .catch(err => {
        console.error('Error fetching initial status:', err);
        setStatus('DISCONNECTED');
      });

    // 2. Initial REST fetch for activity history
    fetch(`${SOCKET_URL}/api/activity`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setActivityLog(data);
        }
      })
      .catch(err => console.error('Error fetching activity log:', err));

    // 3. Socket.io real-time connection
    const socket = io(SOCKET_URL, {
      reconnectionAttempts: 15,
      reconnectionDelay: 2000
    });

    socket.on('connect', () => {
      setIsSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    // Real-time status & QR updates
    socket.on('status', (data) => {
      if (data.status) setStatus(data.status);
      setQrCode(data.qr || null);
      if (data.status === 'CONNECTED') {
        setIsRestarting(false);
      }
    });

    // Real-time new message/event
    socket.on('activity', (newLogItem) => {
      setActivityLog(prev => [newLogItem, ...prev]);
    });

    // Real-time history dump on reconnect
    socket.on('activity-history', (history) => {
      if (Array.isArray(history) && history.length > 0) {
        setActivityLog(history);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Handle bot restart / reconnect
  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await fetch(`${SOCKET_URL}/api/restart`, { method: 'POST' });
    } catch (err) {
      console.error('Error restarting bot:', err);
    } finally {
      setTimeout(() => setIsRestarting(false), 4000);
    }
  };

  // Handle WhatsApp logout
  const handleLogout = async () => {
    const confirmLogout = window.confirm(
      '¿Estás seguro de que deseas desvincular el celular de guardia? El bot dejará de responder hasta que se vuelva a escanear un nuevo código QR.'
    );
    if (!confirmLogout) return;

    setIsLoggingOut(true);
    try {
      await fetch(`${SOCKET_URL}/api/logout`, { method: 'POST' });
      setStatus('DISCONNECTED');
      setQrCode(null);
    } catch (err) {
      console.error('Error logging out:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleClearView = () => {
    setActivityLog([]);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--wa-bg-main)' }}>
      {/* WhatsApp Styled Navbar */}
      <Navbar
        status={status}
        onRestart={handleRestart}
        onLogout={handleLogout}
        onOpenSettings={() => setIsRulesModalOpen(true)}
        isRestarting={isRestarting}
        isLoggingOut={isLoggingOut}
      />

      {/* Main Container */}
      <main style={{
        flex: 1,
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* 1. TOP METRICS STRIP (Always visible) */}
        <StatsStrip 
          activityLog={activityLog} 
          isSocketConnected={isSocketConnected} 
        />

        {/* 2. QR CODE VINCULATION CARD (Visible when not connected) */}
        {status !== 'CONNECTED' && (
          <div style={{ marginBottom: '24px' }}>
            <QRConnectView
              status={status}
              qrCode={qrCode}
              onRestart={handleRestart}
              isRestarting={isRestarting}
            />
          </div>
        )}

        {/* 3. OPERATIONAL DASHBOARD (Always visible) */}
        <div 
          className="dashboard-grid animate-fade-in"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 340px',
            gap: '24px',
            alignItems: 'stretch'
          }}
        >
          {/* Left Column: WhatsApp-styled Live Feed + Detection Simulator (Auto-expanded) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            <ActivityFeed 
              activityLog={activityLog} 
              onClearView={handleClearView} 
            />
            <DetectionSimulator />
          </div>

          {/* Right Column: Guard Shift, Protocols & Top Branches */}
          <SidebarInfo 
            activityLog={activityLog} 
          />
        </div>

      </main>

      {/* Rules & Configuration Modal */}
      <RulesModal 
        isOpen={isRulesModalOpen} 
        onClose={() => setIsRulesModalOpen(false)} 
      />

      {/* Footer */}
      <footer style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--wa-border)',
        backgroundColor: 'var(--wa-bg-panel)',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: '12px',
          color: 'var(--wa-text-secondary)'
        }}>
          <div>
            <strong>Guardia de Sistemas</strong> • Mi Gusto Empanadas
          </div>
          <div>
            Rotación automática semanal • Lunes 09:00 hs
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
