import React from 'react';
import { MessageSquare, Store, Clock, Wifi, CheckCircle2 } from 'lucide-react';

export default function StatsStrip({ activityLog, isSocketConnected }) {
  // Compute metrics from activityLog
  const totalMessages = activityLog.filter(item => item.type === 'incoming').length;
  
  // Extract unique branches detected
  const branchesDetected = new Set();
  activityLog.forEach(item => {
    // If from mentions a group or branch
    const text = (item.from || '') + ' ' + (item.text || '') + ' ' + (item.response || '');
    // Regex or substring search for recognized branches if any, or just check distinct senders
    if (item.from && item.from !== 'System') {
      branchesDetected.add(item.from);
    }
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    }}>
      
      {/* Card 1: Estado Operativo */}
      <div style={{
        backgroundColor: 'var(--wa-bg-panel)',
        border: '1px solid var(--wa-border)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px'
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          backgroundColor: 'rgba(37, 211, 102, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <CheckCircle2 color="var(--wa-green)" size={22} />
        </div>
        <div>
          <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--wa-text-secondary)', letterSpacing: '0.05em' }}>
            Guardia Activa
          </span>
          <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--wa-text-primary)', marginTop: '2px' }}>
            En Línea • 09 a 24 hs
          </p>
        </div>
      </div>

      {/* Card 2: Mensajes Atendidos */}
      <div style={{
        backgroundColor: 'var(--wa-bg-panel)',
        border: '1px solid var(--wa-border)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px'
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          backgroundColor: 'rgba(0, 168, 132, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <MessageSquare color="var(--wa-teal)" size={22} />
        </div>
        <div>
          <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--wa-text-secondary)', letterSpacing: '0.05em' }}>
            Incidentes / Mensajes
          </span>
          <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--wa-text-primary)', marginTop: '2px' }}>
            {totalMessages} <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--wa-text-secondary)' }}>atendidos</span>
          </p>
        </div>
      </div>

      {/* Card 3: Canales / Sucursales */}
      <div style={{
        backgroundColor: 'var(--wa-bg-panel)',
        border: '1px solid var(--wa-border)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px'
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          backgroundColor: 'rgba(83, 189, 235, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Store color="var(--wa-text-link)" size={22} />
        </div>
        <div>
          <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--wa-text-secondary)', letterSpacing: '0.05em' }}>
            Grupos con Actividad
          </span>
          <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--wa-text-primary)', marginTop: '2px' }}>
            {branchesDetected.size} <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--wa-text-secondary)' }}>canales</span>
          </p>
        </div>
      </div>

      {/* Card 4: WebSocket en Vivo */}
      <div style={{
        backgroundColor: 'var(--wa-bg-panel)',
        border: '1px solid var(--wa-border)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px'
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          backgroundColor: isSocketConnected ? 'rgba(37, 211, 102, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Wifi color={isSocketConnected ? 'var(--wa-green)' : 'var(--wa-status-danger)'} size={22} />
        </div>
        <div>
          <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--wa-text-secondary)', letterSpacing: '0.05em' }}>
            Stream en Vivo
          </span>
          <p style={{
            fontSize: '15px',
            fontWeight: '700',
            color: isSocketConnected ? 'var(--wa-green)' : 'var(--wa-status-danger)',
            marginTop: '2px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {isSocketConnected ? 'Socket Conectado' : 'Reconectando...'}
          </p>
        </div>
      </div>

    </div>
  );
}

