import React from 'react';
import { Clock, Shield, Bell, Users, Terminal, Store, ChevronRight } from 'lucide-react';

export default function SidebarInfo({ activityLog }) {
  // Count frequency per branch/sender in incoming messages
  const branchCounts = {};
  activityLog.forEach(item => {
    if (item.type === 'incoming' && item.from) {
      // Clean up common prefixes
      const name = item.from.replace(' en ', ' - ');
      branchCounts[name] = (branchCounts[name] || 0) + 1;
    }
  });

  const topBranches = Object.entries(branchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      
      {/* Widget 1: Protocolo de Guardia */}
      <div style={{
        backgroundColor: 'var(--wa-bg-panel)',
        border: '1px solid var(--wa-border)',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '14px',
          borderBottom: '1px solid var(--wa-border)',
          paddingBottom: '10px'
        }}>
          <Clock size={18} color="var(--wa-teal)" />
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
            Protocolo de Horarios
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--wa-bg-deep)',
            border: '1px solid var(--wa-border)'
          }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-teal)', textTransform: 'uppercase' }}>
              Atención en Grupos
            </span>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--wa-text-primary)', marginTop: '2px' }}>
              09:00 a 23:59 hs
            </p>
            <p style={{ fontSize: '11px', color: 'var(--wa-text-secondary)', marginTop: '2px' }}>
              De 00:00 a 08:59 hs el bot permanece en silencio para no generar ruido.
            </p>
          </div>

          <div style={{
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--wa-bg-deep)',
            border: '1px solid var(--wa-border)'
          }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-status-warning)', textTransform: 'uppercase' }}>
              Alertas al Celular del Técnico
            </span>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--wa-text-primary)', marginTop: '2px' }}>
              Lun a Vie 17:15 - 23:59 hs
            </p>
            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--wa-text-primary)', marginTop: '1px' }}>
              Sábados y Domingos: 24 hs
            </p>
            <p style={{ fontSize: '11px', color: 'var(--wa-text-secondary)', marginTop: '2px' }}>
              El bot reenvía el incidente directo al WhatsApp privado del técnico de guardia.
            </p>
          </div>

          <div style={{
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--wa-bg-deep)',
            border: '1px solid var(--wa-border)'
          }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-text-link)', textTransform: 'uppercase' }}>
              Rotación Automática
            </span>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--wa-text-primary)', marginTop: '2px' }}>
              Lunes a las 09:00 hs
            </p>
            <p style={{ fontSize: '11px', color: 'var(--wa-text-secondary)', marginTop: '2px' }}>
              Se envía automáticamente el reporte de cierre semanal y se pasa el turno al siguiente técnico.
            </p>
          </div>
        </div>
      </div>

      {/* Widget 2: Ranking de Sucursales */}
      <div style={{
        backgroundColor: 'var(--wa-bg-panel)',
        border: '1px solid var(--wa-border)',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          borderBottom: '1px solid var(--wa-border)',
          paddingBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={18} color="var(--wa-teal)" />
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
              Top Sucursales Activas
            </h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--wa-text-muted)' }}>Sesión actual</span>
        </div>

        {topBranches.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--wa-text-secondary)', textAlign: 'center', padding: '12px 0' }}>
            Aún no se registraron incidentes de sucursales en esta sesión.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topBranches.map(([name, count], index) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--wa-bg-deep)',
                  border: '1px solid var(--wa-border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: index === 0 ? 'var(--wa-teal)' : 'var(--wa-bg-active)',
                    color: index === 0 ? '#ffffff' : 'var(--wa-text-secondary)',
                    fontSize: '11px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {index + 1}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'var(--wa-text-primary)',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {name}
                  </span>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--wa-teal)',
                  backgroundColor: 'rgba(0, 168, 132, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  {count} {count === 1 ? 'msg' : 'msgs'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Widget 3: Comandos Rápidos por WhatsApp */}
      <div style={{
        backgroundColor: 'var(--wa-bg-panel)',
        border: '1px solid var(--wa-border)',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          borderBottom: '1px solid var(--wa-border)',
          paddingBottom: '10px'
        }}>
          <Terminal size={18} color="var(--wa-teal)" />
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
            Comandos Técnicos (Chat Privado)
          </h3>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--wa-text-secondary)', marginBottom: '10px' }}>
          El técnico puede enviar estos comandos por mensaje privado al bot:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            padding: '6px 10px',
            backgroundColor: 'var(--wa-bg-deep)',
            borderRadius: '6px'
          }}>
            <code style={{ color: 'var(--wa-green)', fontWeight: '700' }}>#ping</code>
            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '11px' }}>Chequeo de estado y uptime</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            padding: '6px 10px',
            backgroundColor: 'var(--wa-bg-deep)',
            borderRadius: '6px'
          }}>
            <code style={{ color: 'var(--wa-green)', fontWeight: '700' }}>#guardia</code>
            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '11px' }}>Ver quién está de turno</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            padding: '6px 10px',
            backgroundColor: 'var(--wa-bg-deep)',
            borderRadius: '6px'
          }}>
            <code style={{ color: 'var(--wa-green)', fontWeight: '700' }}>#guardia [nombre]</code>
            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '11px' }}>Reasignar turno manualmente</span>
          </div>
        </div>
      </div>

    </div>
  );
}

