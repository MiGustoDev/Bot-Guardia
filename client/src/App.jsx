import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

function App() {
  const [status, setStatus] = useState('DISCONNECTED');
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    fetch(`${SOCKET_URL}/api/status`)
      .then(res => res.json())
      .then(data => {
        setStatus(data.status);
        setQrCode(data.qr);
      })
      .catch(err => console.error(err));

    const socket = io(SOCKET_URL);

    socket.on('status', (data) => {
      setStatus(data.status);
      setQrCode(data.qr);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleRestart = async () => {
    try {
      await fetch(`${SOCKET_URL}/api/restart`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${SOCKET_URL}/api/logout`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px' }}>
      <h2>Guardia Sistemas - WhatsApp Bot</h2>
      <p><strong>Estado:</strong> {status}</p>

      {status === 'DISCONNECTED' && (
        <div>
          <p>El bot está desconectado.</p>
          <button onClick={handleRestart}>Generar QR</button>
        </div>
      )}

      {status === 'CONNECTING' && (
        <p>Iniciando WhatsApp... Espera unos segundos.</p>
      )}

      {status === 'QR_READY' && qrCode && (
        <div>
          <p>Escaneá este QR con el celular de la guardia:</p>
          <img 
            src={qrCode} 
            alt="Código QR WhatsApp" 
            style={{ width: '250px', height: '250px', display: 'block', border: '1px solid #ccc' }} 
          />
        </div>
      )}

      {status === 'CONNECTED' && (
        <div>
          <p style={{ color: 'green', fontWeight: 'bold' }}>✓ Conectado</p>
          <p>El bot está activo y responderá cuando lo arroben en los grupos.</p>
          <button onClick={handleLogout}>Desconectar / Cambiar celular</button>
        </div>
      )}
    </div>
  );
}

export default App;
