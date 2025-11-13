import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

/**
 * ARPage3
 * - AR Binary Search Tree visualization
 * - Buttons rendered *inside* AR Canvas as 3D text panels
 * - Works in AR or normal 3D mode
 */
const ARPage4 = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [highlightNode, setHighlightNode] = useState(null);
  const [operationInfo, setOperationInfo] = useState("Tap a 3D button to start!");

  // --- basic BST operations ---
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

  return (
    <div className="w-full h-[400px]">
      <Canvas
        camera={{ position: [0, 4, 15], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* ====== Buttons rendered inside the Canvas ====== */}
        <group position={[-6, 3, -5]}>
          <ARButton
            label="➕ Insert"
            color="#22c55e"
            position={[0, 0, 0]}
            onClick={() =>
              insertNode(Math.floor(Math.random() * 90 + 10).toString())
            }
          />
          <ARButton
            label="❌ Delete"
            color="#ef4444"
            position={[0, -1.5, 0]}
            onClick={() => {
              if (nodes.length > 0) deleteNode(nodes[nodes.length - 1].id);
            }}
          />
          <ARButton
            label="🔍 Search"
            color="#3b82f6"
            position={[0, -3, 0]}
            onClick={() => {
              if (nodes.length > 0) {
                const random =
                  nodes[Math.floor(Math.random() * nodes.length)].id;
                searchNode(random);
              }
            }}
          />
        </group>

        {/* ====== Scene content ====== */}
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

        {/* Floating info text */}
        <group position={[0, -4, -5]}>
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

/* Start AR session if supported */
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

// ====== 3D BUTTON COMPONENT ======
const ARButton = ({ label, color, position, onClick }) => {
  const [hover, setHover] = useState(false);
  return (
    <group
      position={position}
      onClick={onClick}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <mesh>
        <boxGeometry args={[3.2, 1, 0.2]} />
        <meshStandardMaterial color={hover ? "#fef08a" : color} />
      </mesh>
      <Text
        position={[0, 0, 0.15]}
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

// ====== BST visualization components ======
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
