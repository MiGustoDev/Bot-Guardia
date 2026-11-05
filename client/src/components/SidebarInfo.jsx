import React, { useState } from 'react';
import { 
  Clock, 
  Shield, 
  Bell, 
  Users, 
  Terminal, 
  Store, 
  ChevronRight, 
  Play, 
  Check, 
  RefreshCw, 
  Trash2,
  X,
  Sparkles
} from 'lucide-react';

export default function SidebarInfo({ activityLog }) {
  const [executingCmd, setExecutingCmd] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  // Count frequency per branch/sender in incoming messages
  const branchCounts = {};
  activityLog.forEach(item => {
    if (item.type === 'incoming' && item.from) {
      const name = item.from.replace(' en ', ' - ');
      branchCounts[name] = (branchCounts[name] || 0) + 1;
    }
  });

  const topBranches = Object.entries(branchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Execute technical command directly on backend
  const handleExecuteCommand = async (command) => {
    setExecutingCmd(command);
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      const data = await res.json();
      setLastResult({
        command,
        reply: data.reply || 'Comando procesado correctamente.',
        success: data.success
      });
    } catch (err) {
      console.error('Error al ejecutar comando:', err);
      setLastResult({
        command,
        reply: 'Error de conexión al ejecutar el comando en el servidor.',
        success: false
      });
    } finally {
      setExecutingCmd(null);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      height: '100%'
    }}>
      
      {/* Widget 1: Protocolo de Guardia (Gris anegrado con acentos sutiles) */}
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
          {/* Card 1 */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--wa-surface-subtle)',
            border: '1px solid var(--wa-border-subtle)',
            borderLeft: '3px solid var(--wa-teal)'
          }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--wa-teal)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Atención en Grupos
            </span>
            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--wa-text-primary)', marginTop: '2px' }}>
              09:00 a 23:59 hs
            </p>
            <p style={{ fontSize: '11px', color: 'var(--wa-text-secondary)', marginTop: '3px', lineHeight: '1.4' }}>
              De 00:00 a 08:59 hs el bot permanece en silencio para no generar ruido.
            </p>
          </div>

          {/* Card 2 */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--wa-surface-subtle)',
            border: '1px solid var(--wa-border-subtle)',
            borderLeft: '3px solid var(--wa-status-warning)'
          }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--wa-status-warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Alertas al Celular del Técnico
            </span>
            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--wa-text-primary)', marginTop: '2px' }}>
              Lun a Vie 17:15 - 23:59 hs
            </p>
            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--wa-text-primary)', marginTop: '1px' }}>
              Sábados y Domingos: 24 hs
            </p>
            <p style={{ fontSize: '11px', color: 'var(--wa-text-secondary)', marginTop: '3px', lineHeight: '1.4' }}>
              El bot reenvía el incidente directo al WhatsApp privado del técnico de guardia.
            </p>
          </div>

          {/* Card 3 */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--wa-surface-subtle)',
            border: '1px solid var(--wa-border-subtle)',
            borderLeft: '3px solid var(--wa-text-link)'
          }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--wa-text-link)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Rotación Automática
            </span>
            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--wa-text-primary)', marginTop: '2px' }}>
              Lunes a las 09:00 hs
            </p>
            <p style={{ fontSize: '11px', color: 'var(--wa-text-secondary)', marginTop: '3px', lineHeight: '1.4' }}>
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
                  backgroundColor: 'var(--wa-surface-subtle)',
                  border: '1px solid var(--wa-border-subtle)'
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
                  backgroundColor: 'rgba(0, 168, 132, 0.15)',
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

      {/* Widget 3: Comandos Técnicos Ejecutables con 1 Clic */}
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
          marginBottom: '10px',
          borderBottom: '1px solid var(--wa-border)',
          paddingBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={18} color="var(--wa-teal)" />
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
              Comandos Rápidos
            </h3>
          </div>
          <span style={{
            fontSize: '11px',
            color: 'var(--wa-teal)',
            backgroundColor: 'rgba(0, 168, 132, 0.12)',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: '600'
          }}>
            Clic para ejecutar
          </span>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--wa-text-secondary)', marginBottom: '12px' }}>
          Toca cualquiera de los comandos para que el bot lo ejecute al instante:
        </p>

        {/* Command Buttons List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* #ping */}
          <button
            onClick={() => handleExecuteCommand('#ping')}
            disabled={executingCmd !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              backgroundColor: 'var(--wa-surface-subtle)',
              border: '1px solid var(--wa-border-subtle)',
              borderRadius: '8px',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
              e.currentTarget.style.borderColor = 'var(--wa-teal)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
              e.currentTarget.style.borderColor = 'var(--wa-border-subtle)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={12} color="var(--wa-green)" />
              <code style={{ color: 'var(--wa-green)', fontWeight: '700', fontSize: '12px' }}>#ping</code>
            </div>
            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '11px' }}>
              {executingCmd === '#ping' ? 'Ejecutando...' : 'Estado, RAM y Uptime'}
            </span>
          </button>

          {/* #guardia */}
          <button
            onClick={() => handleExecuteCommand('#guardia')}
            disabled={executingCmd !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              backgroundColor: 'var(--wa-surface-subtle)',
              border: '1px solid var(--wa-border-subtle)',
              borderRadius: '8px',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
              e.currentTarget.style.borderColor = 'var(--wa-teal)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
              e.currentTarget.style.borderColor = 'var(--wa-border-subtle)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={12} color="var(--wa-teal)" />
              <code style={{ color: 'var(--wa-teal)', fontWeight: '700', fontSize: '12px' }}>#guardia</code>
            </div>
            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '11px' }}>
              {executingCmd === '#guardia' ? 'Consultando...' : 'Ver técnico de turno'}
            </span>
          </button>

          {/* #guardia ramiro */}
          <button
            onClick={() => handleExecuteCommand('#guardia ramiro')}
            disabled={executingCmd !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              backgroundColor: 'var(--wa-surface-subtle)',
              border: '1px solid var(--wa-border-subtle)',
              borderRadius: '8px',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
              e.currentTarget.style.borderColor = 'var(--wa-teal)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
              e.currentTarget.style.borderColor = 'var(--wa-border-subtle)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={12} color="var(--wa-text-link)" />
              <code style={{ color: 'var(--wa-text-link)', fontWeight: '700', fontSize: '12px' }}>#guardia ramiro</code>
            </div>
            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '11px' }}>
              {executingCmd === '#guardia ramiro' ? 'Asignando...' : 'Asignar a Ramiro'}
            </span>
          </button>

          {/* #guardia facu */}
          <button
            onClick={() => handleExecuteCommand('#guardia facu')}
            disabled={executingCmd !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              backgroundColor: 'var(--wa-surface-subtle)',
              border: '1px solid var(--wa-border-subtle)',
              borderRadius: '8px',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
              e.currentTarget.style.borderColor = 'var(--wa-teal)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
              e.currentTarget.style.borderColor = 'var(--wa-border-subtle)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={12} color="var(--wa-text-link)" />
              <code style={{ color: 'var(--wa-text-link)', fontWeight: '700', fontSize: '12px' }}>#guardia facu</code>
            </div>
            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '11px' }}>
              {executingCmd === '#guardia facu' ? 'Asignando...' : 'Asignar a Facu'}
            </span>
          </button>

          {/* #guardia ambos */}
          <button
            onClick={() => handleExecuteCommand('#guardia ambos')}
            disabled={executingCmd !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              backgroundColor: 'var(--wa-surface-subtle)',
              border: '1px solid var(--wa-border-subtle)',
              borderRadius: '8px',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
              e.currentTarget.style.borderColor = 'var(--wa-teal)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
              e.currentTarget.style.borderColor = 'var(--wa-border-subtle)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={12} color="var(--wa-status-warning)" />
              <code style={{ color: 'var(--wa-status-warning)', fontWeight: '700', fontSize: '12px' }}>#guardia ambos</code>
            </div>
            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '11px' }}>
              {executingCmd === '#guardia ambos' ? 'Asignando...' : 'Asignar a Ambos'}
            </span>
          </button>

          {/* #aprendido */}
          <button
            onClick={() => handleExecuteCommand('#aprendido')}
            disabled={executingCmd !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              backgroundColor: 'var(--wa-surface-subtle)',
              border: '1px solid var(--wa-border-subtle)',
              borderRadius: '8px',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
              e.currentTarget.style.borderColor = 'var(--wa-teal)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
              e.currentTarget.style.borderColor = 'var(--wa-border-subtle)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={12} color="var(--wa-green)" />
              <code style={{ color: 'var(--wa-green)', fontWeight: '700', fontSize: '12px' }}>#aprendido</code>
            </div>
            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '11px' }}>
              {executingCmd === '#aprendido' ? 'Consultando...' : 'Ver memoria aprendida'}
            </span>
          </button>

          {/* #limpiar */}
          <button
            onClick={() => handleExecuteCommand('#limpiar')}
            disabled={executingCmd !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              backgroundColor: 'var(--wa-surface-subtle)',
              border: '1px solid var(--wa-border-subtle)',
              borderRadius: '8px',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
              e.currentTarget.style.borderColor = 'var(--wa-teal)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
              e.currentTarget.style.borderColor = 'var(--wa-border-subtle)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={12} color="var(--wa-status-info)" />
              <code style={{ color: 'var(--wa-status-info)', fontWeight: '700', fontSize: '12px' }}>#limpiar</code>
            </div>
            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '11px' }}>
              {executingCmd === '#limpiar' ? 'Limpiando...' : 'Liberar RAM / Caché'}
            </span>
          </button>

        </div>

        {/* Command Output Feedback Card */}
        {lastResult && (
          <div style={{
            marginTop: '12px',
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--wa-bubble-out)',
            border: '1px solid var(--wa-bubble-out-border)',
            position: 'relative'
          }} className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} color="var(--wa-green)" />
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--wa-green)' }}>
                  Resultado de {lastResult.command}:
                </span>
              </div>
              <button
                onClick={() => setLastResult(null)}
                style={{ background: 'none', color: '#ffffff', padding: '2px' }}
              >
                <X size={14} />
              </button>
            </div>
            <pre style={{
              fontSize: '12px',
              color: '#ffffff',
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              lineHeight: '1.4'
            }}>
              {lastResult.reply}
            </pre>
          </div>
        )}

      </div>

    </div>
  );
}
