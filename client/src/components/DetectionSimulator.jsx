import React, { useState } from 'react';
import { Sparkles, Send, MapPin, Zap, Bell, CheckCircle2, AlertTriangle, CornerDownRight } from 'lucide-react';

export default function DetectionSimulator() {
  const [testText, setTestText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const presets = [
    'No nos anda la comandera en Belgrano',
    'No aparece la promo en el sistema en Palermo',
    'Nos sale comanda duplicada en Devoto',
    'Las pantallas tienen mal los precios en Caballito',
    'Me figura sin stock de empanadas en Pilar'
  ];

  const handleSimulate = async (textToTest) => {
    const text = textToTest || testText;
    if (!text.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, chatTitle: 'Grupo Guardia Sucursales' })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      }
    } catch (err) {
      console.error('Error simulando:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--wa-bg-panel)',
      border: '1px solid var(--wa-border)',
      borderRadius: '16px',
      padding: '18px 20px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--wa-teal)" />
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
            Simulador de Detección & Respuestas (Sandbox)
          </h3>
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: '600',
          padding: '2px 8px',
          borderRadius: '10px',
          backgroundColor: 'rgba(0, 168, 132, 0.12)',
          color: 'var(--wa-teal)'
        }}>
          Pruebas Técnicas
        </span>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--wa-text-secondary)', lineHeight: '1.4' }}>
        Escribe un mensaje de prueba para verificar cómo reaccionará el bot ante una sucursal sin mandar mensajes reales por WhatsApp:
      </p>

      {/* Input and Action */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Ej: No anda la comandera en Palermo / Necesito instalar comandera / Comanda duplicada..."
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSimulate()}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            backgroundColor: 'var(--wa-surface-subtle)',
            border: '1px solid var(--wa-border-subtle)',
            borderRadius: '8px'
          }}
        />
        <button
          onClick={() => handleSimulate()}
          disabled={loading || !testText.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--wa-teal)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: '600',
            boxShadow: '0 2px 8px rgba(0, 168, 132, 0.25)'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-teal-hover)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-teal)'}
        >
          <Send size={13} />
          <span>{loading ? 'Analizando...' : 'Simular'}</span>
        </button>
      </div>

      {/* Quick Presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--wa-text-muted)', textTransform: 'uppercase' }}>
          Ejemplos rápidos:
        </span>
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setTestText(preset);
              handleSimulate(preset);
            }}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: 'var(--wa-surface-subtle)',
              border: '1px solid var(--wa-border-subtle)',
              color: 'var(--wa-text-secondary)',
              fontSize: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
              e.currentTarget.style.color = 'var(--wa-text-primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
              e.currentTarget.style.color = 'var(--wa-text-secondary)';
            }}
          >
            "{preset}"
          </button>
        ))}
      </div>

      {/* Result Card */}
      {result && (
        <div style={{
          marginTop: '6px',
          padding: '12px 14px',
          borderRadius: '10px',
          backgroundColor: 'var(--wa-surface-subtle)',
          border: '1px solid var(--wa-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }} className="animate-fade-in">
          
          {/* Pills bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(83, 189, 235, 0.12)',
              color: 'var(--wa-text-link)',
              border: '1px solid rgba(83, 189, 235, 0.25)'
            }}>
              <MapPin size={12} />
              Sucursal: {result.detectedBranch}
            </span>

            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: result.matchedRule ? 'rgba(0, 168, 132, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              color: result.matchedRule ? 'var(--wa-green)' : 'var(--wa-text-secondary)',
              border: '1px solid ' + (result.matchedRule ? 'rgba(0, 168, 132, 0.3)' : 'var(--wa-border)')
            }}>
              <Zap size={12} />
              {result.matchedRule ? `Regla: "${result.matchedRule.trigger}"` : 'Flujo de Guardia'}
            </span>

            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: result.willAlert ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              color: result.willAlert ? 'var(--wa-status-warning)' : 'var(--wa-text-muted)',
              border: '1px solid ' + (result.willAlert ? 'rgba(245, 158, 11, 0.25)' : 'var(--wa-border)')
            }}>
              <Bell size={12} />
              {result.willAlert ? `Alerta a: ${result.activeTech}` : 'Sin alerta inmediata'}
            </span>
          </div>

          {/* Response Bubble */}
          <div style={{
            backgroundColor: 'var(--wa-bubble-out)',
            border: '1px solid var(--wa-bubble-out-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#ffffff',
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap'
          }}>
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>
              Respuesta simulada del bot:
            </span>
            {result.reply}
          </div>

        </div>
      )}

    </div>
  );
}

