import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';

const Square = ({ position, isDark, onSelect, isSelected, isValidMove, previousMoveType }) => {
  const highlightColor = isSelected
    ? '#ffcc00'
    : previousMoveType === 'from'
      ? '#f5d547'
      : previousMoveType === 'to'
        ? '#42d66b'
        : isValidMove
          ? '#48a7ff'
          : isDark
            ? '#222'
            : '#eee';
  const emissiveColor = isSelected
    ? '#554400'
    : previousMoveType === 'from'
      ? '#5a4500'
      : previousMoveType === 'to'
        ? '#0f4a22'
        : isValidMove
          ? '#10345a'
          : '#000';

  return (
    <mesh 
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <boxGeometry args={[1, 0.1, 1]} />
      <meshStandardMaterial 
        color={highlightColor} 
        transparent
        opacity={isSelected || isValidMove || previousMoveType ? 0.62 : 0.0} 
        roughness={0.4}
        metalness={0.1}
        emissive={emissiveColor}
        emissiveIntensity={0.5}
      />
    </mesh>
  );
};

const Board = ({ onSquareClick, selectedSquare, validMoves = [], lastMove }) => {
  const { nodes } = useGLTF('/models/ABeautifulGame.glb');
  
  const boardNode = useMemo(() => {
    if (!nodes.Chessboard) return null;
    const s = nodes.Chessboard.clone();
    
    // The exact mathematical scale factor from the Khronos model to our 8x8 board is 16
    s.scale.set(16, 16, 16);
    
    // The original pieces rest at roughly Y=0.016 in the unscaled model.
    // 0.016 * 16 = 0.256. 
    // By shifting the board down by 0.256, the top surface of the board 
    // perfectly aligns with Y=0, which is where our pieces sit.
    s.position.set(0, -0.256, 0); 

    s.traverse((node) => {
      if (node.isMesh) {
        node.receiveShadow = true;
        node.raycast = () => null; // Disable raycast on the visual board
      }
    });

    return s;
  }, [nodes]);

  const squares = [];
  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const isDark = (i + j) % 2 === 1;
      const squareName = `${String.fromCharCode(97 + j)}${8 - i}`;
      const isSelected = selectedSquare === squareName;
      const isValidMove = validMoves.includes(squareName);
      const previousMoveType = lastMove?.from === squareName
        ? 'from'
        : lastMove?.to === squareName
          ? 'to'
          : null;

      squares.push(
        <Square
          key={squareName}
          // Y is slightly above 0 to prevent z-fighting with the visual board
          position={[j - 3.5, 0.05, i - 3.5]}
          isDark={isDark}
          isSelected={isSelected}
          isValidMove={isValidMove}
          previousMoveType={previousMoveType}
          onSelect={() => onSquareClick(squareName)}
        />
      );
    }
  }

  return (
    <group>
      {/* Interactive Overlay */}
      {squares}
      
      {/* Visual Beautiful Board */}
      {boardNode && <primitive object={boardNode} />}
    </group>
  );
};

export default Board;
