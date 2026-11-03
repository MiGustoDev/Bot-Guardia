import React, { useState, useEffect } from 'react';
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
  ToggleLeft, 
  ToggleRight, 
  Key, 
  Clock, 
  MessageSquare
} from 'lucide-react';

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

  // Flash success message
  const triggerSuccess = (msg) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Toggle active status of a rule
  const handleToggleRule = (index) => {
    const updated = [...rules];
    updated[index].active = !updated[index].active;
    setRules(updated);
  };

  // Update rule reply
  const handleReplyChange = (index, value) => {
    const updated = [...rules];
    updated[index].reply = value;
    setRules(updated);
  };

  // Delete a rule
  const handleDeleteRule = (index) => {
    if (window.confirm('¿Seguro que deseas eliminar esta regla?')) {
      const updated = rules.filter((_, i) => i !== index);
      setRules(updated);
    }
  };

  // Add new rule
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

  // Save all rules to backend
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

  // Save configuration to backend
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
        maxWidth: '780px',
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
              padding: '6px'
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

        {/* Tab Switch */}
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
                gap: '10px'
              }}>
                <p style={{ fontSize: '12px', color: 'var(--wa-text-secondary)' }}>
                  Respuestas automáticas disparadas por palabras clave en los mensajes de las sucursales:
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      backgroundColor: showAddForm ? 'var(--wa-bg-active)' : 'rgba(0, 168, 132, 0.15)',
                      color: 'var(--wa-teal)',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: '1px solid var(--wa-teal)'
                    }}
                  >
                    <Plus size={14} />
                    <span>{showAddForm ? 'Cancelar' : 'Nueva Regla'}</span>
                  </button>

                  <button
                    onClick={handleSaveRules}
                    disabled={savingRules}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--wa-teal)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '700',
                      boxShadow: '0 2px 8px rgba(0, 168, 132, 0.3)'
                    }}
                  >
                    <Save size={14} />
                    <span>{savingRules ? 'Guardando...' : 'Guardar Cambios'}</span>
                  </button>
                </div>
              </div>

              {/* Add Rule Inline Form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddRule}
                  style={{
                    backgroundColor: 'var(--wa-bg-deep)',
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
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Coincidencia
                      </label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
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
                    <textarea
                      placeholder="Escribe la respuesta automática técnica que enviará el bot..."
                      value={newReply}
                      onChange={(e) => setNewReply(e.target.value)}
                      required
                      rows={3}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'transparent',
                        color: 'var(--wa-text-secondary)',
                        fontSize: '12px'
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
                        fontWeight: '700'
                      }}
                    >
                      Añadir Regla a la Lista
                    </button>
                  </div>
                </form>
              )}

              {/* Rules List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id || idx}
                    style={{
                      backgroundColor: 'var(--wa-bg-deep)',
                      border: '1px solid ' + (rule.active ? 'var(--wa-border)' : 'rgba(239, 68, 68, 0.2)'),
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      opacity: rule.active ? 1 : 0.65
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          onClick={() => handleToggleRule(idx)}
                          title={rule.active ? 'Desactivar regla' : 'Activar regla'}
                          style={{
                            background: 'none',
                            color: rule.active ? 'var(--wa-green)' : 'var(--wa-text-muted)',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          {rule.active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(0, 168, 132, 0.15)',
                            color: 'var(--wa-teal)'
                          }}>
                            {rule.type}
                          </span>
                          <strong style={{ fontSize: '14px', color: 'var(--wa-text-primary)' }}>
                            "{rule.trigger}"
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: rule.active ? 'var(--wa-green)' : 'var(--wa-status-danger)', fontWeight: '600' }}>
                          {rule.active ? 'Activa' : 'Pausada'}
                        </span>
                        <button
                          onClick={() => handleDeleteRule(idx)}
                          title="Eliminar regla"
                          style={{
                            background: 'none',
                            color: 'var(--wa-status-danger)',
                            padding: '4px'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Editable response area */}
                    <div>
                      <textarea
                        value={rule.reply}
                        onChange={(e) => handleReplyChange(idx, e.target.value)}
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '12px',
                          backgroundColor: 'var(--wa-bg-panel)',
                          border: '1px solid var(--wa-border-light)',
                          borderRadius: '8px',
                          color: 'var(--wa-text-primary)',
                          resize: 'vertical'
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
                backgroundColor: 'var(--wa-bg-deep)',
                border: '1px solid var(--wa-border)',
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
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, botEnabled: !config.botEnabled })}
                  style={{ background: 'none', color: config.botEnabled ? 'var(--wa-green)' : 'var(--wa-text-muted)' }}
                >
                  {config.botEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </button>
              </div>

              {/* Toggle Only on Mention */}
              <div style={{
                backgroundColor: 'var(--wa-bg-deep)',
                border: '1px solid var(--wa-border)',
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
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, onlyOnMention: !config.onlyOnMention })}
                  style={{ background: 'none', color: config.onlyOnMention ? 'var(--wa-teal)' : 'var(--wa-text-muted)' }}
                >
                  {config.onlyOnMention ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </button>
              </div>

              {/* Gemini AI Settings */}
              <div style={{
                backgroundColor: 'var(--wa-bg-deep)',
                border: '1px solid var(--wa-border)',
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
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, geminiEnabled: !config.geminiEnabled })}
                    style={{ background: 'none', color: config.geminiEnabled ? 'var(--wa-green)' : 'var(--wa-text-muted)' }}
                  >
                    {config.geminiEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
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
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--wa-text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Prompt del Sistema (Comportamiento de la IA)
                      </label>
                      <textarea
                        value={config.geminiPrompt || ''}
                        onChange={(e) => setConfig({ ...config, geminiPrompt: e.target.value })}
                        rows={3}
                        style={{ width: '100%', padding: '8px 12px', fontSize: '12px', resize: 'vertical' }}
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
                    boxShadow: '0 2px 10px rgba(0, 168, 132, 0.3)'
                  }}
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
              backgroundColor: 'var(--wa-bg-panel-hover)',
              color: 'var(--wa-text-primary)',
              fontSize: '12px'
            }}
          >
            Cerrar
          </button>
        </div>

      </div>

    </div>
  );
}
