import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { Chess } from 'chess.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
const moveAudio = new Audio('/sounds/Move.mp3');
const captureAudio = new Audio('/sounds/Capture.mp3');
const STARTING_TIME_SECONDS = 60 * 60;

const initialRoomState = {
  history: [],
  lastMove: null,
  capturedPieces: { white: [], black: [] },
  currentTurn: 'white',
  timers: { white: STARTING_TIME_SECONDS, black: STARTING_TIME_SECONDS },
  gameStatus: 'playing',
  winner: null,
  winReason: null,
  drawOffer: null,
  playerColor: 'spectator'
};

export const useChessGame = (roomId = 'default-room', username = 'Guest') => {
  const [fen, setFen] = useState('start');
  const [game] = useState(() => new Chess());
  const socketRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastError, setLastError] = useState('');
  const [roomState, setRoomState] = useState(initialRoomState);
  const lastTimerSyncRef = useRef(null);

  const syncGameState = useCallback((state) => {
    if (state.fen) {
      game.load(state.fen);
      setFen(state.fen);
    }

    lastTimerSyncRef.current = Date.now();
    setRoomState((prev) => ({
      ...prev,
      ...state,
      timers: state.timers || prev.timers,
      capturedPieces: state.capturedPieces || prev.capturedPieces,
      history: state.history || prev.history
    }));
  }, [game]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id, '->', SOCKET_URL);
      setConnectionStatus('connected');
      setLastError('');
      newSocket.emit('joinGame', { roomId, username });
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setConnectionStatus('error');
      setLastError(error.message);
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      setConnectionStatus('disconnected');
    });

    newSocket.on('gameState', syncGameState);

    newSocket.on('move', (state) => {
      syncGameState(state);
      
      // Play appropriate sound effect
      if (state.move && state.move.captured) {
        captureAudio.currentTime = 0;
        captureAudio.play().catch(e => console.log('Audio play failed:', e));
      } else {
        moveAudio.currentTime = 0;
        moveAudio.play().catch(e => console.log('Audio play failed:', e));
      }
    });

    const keepAliveTimer = window.setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('keepAlive', { roomId });
      }
    }, 30000);

    return () => {
      window.clearInterval(keepAliveTimer);
      socketRef.current = null;
      newSocket.close();
    };
  }, [roomId, username, syncGameState]);

  useEffect(() => {
    if (roomState.gameStatus !== 'playing') return undefined;

    const timer = window.setInterval(() => {
      setRoomState((prev) => {
        if (prev.gameStatus !== 'playing') return prev;

        const now = Date.now();
        if (!lastTimerSyncRef.current) {
          lastTimerSyncRef.current = now;
          return prev;
        }
        const elapsed = Math.max(0, Math.floor((now - lastTimerSyncRef.current) / 1000));
        if (elapsed === 0) return prev;
        lastTimerSyncRef.current = now;
        const activeColor = prev.currentTurn;
        const syncedTimers = prev.timers || initialRoomState.timers;
        const nextTimers = {
          ...syncedTimers,
          [activeColor]: Math.max(0, syncedTimers[activeColor] - elapsed)
        };

        if (nextTimers[activeColor] <= 0) {
          return {
            ...prev,
            timers: nextTimers,
            gameStatus: 'ended',
            winner: activeColor === 'white' ? 'black' : 'white',
            winReason: 'Time Out'
          };
        }

        return {
          ...prev,
          timers: nextTimers
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [roomState.gameStatus]);

  const emit = useCallback((event, payload = {}) => {
    socketRef.current?.emit(event, { roomId, ...payload });
  }, [roomId]);

  return {
    fen,
    board: game.board(),
    makeMove: (from, to) => emit('move', { move: { from, to, promotion: 'q' } }),
    undoMove: () => emit('undoMove'),
    offerDraw: () => emit('offerDraw', { color: roomState.playerColor }),
    respondDraw: (accepted) => emit('respondDraw', { accepted }),
    resign: () => emit('resign', { color: roomState.playerColor }),
    restartGame: () => emit('restartGame'),
    game,
    connectionStatus,
    lastError,
    socketUrl: SOCKET_URL,
    ...roomState
  };
};
