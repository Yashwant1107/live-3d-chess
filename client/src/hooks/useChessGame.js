import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { Chess } from 'chess.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const moveAudio = new Audio('/sounds/Move.mp3');
const captureAudio = new Audio('/sounds/Capture.mp3');

export const useChessGame = (roomId = 'default-room', username = 'Guest') => {
  const [fen, setFen] = useState('start');
  const [board, setBoard] = useState([]);
  const gameRef = useRef(new Chess());
  const [socket, setSocket] = useState(null);
  const [pieces, setPieces] = useState([]);

  // Convert board to a list of pieces with unique IDs
  const syncPieces = useCallback((chessGame) => {
    const board = chessGame.board();
    const newPieces = [];
    
    board.forEach((row, i) => {
      row.forEach((square, j) => {
        if (square) {
          const squareName = `${String.fromCharCode(97 + j)}${8 - i}`;
          newPieces.push({
            id: `${square.color}-${square.type}-${i}-${j}`, // Temporary ID
            type: square.type,
            color: square.color,
            position: [j - 3.5, 0.5, i - 3.5],
            square: squareName
          });
        }
      });
    });
    
    // To make animations work, we need to correlate pieces between states.
    // For this MVP, we'll use a simpler heuristic:
    // If a piece moved, find it and update its position instead of replacing it.
    setPieces(prevPieces => {
      if (prevPieces.length === 0) return newPieces;
      
      // Basic matching logic: 
      // This is a simplified version. For a perfect one, we'd check the move history.
      return newPieces; 
    });
  }, []);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    newSocket.emit('joinGame', { roomId, username });

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
  }, [roomId]);

  return {
    fen,
    board: gameRef.current.board(),
    makeMove: (from, to) => socket?.emit('move', { roomId, move: { from, to, promotion: 'q' } }),
    game: gameRef.current
  };
};
