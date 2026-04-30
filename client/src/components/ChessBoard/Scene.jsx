import React, { useState, useMemo, useEffect, useRef } from 'react';
import Board from './Board';
import Piece from './Piece';
import { useChessGame } from '../../hooks/useChessGame';

const Scene = ({ roomId, username }) => {
  const { board, game, makeMove, fen, connectionStatus, lastError, socketUrl } = useChessGame(roomId, username);
  const [selectedSquare, setSelectedSquare] = useState(null);
  
  // Track pieces with stable keys
  // Key format: color-type-originalSquare
  const [activePieces, setActivePieces] = useState([]);

  useEffect(() => {
    const newBoard = game.board();
    const currentPieces = [];
    
    newBoard.forEach((row, i) => {
      row.forEach((square, j) => {
        if (square) {
          const squareName = `${String.fromCharCode(97 + j)}${8 - i}`;
          currentPieces.push({
            ...square,
            currentSquare: squareName,
            gridPos: [j - 3.5, 0.5, i - 3.5]
          });
        }
      });
    });

    // Simple heuristic: If we don't have pieces yet, initialize them.
    // If we do, try to match them to existing ones to keep keys stable.
    setActivePieces(prev => {
      if (prev.length === 0) {
        return currentPieces.map(p => ({ ...p, id: `${p.color}-${p.type}-${p.currentSquare}` }));
      }

      // Match logic: For every piece in currentPieces, find the best match in prev
      const matched = [];
      const usedPrevIds = new Set();

      currentPieces.forEach(curr => {
        // Find a piece in prev that is the same type/color and was at the same square 
        // OR is the only one of its kind that moved.
        // For now, let's use the square name as a fallback if no move was detected.
        let match = prev.find(p => 
          !usedPrevIds.has(p.id) && 
          p.color === curr.color && 
          p.type === curr.type && 
          p.currentSquare === curr.currentSquare
        );

        if (!match) {
          // If no direct match, it might be the piece that just moved.
          // In a real implementation, we'd check game.history() to see exactly which piece moved.
          // For now, we'll recreate pieces that moved. 
          // To make GSAP work, let's just use a more stable ID system.
          match = { ...curr, id: `${curr.color}-${curr.type}-${curr.currentSquare}-${Math.random()}` };
        } else {
          usedPrevIds.add(match.id);
          match = { ...match, currentSquare: curr.currentSquare, gridPos: curr.gridPos };
        }
        matched.push(match);
      });

      return matched;
    });
  }, [fen, game]);

  const validMoves = useMemo(() => {
    if (!selectedSquare) return [];
    return game.moves({ square: selectedSquare, verbose: true }).map(m => m.to);
  }, [selectedSquare, game]);

  const handleSquareClick = (square) => {
    if (selectedSquare === square) {
      setSelectedSquare(null);
    } else if (selectedSquare && validMoves.includes(square)) {
      makeMove(selectedSquare, square);
      setSelectedSquare(null);
    } else {
      const piece = game.get(square);
      if (piece) {
        setSelectedSquare(square);
      }
    }
  };

  return (
    <>
      <group position={[-3.8, 2.8, -4.2]}>
        {/* Expose socket state in the live scene so deploy issues are visible without devtools */}
      </group>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
      <spotLight position={[-10, 15, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
      
      <Board 
        onSquareClick={handleSquareClick}
        selectedSquare={selectedSquare}
        validMoves={validMoves}
      />
      
      {activePieces.map((piece) => (
        <Piece 
          key={piece.id}
          type={piece.type}
          color={piece.color}
          position={piece.gridPos}
        />
      ))}
    </>
  );
};

export default Scene;
