import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

// === MAIN AR PAGE ===
const ARPage4 = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [highlightNode, setHighlightNode] = useState(null);
  const [operationInfo, setOperationInfo] = useState("Tap a button to start.");

  // === BST operations ===
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
    setTimeout(() => setHighlightNode(null), 1200);
  };

  return (
    <div className="relative w-full h-[350px]">
      {/* === Buttons === */}
      <div className="absolute top-4 left-4 flex flex-col gap-3 z-10">
        <button
          onClick={() => insertNode(Math.floor(Math.random() * 90 + 10).toString())}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-5 rounded-lg shadow-lg text-lg"
        >
          ➕ Insert
        </button>
        <button
          onClick={() => {
            if (nodes.length > 0) deleteNode(nodes[nodes.length - 1].id);
          }}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-5 rounded-lg shadow-lg text-lg"
        >
          ❌ Delete
        </button>
        <button
          onClick={() => {
            if (nodes.length > 0) {
              const random = nodes[Math.floor(Math.random() * nodes.length)].id;
              searchNode(random);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 rounded-lg shadow-lg text-lg"
        >
          🔍 Search
        </button>
      </div>

      {/* === AR Canvas === */}
      <Canvas
        camera={{ position: [0, 4, 15], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        <group position={[0, -1, -8]}>
          <FadeText
            text="Binary Search Tree Visualization"
            position={[0, 5, 0]}
            fontSize={0.6}
            color="#facc15"
          />

          <BSTVisualization nodes={nodes} edges={edges} highlightNode={highlightNode} />
        </group>
      </Canvas>

      {/* === Info Box === */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900/80 text-white px-4 py-2 rounded-md text-sm text-center w-[80%] shadow-lg">
        {operationInfo}
      </div>
    </div>
  );
};

// === START AR SESSION ===
const startAR = (gl) => {
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then((supported) => {
        if (supported) {
          return navigator.xr.requestSession("immersive-ar", {
            requiredFeatures: ["hit-test", "local-floor"],
          });
        } else return null;
      })
      .then((session) => {
        if (session) gl.xr.setSession(session);
      })
      .catch((err) => console.warn("AR start failed:", err));
  }
};

// === VISUALIZATION COMPONENTS ===
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
      <Text position={[0, 0.8, 0]} fontSize={0.35} color="white" anchorX="center" anchorY="middle">
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
  return <arrowHelper ref={ref} args={[new THREE.Vector3(), new THREE.Vector3(), 0, "white"]} />;
};

const FadeText = ({ text, position = [0, 0, 0], fontSize = 0.5, color = "white" }) => {
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
    >
      {text}
    </Text>
  );
};

export default ARPage4;
