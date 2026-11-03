import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sliders, 
  CheckCircle, 
  AlertCircle, 
  Bot, 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  Key, 
  Clock, 
  MessageSquare
} from 'lucide-react';

// Auto-expanding textarea that grows downward on new lines
function AutoExpandingTextarea({ value, onChange, placeholder, style = {}, minHeight = 44, ...props }) {
  const textareaRef = useRef(null);

  const resize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const newHeight = Math.max(el.scrollHeight, minHeight);
      el.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        if (onChange) onChange(e);
        resize();
      }}
      placeholder={placeholder}
      style={{
        overflowY: 'hidden',
        resize: 'none',
        transition: 'height 0.12s ease',
        boxSizing: 'border-box',
        ...style
      }}
      {...props}
    />
  );
}

export default function RulesModal({ isOpen, onClose }) {
  const [rules, setRules] = useState([]);
  const [config, setConfig] = useState({
    botEnabled: true,
    onlyOnMention: true,
    mentionReplyMessage: 'No te preocupes, ya lo estamos revisando',
    geminiEnabled: false,
    geminiApiKey: '',
    geminiPrompt: '',
    delayMin: 1,
    delayMax: 2
  });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rules'); // 'rules', 'config'
  const [savingRules, setSavingRules] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // New rule state
  const [newTrigger, setNewTrigger] = useState('');
  const [newReply, setNewReply] = useState('');
  const [newType, setNewType] = useState('contains');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSaveSuccessMsg('');
      Promise.all([
        fetch('/api/rules').then(r => r.json()).catch(() => []),
        fetch('/api/config').then(r => r.json()).catch(() => null)
      ]).then(([rulesData, configData]) => {
        setRules(Array.isArray(rulesData) ? rulesData : []);
        if (configData) setConfig(configData);
        setLoading(false);
      });
    }
  }, [isOpen]);

  const triggerSuccess = (msg) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleToggleRule = (index) => {
    const updated = [...rules];
    updated[index].active = !updated[index].active;
    setRules(updated);
  };

  const handleReplyChange = (index, value) => {
    const updated = [...rules];
    updated[index].reply = value;
    setRules(updated);
  };

  const handleDeleteRule = (index) => {
    if (window.confirm('¿Seguro que deseas eliminar esta regla?')) {
      const updated = rules.filter((_, i) => i !== index);
      setRules(updated);
    }
  };

  const handleAddRule = (e) => {
    e.preventDefault();
    if (!newTrigger.trim() || !newReply.trim()) return;

    const newRule = {
      id: Date.now().toString(),
      trigger: newTrigger.trim().toLowerCase(),
      reply: newReply.trim(),
      type: newType,
      active: true
    };

    setRules([newRule, ...rules]);
    setNewTrigger('');
    setNewReply('');
    setShowAddForm(false);
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules)
      });
      const data = await res.json();
      if (data.success) {
        triggerSuccess('¡Reglas guardadas correctamente en el bot!');
      } else {
        alert('Error al guardar: ' + (data.error || 'Desconocido'));
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al guardar las reglas.');
    } finally {
      setSavingRules(false);
    }
  };

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        triggerSuccess('¡Configuración guardada correctamente!');
      } else {
        alert('Error al guardar la configuración.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al guardar la configuración.');
    } finally {
      setSavingConfig(false);
    }
  };

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
        maxWidth: '820px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--wa-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="var(--wa-teal)" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
              Gestor de Respuestas y Configuración
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              color: 'var(--wa-text-secondary)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--wa-text-primary)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--wa-text-secondary)'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Success toast notification */}
        {saveSuccessMsg && (
          <div style={{
            backgroundColor: 'rgba(37, 211, 102, 0.15)',
            borderBottom: '1px solid var(--wa-green)',
            color: 'var(--wa-green)',
            padding: '10px 24px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Check size={16} />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Unified Tab Switch (Gris anegrado, sin bloques negros) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--wa-border)',
          backgroundColor: 'var(--wa-surface-subtle)',
          padding: '4px 16px 0 16px',
          gap: '8px'
        }}>
          <button
            onClick={() => setActiveTab('rules')}
            style={{
              padding: '12px 20px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: activeTab === 'rules' ? 'var(--wa-bg-panel)' : 'transparent',
              color: activeTab === 'rules' ? 'var(--wa-teal)' : 'var(--wa-text-secondary)',
              border: '1px solid ' + (activeTab === 'rules' ? 'var(--wa-border)' : 'transparent'),
              borderBottom: activeTab === 'rules' ? '2px solid var(--wa-teal)' : 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              if (activeTab !== 'rules') e.currentTarget.style.color = 'var(--wa-text-primary)';
            }}
            onMouseOut={(e) => {
              if (activeTab !== 'rules') e.currentTarget.style.color = 'var(--wa-text-secondary)';
            }}
          >
            Reglas de Contingencia ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('config')}
            style={{
              padding: '12px 20px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: activeTab === 'config' ? 'var(--wa-bg-panel)' : 'transparent',
              color: activeTab === 'config' ? 'var(--wa-teal)' : 'var(--wa-text-secondary)',
              border: '1px solid ' + (activeTab === 'config' ? 'var(--wa-border)' : 'transparent'),
              borderBottom: activeTab === 'config' ? '2px solid var(--wa-teal)' : 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              if (activeTab !== 'config') e.currentTarget.style.color = 'var(--wa-text-primary)';
            }}
            onMouseOut={(e) => {
              if (activeTab !== 'config') e.currentTarget.style.color = 'var(--wa-text-secondary)';
            }}
          >
            Configuración del Bot & IA
          </button>
        </div>

        {/* Content Body */}
        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--wa-text-secondary)', padding: '24px' }}>
              Cargando reglas y configuración...
            </p>
          ) : activeTab === 'rules' ? (
            /* =================== TAB 1: REGLAS =================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Top Action Bar for Rules */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <p style={{ fontSize: '12px', color: 'var(--wa-text-secondary)' }}>
                  Respuestas automáticas disparadas por palabras clave en los mensajes de las sucursales:
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* "+ Nueva Regla" Unified Button */}
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      backgroundColor: showAddForm ? 'rgba(0, 168, 132, 0.15)' : 'var(--wa-surface-subtle)',
                      color: showAddForm ? 'var(--wa-teal)' : 'var(--wa-text-primary)',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: '1px solid ' + (showAddForm ? 'var(--wa-teal)' : 'var(--wa-border-subtle)'),
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)';
                      e.currentTarget.style.borderColor = 'var(--wa-teal)';
                    }}
                    onMouseOut={(e) => {
                      if (!showAddForm) {
                        e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)';
                        e.currentTarget.style.borderColor = 'var(--wa-border-subtle)';
                      }
                    }}
                  >
                    <Plus size={14} color="var(--wa-teal)" />
                    <span>{showAddForm ? 'Cancelar' : 'Nueva Regla'}</span>
                  </button>

                  <button
                    onClick={handleSaveRules}
                    disabled={savingRules}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--wa-teal)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '700',
                      boxShadow: '0 2px 8px rgba(0, 168, 132, 0.3)',
                      cursor: 'pointer'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-teal-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-teal)'}
                  >
                    <Save size={14} />
                    <span>{savingRules ? 'Guardando...' : 'Guardar Cambios'}</span>
                  </button>
                </div>
              </div>

              {/* Add Rule Inline Form (Gris anegrado unificado) */}
              {showAddForm && (
                <form
                  onSubmit={handleAddRule}
                  style={{
                    backgroundColor: 'var(--wa-surface-subtle)',
                    border: '1px solid var(--wa-teal)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                  className="animate-fade-in"
                >
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
                    Agregar Nueva Regla de Contingencia
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Palabra Clave (Trigger)
                      </label>
                      <input
                        type="text"
                        placeholder="ej: posnet, arca, comandera, caja"
                        value={newTrigger}
                        onChange={(e) => setNewTrigger(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '13px',
                          backgroundColor: '#162026',
                          border: '1px solid var(--wa-border-subtle)',
                          borderRadius: '8px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Coincidencia
                      </label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '13px',
                          backgroundColor: '#162026',
                          border: '1px solid var(--wa-border-subtle)',
                          borderRadius: '8px'
                        }}
                      >
                        <option value="contains">Contiene la palabra</option>
                        <option value="exact">Mensaje exacto</option>
                        <option value="starts_with">Empieza con</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Respuesta del Bot
                    </label>
                    <AutoExpandingTextarea
                      placeholder="Escribe la respuesta automática técnica que enviará el bot..."
                      value={newReply}
                      onChange={(e) => setNewReply(e.target.value)}
                      required
                      minHeight={64}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '13px',
                        backgroundColor: '#162026',
                        border: '1px solid var(--wa-border-subtle)',
                        borderRadius: '8px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        backgroundColor: 'transparent',
                        color: 'var(--wa-text-secondary)',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '6px 16px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--wa-teal)',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Añadir Regla a la Lista
                    </button>
                  </div>
                </form>
              )}

              {/* Rules List (Rediseño Gris Anegrado con acento verde y switches modernos) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id || idx}
                    style={{
                      backgroundColor: 'var(--wa-surface-subtle)',
                      border: '1px solid var(--wa-border-subtle)',
                      borderLeft: '3px solid ' + (rule.active ? 'var(--wa-teal)' : 'var(--wa-status-danger)'),
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      opacity: rule.active ? 1 : 0.65,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        
                        {/* Animated Mini Toggle Switch */}
                        <div
                          onClick={() => handleToggleRule(idx)}
                          style={{
                            width: '32px',
                            height: '18px',
                            borderRadius: '10px',
                            backgroundColor: rule.active ? 'var(--wa-teal)' : 'rgba(255, 255, 255, 0.12)',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'background-color 0.25s ease'
                          }}
                          title={rule.active ? 'Desactivar regla' : 'Activar regla'}
                        >
                          <div style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            backgroundColor: '#ffffff',
                            position: 'absolute',
                            top: '2px',
                            left: '2px',
                            transform: rule.active ? 'translateX(14px)' : 'translateX(0px)',
                            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)'
                          }} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(0, 168, 132, 0.12)',
                            color: 'var(--wa-teal)',
                            border: '1px solid rgba(0, 168, 132, 0.25)'
                          }}>
                            {rule.type}
                          </span>
                          <strong style={{ fontSize: '14px', color: 'var(--wa-text-primary)' }}>
                            "{rule.trigger}"
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '11px',
                          color: rule.active ? 'var(--wa-green)' : 'var(--wa-status-danger)',
                          fontWeight: '600'
                        }}>
                          {rule.active ? 'Activa' : 'Pausada'}
                        </span>
                        
                        {/* Delete button styled in unified gris anegrado */}
                        <button
                          onClick={() => handleDeleteRule(idx)}
                          title="Eliminar regla"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: '#162026',
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
                            e.currentTarget.style.backgroundColor = '#162026';
                            e.currentTarget.style.borderColor = 'var(--wa-border-subtle)';
                            e.currentTarget.style.color = 'var(--wa-text-secondary)';
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Editable response area styled in unified elevated dark surface with auto-expand */}
                    <div>
                      <AutoExpandingTextarea
                        value={rule.reply}
                        onChange={(e) => handleReplyChange(idx, e.target.value)}
                        placeholder="Escribe la respuesta del bot..."
                        minHeight={42}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: '12px',
                          backgroundColor: '#162026',
                          border: '1px solid var(--wa-border-subtle)',
                          borderRadius: '8px',
                          color: 'var(--wa-text-primary)',
                          lineHeight: '1.4'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

            </div>
          ) : (
            /* =================== TAB 2: CONFIGURACIÓN =================== */
            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Toggle Bot Enabled */}
              <div style={{
                backgroundColor: 'var(--wa-surface-subtle)',
                border: '1px solid var(--wa-border-subtle)',
                borderLeft: '3px solid ' + (config.botEnabled ? 'var(--wa-teal)' : 'var(--wa-status-danger)'),
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
                    Bot Activo General
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--wa-text-secondary)', marginTop: '2px' }}>
                    Si se desactiva, el bot entra en modo mantenimiento y no responderá ningún mensaje.
                  </p>
                </div>
                
                {/* Modern Switch */}
                <div
                  onClick={() => setConfig({ ...config, botEnabled: !config.botEnabled })}
                  style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '12px',
                    backgroundColor: config.botEnabled ? 'var(--wa-teal)' : 'rgba(255, 255, 255, 0.12)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background-color 0.25s ease'
                  }}
                >
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    position: 'absolute',
                    top: '2px',
                    left: '2px',
                    transform: config.botEnabled ? 'translateX(16px)' : 'translateX(0px)',
                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)'
                  }} />
                </div>
              </div>

              {/* Toggle Only on Mention */}
              <div style={{
                backgroundColor: 'var(--wa-surface-subtle)',
                border: '1px solid var(--wa-border-subtle)',
                borderLeft: '3px solid ' + (config.onlyOnMention ? 'var(--wa-teal)' : 'var(--wa-text-link)'),
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
                    Responder Solo ante Mención en Grupos
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--wa-text-secondary)', marginTop: '2px' }}>
                    Solo interviene si la sucursal menciona al bot (@sistemas, @guardia o arrobando al número).
                  </p>
                </div>

                {/* Modern Switch */}
                <div
                  onClick={() => setConfig({ ...config, onlyOnMention: !config.onlyOnMention })}
                  style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '12px',
                    backgroundColor: config.onlyOnMention ? 'var(--wa-teal)' : 'rgba(255, 255, 255, 0.12)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background-color 0.25s ease'
                  }}
                >
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    position: 'absolute',
                    top: '2px',
                    left: '2px',
                    transform: config.onlyOnMention ? 'translateX(16px)' : 'translateX(0px)',
                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)'
                  }} />
                </div>
              </div>

              {/* Gemini AI Settings */}
              <div style={{
                backgroundColor: 'var(--wa-surface-subtle)',
                border: '1px solid var(--wa-border-subtle)',
                borderLeft: '3px solid ' + (config.geminiEnabled ? 'var(--wa-teal)' : 'var(--wa-text-muted)'),
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={18} color="var(--wa-teal)" />
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--wa-text-primary)' }}>
                      Asistente Inteligente Gemini AI
                    </h4>
                  </div>

                  {/* Modern Switch */}
                  <div
                    onClick={() => setConfig({ ...config, geminiEnabled: !config.geminiEnabled })}
                    style={{
                      width: '36px',
                      height: '20px',
                      borderRadius: '12px',
                      backgroundColor: config.geminiEnabled ? 'var(--wa-teal)' : 'rgba(255, 255, 255, 0.12)',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background-color 0.25s ease'
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      position: 'absolute',
                      top: '2px',
                      left: '2px',
                      transform: config.geminiEnabled ? 'translateX(16px)' : 'translateX(0px)',
                      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)'
                    }} />
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--wa-text-secondary)' }}>
                  Genera respuestas inteligentes con IA cuando el mensaje de la sucursal no coincide con ninguna regla estática.
                </p>

                {config.geminiEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }} className="animate-fade-in">
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Gemini API Key
                      </label>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={config.geminiApiKey || ''}
                        onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '13px',
                          backgroundColor: '#162026',
                          border: '1px solid var(--wa-border-subtle)',
                          borderRadius: '8px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Prompt del Sistema (Comportamiento de la IA)
                      </label>
                      <AutoExpandingTextarea
                        value={config.geminiPrompt || ''}
                        onChange={(e) => setConfig({ ...config, geminiPrompt: e.target.value })}
                        minHeight={64}
                        placeholder="Escribe el prompt de comportamiento del bot..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: '12px',
                          backgroundColor: '#162026',
                          border: '1px solid var(--wa-border-subtle)',
                          borderRadius: '8px'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Save Config Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={savingConfig}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--wa-teal)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    boxShadow: '0 2px 10px rgba(0, 168, 132, 0.3)',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-teal-hover)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-teal)'}
                >
                  <Save size={16} />
                  <span>{savingConfig ? 'Guardando...' : 'Guardar Configuración'}</span>
                </button>
              </div>

            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--wa-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.15)',
          fontSize: '11px',
          color: 'var(--wa-text-muted)'
        }}>
          <span>Los cambios se guardan directamente en el servidor.</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              backgroundColor: 'var(--wa-surface-subtle)',
              border: '1px solid var(--wa-border-subtle)',
              color: 'var(--wa-text-primary)',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle-hover)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--wa-surface-subtle)'}
          >
            Cerrar
          </button>
        </div>

      </div>

    </div>
  );
}
