import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import gsap from 'gsap';

useGLTF.preload('/models/ABeautifulGame.glb');

const getPieceNode = (type, isWhite, nodes) => {
  switch(type.toLowerCase()) {
    case 'p': return isWhite ? nodes.Pawn_Body_W1 : nodes.Pawn_Body_B1;
    case 'r': return isWhite ? nodes.Castle_W1 : nodes.Castle_B1;
    case 'n': return isWhite ? nodes.Knight_W1 : nodes.Knight_B1;
    case 'b': return isWhite ? nodes.Bishop_W1 : nodes.Bishop_B1;
    case 'q': return isWhite ? nodes.Queen_W : nodes.Queen_B;
    case 'k': return isWhite ? nodes.King_W : nodes.King_B;
    default: return nodes.Pawn_Body_W1;
  }
};

const Piece = ({ type, color, position }) => {
  const groupRef = useRef();
  const isWhite = color === 'w';
  const lastPos = useRef(position);

  const { nodes } = useGLTF('/models/ABeautifulGame.glb');
  
  const copiedScene = useMemo(() => {
    const originalNode = getPieceNode(type, isWhite, nodes);
    const s = originalNode.clone();
    
    // 1. Reset position because the original GLB has them spread out on a board
    s.position.set(0, 0, 0);

    // 2. The exact mathematical scale factor from the Khronos model to our 8x8 board is 16
    // (Original squares are 0.0625 units, our squares are 1.0 units. 1.0 / 0.0625 = 16)
    s.scale.set(16, 16, 16);

    // 3. The origin of the pieces in the GLTF is exactly at their base center. 
    // We don't need any complex bounding box math that might shift asymmetrical pieces!

    return s;
  }, [nodes, type, isWhite]);

  useEffect(() => {
    copiedScene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        // Disable raycasting so the pieces don't block clicks to the squares
        node.raycast = () => null;
      }
    });
  }, [copiedScene]);

  useEffect(() => {
    if (groupRef.current) {
      if (position[0] !== lastPos.current[0] || position[2] !== lastPos.current[2]) {
        const tl = gsap.timeline();
        tl.to(groupRef.current.position, {
          y: 1.5,
          duration: 0.2,
          ease: "power2.out"
        })
        .to(groupRef.current.position, {
          x: position[0],
          z: position[2],
          duration: 0.5,
          ease: "power2.inOut"
        })
        .to(groupRef.current.position, {
          y: 0, 
          duration: 0.2,
          ease: "bounce.out"
        });

        lastPos.current = position;
      } else {
        groupRef.current.position.set(position[0], 0, position[2]);
      }
    }
  }, [position]);
  const pieceRotation = useMemo(() => {
    if (type.toLowerCase() === 'n') {
      return [0, Math.PI, 0];
    }
    return [0, isWhite ? 0 : Math.PI, 0];
  }, [type, isWhite]);

  return (
    <group ref={groupRef}>
      <group rotation={pieceRotation}>
        <primitive object={copiedScene} />
      </group>
    </group>
  );
};

export default Piece;
