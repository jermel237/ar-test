import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const ARPage4 = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [highlightNode, setHighlightNode] = useState(null);
  const [operationInfo, setOperationInfo] = useState("Tap a button to begin!");

  const insertNode = (value) => {
    if (nodes.find((n) => n.id === value)) {
      setOperationInfo(`Node ${value} already exists.`);
      return;
    }
    const newNode = { id: value, pos: [Math.random() * 6 - 3, 0, 0] };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    if (newNodes.length > 1) {
      const parent = newNodes[Math.floor(Math.random() * (newNodes.length - 1))];
      setEdges([...edges, [parent.id, value]]);
    }
    setOperationInfo(`Inserted node ${value}.`);
  };

  const deleteNode = (value) => {
    if (!nodes.find((n) => n.id === value)) {
      setOperationInfo(`Node ${value} not found.`);
      return;
    }
    setNodes(nodes.filter((n) => n.id !== value));
    setEdges(edges.filter(([a, b]) => a !== value && b !== value));
    setOperationInfo(`Deleted node ${value}.`);
  };

  const searchNode = (value) => {
    if (!nodes.find((n) => n.id === value)) {
      setOperationInfo(`Node ${value} not found.`);
      setHighlightNode(null);
      return;
    }
    setHighlightNode(value);
    setOperationInfo(`Found node ${value}.`);
    setTimeout(() => setHighlightNode(null), 1000);
  };

  // --- Start AR Session if available ---
  const startAR = (gl) => {
    if (navigator.xr && navigator.xr.isSessionSupported) {
      navigator.xr
        .isSessionSupported("immersive-ar")
        .then((supported) => {
          if (supported)
            return navigator.xr.requestSession("immersive-ar", {
              requiredFeatures: ["hit-test", "local-floor"],
            });
          return null;
        })
        .then((session) => {
          if (session) gl.xr.setSession(session);
        })
        .catch((err) => console.warn("AR start failed:", err));
    }
  };

  return (
    <div className="w-full h-[500px]">
      <Canvas
        camera={{ position: [0, 4, 12], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <OrbitControls />

        {/* 3D Buttons (moved closer to camera) */}
        <group position={[-4, 3, -3]}>
          <ARButton3D
            label="➕ Insert"
            color="#22c55e"
            position={[0, 0, 0]}
            onPress={() =>
              insertNode(Math.floor(Math.random() * 90 + 10).toString())
            }
          />
          <ARButton3D
            label="❌ Delete"
            color="#ef4444"
            position={[0, -1.4, 0]}
            onPress={() => {
              if (nodes.length > 0) deleteNode(nodes[nodes.length - 1].id);
            }}
          />
          <ARButton3D
            label="🔍 Search"
            color="#3b82f6"
            position={[0, -2.8, 0]}
            onPress={() => {
              if (nodes.length > 0) {
                const random =
                  nodes[Math.floor(Math.random() * nodes.length)].id;
                searchNode(random);
              }
            }}
          />
        </group>

        {/* BST Visualization */}
        <group position={[0, -1, -8]}>
          <FadeText
            text="Binary Search Tree Visualization"
            position={[0, 5, 0]}
            fontSize={0.6}
            color="#facc15"
          />
          <BSTVisualization
            nodes={nodes}
            edges={edges}
            highlightNode={highlightNode}
          />
        </group>

        {/* Info text */}
        <group position={[0, -4, -6]}>
          <FadeText
            text={operationInfo}
            fontSize={0.35}
            color="#e5e7eb"
            position={[0, 0, 0]}
          />
        </group>
      </Canvas>
    </div>
  );
};

/* === 3D Button Component (Interactable) === */
const ARButton3D = ({ label, color, position, onPress }) => {
  const [hover, setHover] = useState(false);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    onPress?.();
  };

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHover(false);
      }}
      onPointerDown={handlePointerDown}
    >
      <mesh>
        <boxGeometry args={[2.8, 1, 0.25]} />
        <meshStandardMaterial color={hover ? "#fde68a" : color} />
      </mesh>
      <Text
        position={[0, 0, 0.2]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
};

/* === BST + Nodes === */
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

const Connection = ({ start, end }) => {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const dir = endVec.clone().sub(startVec).normalize();
    const length = startVec.distanceTo(endVec);
    ref.current.position.copy(startVec);
    ref.current.setDirection(dir);
    ref.current.setLength(length, 0.15, 0.1);
  });
  return (
    <arrowHelper
      ref={ref}
      args={[new THREE.Vector3(), new THREE.Vector3(), 0, "white"]}
    />
  );
};

/* === Smooth Text Fade === */
const FadeText = ({ text, position = [0, 0, 0], fontSize = 0.5, color }) => {
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    let frame;
    let start;
    const duration = 1000;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setOpacity(progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <Text
      position={position}
      fontSize={fontSize}
      color={color}
      fillOpacity={opacity}
      anchorX="center"
      anchorY="middle"
      maxWidth={10}
      textAlign="center"
    >
      {text}
    </Text>
  );
};

export default ARPage4;
