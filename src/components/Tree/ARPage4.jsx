import React, { useState, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage4 = () => {
  const [nodes, setNodes] = useState([
    { id: 50, pos: [0, 3, 0] },
  ]);
  const [edges, setEdges] = useState([]);
  const [selectedOp, setSelectedOp] = useState(null);
  const [highlightNode, setHighlightNode] = useState(null);

  // === Handle Operation Selection ===
  const handleOperation = (op) => {
    setSelectedOp(op);
    setHighlightNode(null);

    if (op === "Insert") {
      const value = Math.floor(Math.random() * 100);
      insertBSTNode(value);
    } else if (op === "Search") {
      if (nodes.length === 0) return;
      const target = nodes[Math.floor(Math.random() * nodes.length)].id;
      visualizeSearch(target);
    } else if (op === "Delete") {
      if (nodes.length === 0) return;
      const target = nodes[nodes.length - 1].id;
      deleteBSTNode(target);
    }
  };

  // === BST Insertion (follows the rules down the tree) ===
  const insertBSTNode = (value) => {
    let newNodes = [...nodes];
    let newEdges = [...edges];

    if (newNodes.some((n) => n.id === value)) return;

    if (newNodes.length === 0) {
      newNodes.push({ id: value, pos: [0, 3, 0] });
      setNodes(newNodes);
      return;
    }

    let parentId = newNodes[0].id;
    let currentPos = [0, 3, 0];
    let depth = 0;
    let xOffset = 3;

    while (true) {
      const parent = newNodes.find((n) => n.id === parentId);
      const parentPos = parent.pos;

      if (value < parentId) {
        // Find left child
        const leftEdge = newEdges.find(([a, b]) => a === parentId && b < parentId);
        if (!leftEdge) {
          const newPos = [parentPos[0] - xOffset, parentPos[1] - 1.5, 0];
          newNodes.push({ id: value, pos: newPos });
          newEdges.push([parentId, value]);
          break;
        } else parentId = leftEdge[1];
      } else {
        // Find right child
        const rightEdge = newEdges.find(([a, b]) => a === parentId && b > parentId);
        if (!rightEdge) {
          const newPos = [parentPos[0] + xOffset, parentPos[1] - 1.5, 0];
          newNodes.push({ id: value, pos: newPos });
          newEdges.push([parentId, value]);
          break;
        } else parentId = rightEdge[1];
      }
      depth++;
      xOffset *= 0.7; // reduce horizontal spacing per level
    }

    setNodes(newNodes);
    setEdges(newEdges);
  };

  // === Search Visualization ===
  const visualizeSearch = (target) => {
    let sequence = [];
    let currentId = nodes[0].id;

    while (currentId !== undefined) {
      sequence.push(currentId);
      if (currentId === target) break;
      currentId = target < currentId
        ? edges.find(([a, b]) => a === currentId && b < a)?.[1]
        : edges.find(([a, b]) => a === currentId && b > a)?.[1];
      if (!currentId) break;
    }

    let i = 0;
    const interval = setInterval(() => {
      setHighlightNode(sequence[i]);
      i++;
      if (i >= sequence.length) clearInterval(interval);
    }, 800);
  };

  // === Delete Operation (simple remove) ===
  const deleteBSTNode = (value) => {
    setNodes(nodes.filter((n) => n.id !== value));
    setEdges(edges.filter(([a, b]) => a !== value && b !== value));
  };

  return (
    <div className="w-full h-[400px] relative">
      <Canvas camera={{ position: [0, 4, 10], fov: 50 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 10, 5]} intensity={1} />

        {/* Title */}
        <FadeInText
          show={true}
          text={"Binary Search Tree (Interactive)"}
          position={[0, 5, 0]}
          fontSize={0.7}
          color="white"
        />
        <FadeInText
          show={true}
          text={"Left < Root < Right — Insert follows tree depth dynamically"}
          position={[0, -1.5, 0]}
          fontSize={0.35}
          color="#fde68a"
        />

        {/* Tree Visualization */}
        <BSTVisualization
          nodes={nodes}
          edges={edges}
          highlightNode={highlightNode}
        />

        {/* Operations Panel */}
        <OperationsPanel position={[-6, 1, 0]} onOperation={handleOperation} />

        {/* Info Panel */}
        {selectedOp && (
          <OperationInfo operation={selectedOp} position={[8, 2, 0]} />
        )}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// === Operations Panel ===
const OperationsPanel = ({ position, onOperation }) => {
  const [activeButton, setActiveButton] = useState(null);

  const handleClick = (e, action) => {
    e.stopPropagation();
    setActiveButton(action);
    onOperation(action);
    setTimeout(() => setActiveButton(null), 250);
  };

  const renderButton = (label, action, y) => {
    const isActive = activeButton === action;
    const color = isActive ? "#22c55e" : "#38bdf8";
    return (
      <group position={[0, y, 0]}>
        <mesh onClick={(e) => handleClick(e, action)}>
          <boxGeometry args={[2.5, 0.6, 0.1]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <Text
          fontSize={0.35}
          color="white"
          position={[0, 0, 0.06]}
          anchorX="center"
          anchorY="middle"
          onClick={(e) => handleClick(e, action)}
        >
          {label}
        </Text>
      </group>
    );
  };

  return (
    <group position={position}>
      <FadeInText
        show={true}
        text={"BST Operations:"}
        position={[0, 2, 0]}
        fontSize={0.35}
        color="#fde68a"
      />
      {renderButton("🔍 Search", "Search", 1.2)}
      {renderButton("➕ Insert", "Insert", 0.4)}
      {renderButton("❌ Delete", "Delete", -0.4)}
    </group>
  );
};

// === BST Visualization ===
const BSTVisualization = ({ nodes, edges, highlightNode }) => (
  <group>
    {edges.map(([a, b], i) => {
      const start = nodes.find((n) => n.id === a)?.pos;
      const end = nodes.find((n) => n.id === b)?.pos;
      if (!start || !end) return null;
      return <Connection key={i} start={start} end={end} />;
    })}
    {nodes.map((node) => (
      <TreeNode
        key={node.id}
        position={node.pos}
        label={node.id}
        isHighlighted={highlightNode === node.id}
      />
    ))}
  </group>
);

// === Node Component ===
const TreeNode = ({ position, label, isHighlighted }) => {
  const color = isHighlighted ? "#f87171" : "#60a5fa";
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[0, 0.8, 0]}
        fontSize={0.35}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
};

// === Connection Line ===
const Connection = ({ start, end }) => {
  const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return (
    <line>
      <primitive object={geometry} />
      <lineBasicMaterial color="#94a3b8" linewidth={2} />
    </line>
  );
};

// === Info Panel ===
const OperationInfo = ({ operation, position }) => {
  let details = "";
  if (operation === "Search")
    details = "Search: Start from root, go left or right based on value.";
  else if (operation === "Insert")
    details = "Insert: Move down comparing values until an empty spot is found.";
  else if (operation === "Delete")
    details = "Delete: Remove node (simplified version).";

  const text = `🔹 Operation: ${operation}\n${details}`;

  return (
    <FadeInText
      show={true}
      text={text}
      position={position}
      fontSize={0.33}
      color="#a5f3fc"
    />
  );
};

// === Fade-in Text ===
const FadeInText = ({ show, text, position, fontSize, color }) => {
  const ref = useRef();
  const opacity = useRef(0);
  const scale = useRef(0.6);

  useFrame(() => {
    if (show) {
      opacity.current = Math.min(opacity.current + 0.05, 1);
      scale.current = Math.min(scale.current + 0.05, 1);
    } else {
      opacity.current = Math.max(opacity.current - 0.05, 0);
      scale.current = 0.6;
    }
    if (ref.current && ref.current.material) {
      ref.current.material.opacity = opacity.current;
      ref.current.scale.set(scale.current, scale.current, scale.current);
    }
  });

  return (
    <Text
      ref={ref}
      position={position}
      fontSize={fontSize}
      color={color}
      anchorX="center"
      anchorY="middle"
      material-transparent
      maxWidth={9}
      textAlign="left"
    >
      {text}
    </Text>
  );
};

export default ARPage4;
