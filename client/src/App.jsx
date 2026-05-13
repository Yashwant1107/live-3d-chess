import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import Scene from './components/ChessBoard/Scene';
import JoinScreen from './components/UI/JoinScreen';
import { useChessGame } from './hooks/useChessGame';
import './App.css';

const pieceSymbols = {
  white: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  black: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const pieceOrder = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };

const formatTime = (seconds = 0) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
};

const formatColor = (color = '') => color.charAt(0).toUpperCase() + color.slice(1);

const CapturedPieces = ({ title, pieces = [], advantage }) => {
  const sortedPieces = [...pieces].sort((a, b) => pieceOrder[a.type] - pieceOrder[b.type]);

  return (
    <section className="hud-panel captured-panel">
      <h2>{title}</h2>
      <div className="captured-list" aria-label={title}>
        {sortedPieces.length > 0
          ? sortedPieces.map((piece, index) => (
            <span key={`${piece.color}-${piece.type}-${index}`} className="captured-piece">
              {pieceSymbols[piece.color]?.[piece.type] || piece.name}
            </span>
          ))
          : <span className="empty-state">None</span>}
      </div>
      <p className="material-score">{advantage > 0 ? `+${advantage}` : 'Even'}</p>
    </section>
  );
};

const GameHud = ({ chessGame, onMainMenu }) => {
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const {
    lastMove,
    capturedPieces,
    timers,
    currentTurn,
    gameStatus,
    winner,
    winReason,
    drawOffer,
    playerColor,
    history,
    undoMove,
    offerDraw,
    respondDraw,
    resign,
    restartGame,
    connectionStatus,
    lastError
  } = chessGame;

  const whiteMaterial = capturedPieces.white.reduce((total, piece) => total + (pieceValues[piece.type] || 0), 0);
  const blackMaterial = capturedPieces.black.reduce((total, piece) => total + (pieceValues[piece.type] || 0), 0);
  const gameEnded = gameStatus === 'ended' || gameStatus === 'draw';
  const drawOfferedByOpponent = drawOffer && drawOffer !== playerColor;

  return (
    <>
      <div className="top-status">
        <div>
          <span className="status-label">Turn</span>
          <strong>{formatColor(currentTurn)}</strong>
        </div>
        <div>
          <span className="status-label">Last Move</span>
          <strong>
            {lastMove
              ? `${formatColor(lastMove.color)} ${lastMove.piece}: ${lastMove.from} → ${lastMove.to}`
              : 'No moves yet'}
          </strong>
        </div>
        <div>
          <span className="status-label">Connection</span>
          <strong>{connectionStatus}</strong>
        </div>
      </div>

      <aside className="side-panel left-panel">
        <CapturedPieces
          title="Captured by White"
          pieces={capturedPieces.white}
          advantage={Math.max(0, whiteMaterial - blackMaterial)}
        />
      </aside>

      <aside className="side-panel right-panel">
        <CapturedPieces
          title="Captured by Black"
          pieces={capturedPieces.black}
          advantage={Math.max(0, blackMaterial - whiteMaterial)}
        />

        <section className="hud-panel timer-panel">
          <h2>Timer</h2>
          <div className={currentTurn === 'white' ? 'timer-row active' : 'timer-row'}>
            <span>White</span>
            <strong>{formatTime(timers.white)}</strong>
          </div>
          <div className={currentTurn === 'black' ? 'timer-row active' : 'timer-row'}>
            <span>Black</span>
            <strong>{formatTime(timers.black)}</strong>
          </div>
        </section>

        <section className="hud-panel last-move-panel">
          <h2>Last Move</h2>
          <p>{lastMove ? `${formatColor(lastMove.color)} ${lastMove.piece}: ${lastMove.from} → ${lastMove.to}` : 'Waiting for first move'}</p>
        </section>
      </aside>

      <div className="bottom-controls">
        <button type="button" onClick={undoMove} disabled={gameEnded || history.length === 0}>Undo Move</button>
        <button type="button" onClick={offerDraw} disabled={gameEnded || Boolean(drawOffer)}>Offer Draw</button>
        <button type="button" onClick={() => setShowResignConfirm(true)} disabled={gameEnded}>Resign</button>
        <button type="button" onClick={restartGame}>Restart Game</button>
      </div>

      {drawOfferedByOpponent && (
        <div className="modal-backdrop">
          <div className="game-modal">
            <h2>Draw Offered</h2>
            <p>{formatColor(drawOffer)} offered a draw.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => respondDraw(true)}>Accept Draw</button>
              <button type="button" onClick={() => respondDraw(false)}>Reject Draw</button>
            </div>
          </div>
        </div>
      )}

      {drawOffer && drawOffer === playerColor && (
        <div className="draw-pending">Draw offer sent</div>
      )}

      {showResignConfirm && (
        <div className="modal-backdrop">
          <div className="game-modal">
            <h2>Resign Game?</h2>
            <p>Are you sure you want to resign?</p>
            <div className="modal-actions">
              <button type="button" onClick={() => {
                resign();
                setShowResignConfirm(false);
              }}>Confirm</button>
              <button type="button" onClick={() => setShowResignConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {gameEnded && (
        <div className="modal-backdrop">
          <div className="game-modal end-game-modal">
            <h2>{winner ? `${formatColor(winner)} Wins` : 'Game Drawn'}</h2>
            <p>Reason: {winReason || 'Agreement'}</p>
            <div className="modal-actions">
              <button type="button" onClick={restartGame}>Restart Game</button>
              <button type="button" onClick={onMainMenu}>Main Menu</button>
            </div>
          </div>
        </div>
      )}

      {lastError && <div className="error-toast">{lastError}</div>}
    </>
  );
};

const GameView = ({ session, onMainMenu }) => {
  const chessGame = useChessGame(session.roomId, session.username);

  return (
    <div className="app-container">
      <div className="ui-overlay">
        <h1>3D LIVE CHESS</h1>
        <p>Room: {session.roomId} | Playing as: {session.username}</p>
      </div>
      <GameHud chessGame={chessGame} onMainMenu={onMainMenu} />
      <Canvas shadows camera={{ position: [0, 5, 8], fov: 45 }}>
        <color attach="background" args={['#171717']} />
        <ambientLight intensity={0.5} />
        <directionalLight
          castShadow
          position={[5, 10, 5]}
          intensity={1.5}
          shadow-mapSize={[1024, 1024]}
        />
        <Environment preset="city" />
        <Suspense fallback={null}>
          <Scene chessGame={chessGame} />
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
};

function App() {
  const [session, setSession] = useState(null);

  const handleJoin = (username, roomId) => {
    setSession({ username, roomId });
  };

  if (!session) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  return <GameView session={session} onMainMenu={() => setSession(null)} />;
}

export default App;
