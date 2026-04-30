import React, { useState } from 'react';

const JoinScreen = ({ onJoin }) => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('default-room');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onJoin(username.trim(), roomId.trim() || 'default-room');
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a1a1a',
      zIndex: 100,
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: '#2a2a2a',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        width: '300px',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: '0 0 20px 0', fontSize: '24px' }}>3D Live Chess</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', textAlign: 'left', marginBottom: '5px', fontSize: '14px' }}>Player Name</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              style={{
                width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #444', 
                background: '#111', color: 'white', boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', textAlign: 'left', marginBottom: '5px', fontSize: '14px' }}>Room ID</label>
            <input 
              type="text" 
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Room ID"
              style={{
                width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #444', 
                background: '#111', color: 'white', boxSizing: 'border-box'
              }}
            />
          </div>
          <button type="submit" style={{
            marginTop: '10px',
            padding: '12px',
            background: '#4a90e2',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}>
            Join Game
          </button>
        </form>
      </div>
    </div>
  );
};

export default JoinScreen;
