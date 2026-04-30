import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { Chess } from 'chess.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const moveAudio = new Audio('/sounds/Move.mp3');
const captureAudio = new Audio('/sounds/Capture.mp3');

export const useChessGame = (roomId = 'default-room', username = 'Guest') => {
  const [fen, setFen] = useState('start');
  const gameRef = useRef(new Chess());
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastError, setLastError] = useState('');

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });
    setSocket(newSocket);

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

    newSocket.on('gameState', ({ fen }) => {
      gameRef.current.load(fen);
      setFen(fen);
    });

    newSocket.on('move', ({ fen, move }) => {
      gameRef.current.load(fen);
      setFen(fen);
      
      // Play appropriate sound effect
      if (move && move.captured) {
        captureAudio.currentTime = 0;
        captureAudio.play().catch(e => console.log('Audio play failed:', e));
      } else {
        moveAudio.currentTime = 0;
        moveAudio.play().catch(e => console.log('Audio play failed:', e));
      }
    });

    return () => newSocket.close();
  }, [roomId, username]);

  return {
    fen,
    board: gameRef.current.board(),
    makeMove: (from, to) => socket?.emit('move', { roomId, move: { from, to, promotion: 'q' } }),
    game: gameRef.current,
    connectionStatus,
    lastError,
    socketUrl: SOCKET_URL
  };
};
