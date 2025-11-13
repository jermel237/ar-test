import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

// === MAIN COMPONENT ===
const ARPage3 = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [highlightNode, setHighlightNode] = useState(null);
  const [operationInfo, setOperationInfo] = useState("Welcome to BST Visualization!");

  // === BST Operations ===
  const insertNode = (value) => {
    if (nodes.some((n) => n.id === value)) {
      setOperationInfo(`Node ${value} already exists.`);
      return;
    }

    let newNodes = [...nodes];
    let newEdges = [...edges];
    let parent = null;
    let pos = new THREE.Vector3(0, 0, 0);

    if (newNodes.length > 0) {
      parent = newNodes[0];
      let queue = [parent];
      while (queue.length > 0) {
        let current = queue.shift();
        if (value < current.id && !edges.some((e) => e[0] === current.id && e[1] === current.left)) {
          pos = current.pos.clone().add(new THREE.Vector3(-2, -1.5, 0));
          newEdges.push([current.id, value]);
          break;
        } else if (value > current.id && !edges.some((e) => e[0] === current.id && e[1] === current.right)) {
          pos = current.pos.clone().add(new THREE.Vector3(2, -1.5, 0));
          newEdges.push([current.id, value]);
          break;
        }
        queue.push(...newNodes.filter((n) => edges.some((e) => e[0] === current.id && e[1] === n.id)));
      }
    }

    newNodes.push({ id: value, pos });
    setNodes(newNodes);
    setEdges(newEdges);
    setOperationInfo(`Inserted node ${value}.`);
  };

  const deleteNode = (value) => {
    if (!nodes.some((n) => n.id === value)) {
      setOperationInfo(`Node ${value} not found.`);
      return;
    }
    setNodes(nodes.filter((n) => n.id !== value));
    setEdges(edges.filter(([a, b]) => a !== value && b !== value));
    setOperationInfo(`Deleted node ${value}.`);
  };

  const searchNode = (value) => {
    if (!nodes.some((n) => n.id === value)) {
      setOperationInfo(`Node ${value} not found.`);
      setHighlightNode(null);
      return;
    }
    setHighlightNode(value);
    setOperationInfo(`Found node ${value}!`);
    setTimeout(() => setHighlightNode(null), 1500);
  };

  return (
    <div style={{ height: "100vh", width: "100%", background: "#0f172a" }}>
      {/* Control Panel */}
      <OperationsPanel
        onInsert={() => insertNode(Math.floor(Math.random() * 100))}
        onDelete={() => deleteNode(nodes.length ? nodes[nodes.length - 1].id : 0)}
        onSearch={() =>
          searchNode(nodes.length ? nodes[Math.floor(Math.random() * nodes.length)].id : 0)
        }
      />

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 4, 12], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 10, 5]} />
        <BSTVisualization nodes={nodes} edges={edges} highlightNode={highlightNode} />
        <OrbitControls enableZoom={true} />
      </Canvas>

      {/* Operation Info */}
      <OperationInfo text={operationInfo} />
    </div>
  );
};

// === PANEL BUTTONS ===
const OperationsPanel = ({ onInsert, onDelete, onSearch }) => (
  <div
    style={{
      position: "absolute",
      top: "10%",
      left: "2%",
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
      zIndex: 10,
    }}
  >
    <button style={btnStyle} onClick={onInsert}>
      ➕ Insert
    </button>
    <button style={btnStyle} onClick={onDelete}>
      ❌ Delete
    </button>
    <button style={btnStyle} onClick={onSearch}>
      🔍 Search
    </button>
  </div>
);

const btnStyle = {
  background: "#1e3a8a",
  color: "white",
  border: "none",
  padding: "14px 22px",
  fontSize: "16px",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "0.3s",
};
btnStyle[":hover"] = {
  background: "#2563eb",
};

// === TREE VISUALIZATION ===
const BSTVisualization = ({ nodes, edges, highlightNode }) => (
  <group>
    {edges.map(([a, b], i) => {
      const start = nodes.find((n) => n.id === a).pos;
      const end = nodes.find((n) => n.id === b).pos;
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

const TreeNode = ({ position, label, isHighlighted }) => {
  const color = isHighlighted ? "#f87171" : "#60a5fa";
  const meshRef = useRef();

  useFrame(() => {
    if (isHighlighted && meshRef.current) {
      meshRef.current.scale.setScalar(1 + 0.1 * Math.sin(Date.now() * 0.01));
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(1);
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[0, 0.9, 0]}
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

// === CONNECTION LINES ===
const Connection = ({ start, end }) => {
  const ref = useRef();
  const points = useMemo(() => [start, end], [start, end]);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [points]);

  return (
    <line ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#e5e7eb" linewidth={2} />
    </line>
  );
};

// === OPERATION INFO ===
const OperationInfo = ({ text }) => (
  <div
    style={{
      position: "absolute",
      bottom: "5%",
      width: "100%",
      textAlign: "center",
      color: "white",
      fontSize: "1.4rem",
      fontWeight: "500",
    }}
  >
    {text}
  </div>
);

export default ARPage3;
