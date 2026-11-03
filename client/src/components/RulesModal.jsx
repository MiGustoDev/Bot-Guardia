import React, { useState, useEffect } from 'react';
import { X, Sliders, CheckCircle, AlertCircle, Bot, Zap, Clock } from 'lucide-react';

export default function RulesModal({ isOpen, onClose }) {
  const [rules, setRules] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rules'); // 'rules', 'config'

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        fetch('/api/rules').then(r => r.json()).catch(() => []),
        fetch('/api/config').then(r => r.json()).catch(() => null)
      ]).then(([rulesData, configData]) => {
        setRules(Array.isArray(rulesData) ? rulesData : []);
        setConfig(configData);
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }} className="animate-fade-in">
      
      <div style={{
        backgroundColor: 'var(--wa-bg-panel)',
        border: '1px solid var(--wa-border-light)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--wa-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="var(--wa-teal)" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
              Reglas y Configuración del Bot
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              color: 'var(--wa-text-secondary)',
              fontSize: '18px',
              padding: '6px'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--wa-text-primary)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--wa-text-secondary)'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switch */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--wa-border)',
          backgroundColor: 'var(--wa-bg-deep)'
        }}>
          <button
            onClick={() => setActiveTab('rules')}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: activeTab === 'rules' ? 'var(--wa-bg-panel)' : 'transparent',
              color: activeTab === 'rules' ? 'var(--wa-teal)' : 'var(--wa-text-secondary)',
              borderBottom: activeTab === 'rules' ? '2px solid var(--wa-teal)' : '2px solid transparent'
            }}
          >
            Reglas de Contingencia ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('config')}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: activeTab === 'config' ? 'var(--wa-bg-panel)' : 'transparent',
              color: activeTab === 'config' ? 'var(--wa-teal)' : 'var(--wa-text-secondary)',
              borderBottom: activeTab === 'config' ? '2px solid var(--wa-teal)' : '2px solid transparent'
            }}
          >
            Configuración General & IA
          </button>
        </div>

        {/* Modal Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--wa-text-secondary)', padding: '20px' }}>
              Cargando información del servidor...
            </p>
          ) : activeTab === 'rules' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--wa-text-secondary)' }}>
                Estas reglas responden automáticamente ante palabras clave recurrentes enviadas por las sucursales:
              </p>

              {rules.map((rule) => (
                <div
                  key={rule.id || rule.trigger}
                  style={{
                    backgroundColor: 'var(--wa-bg-deep)',
                    border: '1px solid var(--wa-border)',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(0, 168, 132, 0.15)',
                        color: 'var(--wa-teal)'
                      }}>
                        Palabra Clave:
                      </span>
                      <strong style={{ fontSize: '14px', color: 'var(--wa-text-primary)' }}>
                        "{rule.trigger}"
                      </strong>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      color: rule.active ? 'var(--wa-green)' : 'var(--wa-text-muted)',
                      fontWeight: '600'
                    }}>
                      {rule.active ? '● Activa' : '○ Inactiva'}
                    </span>
                  </div>

                  <div style={{
                    backgroundColor: 'var(--wa-bubble-out)',
                    border: '1px solid var(--wa-bubble-out-border)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#ffffff',
                    lineHeight: '1.4'
                  }}>
                    {rule.reply}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {config ? (
                <>
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--wa-bg-deep)',
                    border: '1px solid var(--wa-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--wa-text-primary)' }}>
                        Estado Global del Bot
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: config.botEnabled ? 'var(--wa-green)' : 'var(--wa-status-danger)'
                      }}>
                        {config.botEnabled ? 'HABILITADO' : 'PAUSADO'}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--wa-text-secondary)' }}>
                      Si está pausado, el bot no contestará mensajes en ningún chat ni grupo.
                    </p>
                  </div>

                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--wa-bg-deep)',
                    border: '1px solid var(--wa-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--wa-text-primary)' }}>
                        Filtro de Menciones en Grupos
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: config.onlyOnMention ? 'var(--wa-teal)' : 'var(--wa-text-secondary)'
                      }}>
                        {config.onlyOnMention ? 'SOLO CUANDO LO ARROBAN' : 'TODOS LOS MENSAJES'}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--wa-text-secondary)' }}>
                      El bot solo atiende en grupos si lo mencionan explícitamente con @sistemas o @guardia.
                    </p>
                  </div>

                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--wa-bg-deep)',
                    border: '1px solid var(--wa-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--wa-text-primary)' }}>
                        Asistente Inteligente Gemini AI
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: config.geminiEnabled ? 'var(--wa-green)' : 'var(--wa-text-muted)'
                      }}>
                        {config.geminiEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--wa-text-secondary)' }}>
                      Fallback de Inteligencia Artificial para consultas no contempladas en las reglas estáticas.
                    </p>
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--wa-text-secondary)' }}>No se pudo leer la configuración.</p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--wa-border)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0, 0, 0, 0.15)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              backgroundColor: 'var(--wa-teal)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            Cerrar
          </button>
        </div>

      </div>

    </div>
  );
}

