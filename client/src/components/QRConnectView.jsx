import React from 'react';
import { Smartphone, RefreshCw, QrCode, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

export default function QRConnectView({ status, qrCode, onRestart, isRestarting }) {
  return (
    <div style={{
      maxWidth: '960px',
      margin: '40px auto',
      padding: '0 20px',
      width: '100%'
    }} className="animate-fade-in">
      
      {/* Main Connection Card */}
      <div style={{
        backgroundColor: 'var(--wa-bg-panel)',
        border: '1px solid var(--wa-border-light)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Card Header Strip */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--wa-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Smartphone size={20} color="var(--wa-teal)" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--wa-text-primary)' }}>
              Vinculación de Dispositivo de Guardia
            </span>
          </div>
          <span style={{
            fontSize: '12px',
            color: 'var(--wa-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Shield size={14} color="var(--wa-teal)" />
            Sesión persistente y encriptada
          </span>
        </div>

        {/* Content Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
          padding: '36px 32px',
          alignItems: 'center'
        }}>
          
          {/* Instructions Column */}
          <div>
            <h2 style={{
              fontSize: '22px',
              fontWeight: '700',
              color: 'var(--wa-text-primary)',
              marginBottom: '12px',
              lineHeight: '1.3'
            }}>
              Para vincular el bot de guardia a WhatsApp:
            </h2>
            <p style={{
              fontSize: '14px',
              color: 'var(--wa-text-secondary)',
              marginBottom: '24px',
              lineHeight: '1.5'
            }}>
              El bot necesita escanearse desde el número de teléfono oficial o el celular operativo de guardia para poder responder en los grupos de las sucursales.
            </p>

            {/* Steps List */}
            <ol style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              listStyle: 'none'
            }}>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--wa-teal)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>1</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--wa-text-primary)' }}>
                    Abrí WhatsApp en el teléfono de la guardia
                  </p>
                </div>
              </li>

              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--wa-teal)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>2</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--wa-text-primary)' }}>
                    Tocá el <strong>Menú (tres puntos)</strong> en Android o <strong>Configuración</strong> en iPhone
                  </p>
                </div>
              </li>

              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--wa-teal)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>3</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--wa-text-primary)' }}>
                    Seleccioná <strong>Dispositivos vinculados</strong> y luego <strong>Vincular un dispositivo</strong>
                  </p>
                </div>
              </li>

              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--wa-teal)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>4</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--wa-text-primary)' }}>
                    Apuntá la cámara hacia la pantalla para escanear el código QR
                  </p>
                </div>
              </li>
            </ol>

            {/* Quick status notice */}
            <div style={{
              marginTop: '28px',
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(0, 168, 132, 0.08)',
              border: '1px solid rgba(0, 168, 132, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <CheckCircle2 size={18} color="var(--wa-teal)" />
              <p style={{ fontSize: '12px', color: 'var(--wa-text-secondary)', lineHeight: '1.4' }}>
                Una vez escaneado, la sesión se guarda automáticamente y el panel pasará a modo monitor en vivo.
              </p>
            </div>
          </div>

          {/* QR Code Container Column */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              position: 'relative',
              padding: '16px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 8px 30px rgba(0, 168, 132, 0.2)',
              border: '3px solid var(--wa-teal)',
              width: '280px',
              height: '280px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {status === 'QR_READY' && qrCode ? (
                <img
                  src={qrCode}
                  alt="Código QR WhatsApp"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }}
                />
              ) : status === 'CONNECTING' ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: '14px',
                  color: '#111b21'
                }}>
                  <RefreshCw size={36} color="var(--wa-teal)" style={{ animation: 'spin 1.2s linear infinite' }} />
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#111b21' }}>
                    Iniciando WhatsApp Web...
                  </p>
                  <span style={{ fontSize: '11px', color: '#667781' }}>
                    Generando nuevo código seguro
                  </span>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: '14px',
                  color: '#111b21',
                  padding: '12px'
                }}>
                  <AlertCircle size={36} color="var(--wa-status-warning)" />
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#111b21' }}>
                    Código QR en espera
                  </p>
                  <p style={{ fontSize: '11px', color: '#667781' }}>
                    Haz clic abajo para generar el código QR de conexión
                  </p>
                </div>
              )}
            </div>

            {/* Refresh QR Button */}
            <button
              onClick={onRestart}
              disabled={isRestarting}
              style={{
                marginTop: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '24px',
                backgroundColor: 'var(--wa-teal)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '600',
                boxShadow: '0 4px 14px rgba(0, 168, 132, 0.3)'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-teal-hover)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-teal)'}
            >
              <RefreshCw size={14} className={isRestarting ? 'animate-spin' : ''} />
              <span>{isRestarting ? 'Actualizando QR...' : 'Recargar / Generar nuevo QR'}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

