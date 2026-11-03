import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  CheckCheck, 
  Store, 
  Bot, 
  User, 
  Bell, 
  Terminal, 
  Filter, 
  ArrowDown, 
  Trash2,
  Clock
} from 'lucide-react';

export default function ActivityFeed({ activityLog, onClearView }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'incoming', 'system'
  const [autoScroll, setAutoScroll] = useState(true);
  const feedEndRef = useRef(null);

  // Auto-scroll to top of list if new messages arrive and autoScroll is true
  useEffect(() => {
    if (autoScroll && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activityLog, autoScroll]);

  // Filter messages
  const filteredActivities = activityLog.filter(item => {
    // Filter by type
    if (filterType === 'incoming' && item.type !== 'incoming') return false;
    if (filterType === 'system' && item.type !== 'system') return false;

    // Filter by search
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const from = (item.from || '').toLowerCase();
    const text = (item.text || '').toLowerCase();
    const response = (item.response || '').toLowerCase();

    return from.includes(term) || text.includes(term) || response.includes(term);
  });

  return (
    <div style={{
      backgroundColor: 'var(--wa-bg-panel)',
      border: '1px solid var(--wa-border)',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: '480px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      overflow: 'hidden'
    }}>
      
      {/* Header & Controls */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--wa-border)',
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        
        {/* Top title bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={18} color="var(--wa-teal)" />
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
              Monitor de Mensajes en Vivo
            </h2>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: 'var(--wa-bg-active)',
              color: 'var(--wa-teal)'
            }}>
              {filteredActivities.length} eventos
            </span>
          </div>

          {/* Quick buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Modern iOS/WhatsApp style Toggle Switch */}
            <div 
              onClick={() => setAutoScroll(!autoScroll)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: 'var(--wa-surface-subtle)',
                border: '1px solid var(--wa-border-subtle)',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.2s'
              }}
              title={autoScroll ? 'Pausar auto-scroll' : 'Activar auto-scroll'}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)'}
            >
              <span style={{ 
                fontSize: '11px', 
                fontWeight: '600', 
                color: autoScroll ? 'var(--wa-teal)' : 'var(--wa-text-secondary)',
                letterSpacing: '0.02em'
              }}>
                Auto-scroll
              </span>
              
              {/* Switch Track */}
              <div style={{
                width: '32px',
                height: '18px',
                borderRadius: '10px',
                backgroundColor: autoScroll ? 'var(--wa-teal)' : 'rgba(255, 255, 255, 0.12)',
                position: 'relative',
                transition: 'background-color 0.25s ease'
              }}>
                {/* Switch Thumb */}
                <div style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: '2px',
                  left: '2px',
                  transform: autoScroll ? 'translateX(14px)' : 'translateX(0px)',
                  transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)'
                }} />
              </div>
            </div>

            {/* Trash button styled in gris anegrado with hover red */}
            {onClearView && (
              <button
                onClick={onClearView}
                title="Limpiar vista del monitor"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--wa-surface-subtle)',
                  border: '1px solid var(--wa-border-subtle)',
                  color: 'var(--wa-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                  e.currentTarget.style.color = 'var(--wa-status-danger)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
                  e.currentTarget.style.borderColor = 'var(--wa-border-subtle)';
                  e.currentTarget.style.color = 'var(--wa-text-secondary)';
                }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Search bar and Filters */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          {/* Search Box */}
          <div style={{
            position: 'relative',
            flex: 1,
            minWidth: '200px'
          }}>
            <Search 
              size={14} 
              color="var(--wa-text-secondary)" 
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} 
            />
            <input
              type="text"
              placeholder="Buscar por sucursal, remitente o palabra clave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                fontSize: '13px',
                borderRadius: '8px',
                backgroundColor: 'var(--wa-surface-subtle)',
                border: '1px solid var(--wa-border-subtle)',
                color: 'var(--wa-text-primary)'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  color: 'var(--wa-text-secondary)',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setFilterType('all')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: filterType === 'all' ? 'var(--wa-teal)' : 'var(--wa-surface-subtle)',
                color: filterType === 'all' ? '#ffffff' : 'var(--wa-text-secondary)',
                border: '1px solid ' + (filterType === 'all' ? 'var(--wa-teal)' : 'var(--wa-border-subtle)'),
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (filterType !== 'all') {
                  e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
                  e.currentTarget.style.color = 'var(--wa-text-primary)';
                }
              }}
              onMouseOut={(e) => {
                if (filterType !== 'all') {
                  e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
                  e.currentTarget.style.color = 'var(--wa-text-secondary)';
                }
              }}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('incoming')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: filterType === 'incoming' ? 'var(--wa-teal)' : 'var(--wa-surface-subtle)',
                color: filterType === 'incoming' ? '#ffffff' : 'var(--wa-text-secondary)',
                border: '1px solid ' + (filterType === 'incoming' ? 'var(--wa-teal)' : 'var(--wa-border-subtle)'),
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (filterType !== 'incoming') {
                  e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
                  e.currentTarget.style.color = 'var(--wa-text-primary)';
                }
              }}
              onMouseOut={(e) => {
                if (filterType !== 'incoming') {
                  e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
                  e.currentTarget.style.color = 'var(--wa-text-secondary)';
                }
              }}
            >
              Sucursales
            </button>
            <button
              onClick={() => setFilterType('system')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: filterType === 'system' ? 'var(--wa-teal)' : 'var(--wa-surface-subtle)',
                color: filterType === 'system' ? '#ffffff' : 'var(--wa-text-secondary)',
                border: '1px solid ' + (filterType === 'system' ? 'var(--wa-teal)' : 'var(--wa-border-subtle)'),
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (filterType !== 'system') {
                  e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
                  e.currentTarget.style.color = 'var(--wa-text-primary)';
                }
              }}
              onMouseOut={(e) => {
                if (filterType !== 'system') {
                  e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
                  e.currentTarget.style.color = 'var(--wa-text-secondary)';
                }
              }}
            >
              Sistema
            </button>
          </div>
        </div>

      </div>

      {/* Feed Messages Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: 'var(--wa-bg-deep)',
        backgroundImage: 'radial-gradient(circle at center, rgba(32, 44, 51, 0.4) 0%, transparent 80%)'
      }}>
        
        {filteredActivities.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center',
            color: 'var(--wa-text-secondary)',
            gap: '12px'
          }}>
            <Bot size={42} color="var(--wa-border-light)" />
            <p style={{ fontSize: '14px', fontWeight: '500' }}>
              {searchTerm ? 'No se encontraron eventos con esa búsqueda' : 'No hay actividad reciente registrada'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--wa-text-muted)', maxWidth: '300px' }}>
              Los mensajes entrantes de las sucursales y las respuestas del bot aparecerán aquí en tiempo real.
            </p>
          </div>
        ) : (
          filteredActivities.map((item) => {
            const isSystem = item.type === 'system';

            // System Notification Bubble (WhatsApp center pill)
            if (isSystem) {
              return (
                <div 
                  key={item.id} 
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '8px 0'
                  }}
                  className="gsap-slide-up"
                >
                  <div style={{
                    backgroundColor: 'rgba(32, 44, 51, 0.85)',
                    border: '1px solid var(--wa-border)',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    color: 'var(--wa-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                  }}>
                    <Bell size={12} color="var(--wa-teal)" />
                    <span>{item.text || item.response}</span>
                    <span style={{ fontSize: '10px', color: 'var(--wa-text-muted)' }}>{item.timestamp}</span>
                  </div>
                </div>
              );
            }

            // Chat Message Activity Card
            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'var(--wa-bg-panel)',
                  border: '1px solid var(--wa-border-light)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                }}
                className="gsap-slide-up interactive-card"
              >
                {/* Message Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--wa-border)',
                  paddingBottom: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(83, 189, 235, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Store size={14} color="var(--wa-text-link)" />
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
                        {item.from || 'Sucursal / Grupo'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={12} color="var(--wa-text-muted)" />
                    <span style={{ fontSize: '11px', color: 'var(--wa-text-secondary)' }}>
                      {item.timestamp}
                    </span>
                  </div>
                </div>

                {/* Incoming Message Bubble (from store) */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-text-secondary)', marginBottom: '3px' }}>
                    Mensaje entrante:
                  </span>
                  <div style={{
                    backgroundColor: 'var(--wa-bubble-in)',
                    border: '1px solid var(--wa-border)',
                    borderRadius: '8px 12px 12px 8px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: 'var(--wa-text-primary)',
                    maxWidth: '92%',
                    lineHeight: '1.4',
                    wordBreak: 'break-word'
                  }}>
                    "{item.text}"
                  </div>
                </div>

                {/* Bot Response Bubble (green WhatsApp bubble) */}
                {item.response && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    marginTop: '2px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                      <Bot size={12} color="var(--wa-green)" />
                      <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-green)' }}>
                        Respuesta del Bot:
                      </span>
                    </div>
                    <div style={{
                      backgroundColor: 'var(--wa-bubble-out)',
                      border: '1px solid var(--wa-bubble-out-border)',
                      borderRadius: '12px 8px 8px 12px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      color: '#ffffff',
                      maxWidth: '92%',
                      lineHeight: '1.4',
                      wordBreak: 'break-word',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <span>{item.response}</span>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
                        <CheckCheck size={14} color="var(--wa-text-link)" />
                      </div>
                    </div>
                  </div>
                )}

              </div>
            );
          })
        )}
        
        <div ref={feedEndRef} />
      </div>

    </div>
  );
}

