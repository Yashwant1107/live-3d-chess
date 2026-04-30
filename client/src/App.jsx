import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import Scene from './components/ChessBoard/Scene';
import JoinScreen from './components/UI/JoinScreen';
import './App.css';

function App() {
  const [session, setSession] = useState(null);

  const handleJoin = (username, roomId) => {
    setSession({ username, roomId });
  };

  if (!session) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  return (
    <div className="app-container">
      <div className="ui-overlay">
        <h1>3D LIVE CHESS</h1>
        <p>Room: {session.roomId} | Playing as: {session.username}</p>
      </div>
      <Canvas shadows camera={{ position: [0, 5, 8], fov: 45 }}>
        <color attach="background" args={['#1a1a1a']} />
        <ambientLight intensity={0.5} />
        <directionalLight
          castShadow
          position={[5, 10, 5]}
          intensity={1.5}
          shadow-mapSize={[1024, 1024]}
        />
        <Environment preset="city" />
        <Suspense fallback={null}>
          <Scene roomId={session.roomId} username={session.username} />
        </Suspense>
        <OrbitControls 
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.5}
        />
        <ContactShadows position={[0, -0.5, 0]} opacity={0.5} scale={10} blur={2} />
      </Canvas>
    </div>
  );
}

export default App;
