import { useState, useMemo } from 'react';
import Board from './Board';
import Piece from './Piece';

const Scene = ({ chessGame }) => {
  const { game, makeMove, fen, lastMove, gameStatus } = chessGame;
  const [selectedSquare, setSelectedSquare] = useState(null);

  const activePieces = useMemo(() => {
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

    return currentPieces.map((piece) => ({
      ...piece,
      id: `${piece.color}-${piece.type}-${piece.currentSquare}`,
      fenVersion: fen
    }));
  }, [fen, game]);

  const validMoves = useMemo(() => {
    if (!selectedSquare || gameStatus !== 'playing') return [];
    return game.moves({ square: selectedSquare, verbose: true }).map(m => m.to);
  }, [selectedSquare, game, gameStatus]);

  const handleSquareClick = (square) => {
    if (gameStatus !== 'playing') return;

    if (selectedSquare === square) {
      setSelectedSquare(null);
    } else if (selectedSquare && validMoves.includes(square)) {
      makeMove(selectedSquare, square);
      setSelectedSquare(null);
    } else {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
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
        lastMove={lastMove}
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
