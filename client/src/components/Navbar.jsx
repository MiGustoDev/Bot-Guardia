import React from 'react';
import { Radio, RefreshCw, Power, Settings, ShieldCheck, MessageSquare } from 'lucide-react';

export default function Navbar({ 
  status, 
  onRestart, 
  onLogout, 
  onOpenSettings,
  isRestarting,
  isLoggingOut
}) {
  const getStatusBadge = () => {
    switch (status) {
      case 'CONNECTED':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(37, 211, 102, 0.12)',
            color: 'var(--wa-green)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            border: '1px solid rgba(37, 211, 102, 0.25)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--wa-green)'
            }} className="animate-pulse-green" />
            En Línea • Operativo
          </div>
        );
      case 'QR_READY':
        return null;
      case 'CONNECTING':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(83, 189, 235, 0.12)',
            color: 'var(--wa-text-link)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            border: '1px solid rgba(83, 189, 235, 0.25)'
          }}>
            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Iniciando WhatsApp...
          </div>
        );
      default:
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--wa-status-danger)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            border: '1px solid rgba(239, 68, 68, 0.25)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--wa-status-danger)'
            }} />
            Desconectado
          </div>
        );
    }
  };

  return (
    <header style={{
      backgroundColor: 'var(--wa-bg-panel)',
      borderBottom: '1px solid var(--wa-border)',
      padding: '14px 24px',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'var(--wa-teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 168, 132, 0.35)',
            padding: '6px',
            flexShrink: 0
          }}>
            <img 
              src="/logo.png" 
              alt="Logo Mi Gusto" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{
                fontSize: '18px',
                fontWeight: '700',
                letterSpacing: '-0.02em',
                color: 'var(--wa-text-primary)'
              }}>
                Guardia Sistemas
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--wa-bg-active)',
                color: 'var(--wa-text-secondary)',
                letterSpacing: '0.05em'
              }}>
                Mi Gusto
              </span>
            </div>
            <p style={{
              fontSize: '12px',
              color: 'var(--wa-text-secondary)',
              marginTop: '1px'
            }}>
              Bot de WhatsApp para soporte de sucursales
            </p>
          </div>
        </div>

        {/* Center / Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {getStatusBadge()}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onOpenSettings}
            title="Ver Reglas y Configuración"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--wa-bg-panel-hover)',
              color: 'var(--wa-text-primary)',
              fontSize: '13px',
              fontWeight: '500',
              border: '1px solid var(--wa-border-light)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-bg-active)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-bg-panel-hover)'}
          >
            <Settings size={15} color="var(--wa-teal)" />
            <span>Reglas & Config</span>
          </button>

          <button
            onClick={onRestart}
            disabled={isRestarting}
            title="Reiniciar conexión del bot"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--wa-bg-panel-hover)',
              color: 'var(--wa-text-primary)',
              fontSize: '13px',
              fontWeight: '500',
              border: '1px solid var(--wa-border-light)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-bg-active)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-bg-panel-hover)'}
          >
            <RefreshCw size={15} className={isRestarting ? 'animate-spin' : ''} />
            <span>{isRestarting ? 'Reiniciando...' : 'Reconectar'}</span>
          </button>

          {status === 'CONNECTED' && (
            <button
              onClick={onLogout}
              disabled={isLoggingOut}
              title="Cerrar sesión de WhatsApp"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--wa-status-danger)',
                fontSize: '13px',
                fontWeight: '600',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
            >
              <Power size={15} />
              <span>{isLoggingOut ? 'Cerrando...' : 'Desvincular'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

