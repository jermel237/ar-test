import React, { useRef, useState, useEffect, useMemo, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage3 = () => {
  const [selectedNode, setSelectedNode] = useState(null);
  const nodeRefs = useRef([]);

  // Helper to collect refs
  const addNodeRef = (ref) => {
    if (ref && !nodeRefs.current.includes(ref)) nodeRefs.current.push(ref);
  };

  // Example nodes for multiple tree types
  const nodes = [
    { id: "A", pos: [0, 3, 0], type: "Binary Search Tree" },
    { id: "B", pos: [-2, 1.5, 0], type: "Binary Search Tree" },
    { id: "C", pos: [2, 1.5, 0], type: "Binary Search Tree" },
    { id: "D", pos: [-3, 0, 0], type: "Binary Tree" },
    { id: "E", pos: [-1, 0, 0], type: "Full Binary Tree" },
    { id: "F", pos: [1, 0, 0], type: "Complete Binary Tree" },
    { id: "G", pos: [3, 0, 0], type: "General Tree" },
  ];

  const edges = [
    ["A", "B"],
    ["A", "C"],
    ["B", "D"],
    ["B", "E"],
    ["C", "F"],
    ["C", "G"],
  ];

  // === Automatically start AR session ===
  const startAR = (gl) => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
        if (supported) {
          navigator.xr
            .requestSession("immersive-ar", {
              requiredFeatures: ["hit-test", "local-floor"],
            })
            .then((session) => {
              gl.xr.setSession(session);
            })
            .catch((err) => console.error("AR session failed:", err));
        } else {
          console.warn("AR not supported on this device.");
        }
      });
    }
  };

  return (
    <div className="w-full h-[300px]">
      <Canvas
        camera={{ position: [0, 4, 25], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl); // Start AR automatically
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        <group position={[0, 0, -8]}>
          {/* Title */}
          <FadeInText
            show={true}
            text={"Types of Trees"}
            position={[0, 5, 0]}
            fontSize={0.7}
            color="white"
          />
          <FadeInText
            show={true}
            text={
              "General Tree • Binary Tree • Full Binary Tree • Complete Binary Tree • BST"
            }
            position={[0, 4.3, 0]}
            fontSize={0.35}
            color="#fde68a"
          />

          {/* Tree Visualization */}
          <TreeVisualization
            nodes={nodes}
            edges={edges}
            onNodeClick={setSelectedNode}
            selectedNode={selectedNode}
            addNodeRef={addNodeRef}
          />

          {/* Info Panel */}
          {selectedNode && (
            <NodeInfoPanel node={selectedNode} position={[7, 2, 0]} />
          )}
        </group>

        {/* AR Interaction Manager */}
        <ARInteractionManager
          nodeRefs={nodeRefs}
          setSelectedNode={setSelectedNode}
        />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// --- AR Interaction Manager (like before) ---
const ARInteractionManager = ({ nodeRefs, setSelectedNode }) => {
  const { gl } = useThree();

  useEffect(() => {
    const onSessionStart = () => {
      const session = gl.xr.getSession();
      if (!session) return;

      const onSelect = () => {
        const xrCamera = gl.xr.getCamera();
        const raycaster = new THREE.Raycaster();
        const cam = xrCamera.cameras ? xrCamera.cameras[0] : xrCamera;
        const dir = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(cam.quaternion)
          .normalize();
        const origin = cam.getWorldPosition(new THREE.Vector3());
        raycaster.set(origin, dir);

        const candidates = (nodeRefs.current || [])
          .map((group) => (group ? group.children : []))
          .flat();

        const intersects = raycaster.intersectObjects(candidates, true);
        if (intersects.length > 0) {
          let hit = intersects[0].object;
          while (hit && hit.userData?.nodeData === undefined && hit.parent) {
            hit = hit.parent;
          }
          const nodeData = hit?.userData?.nodeData;
          if (nodeData) setSelectedNode(nodeData);
        }
      };

      session.addEventListener("select", onSelect);
      const onEnd = () => session.removeEventListener("select", onSelect);
      session.addEventListener("end", onEnd);
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    return () => gl.xr.removeEventListener("sessionstart", onSessionStart);
  }, [gl, nodeRefs, setSelectedNode]);

  return null;
};

// === Tree Visualization ===
const TreeVisualization = ({
  nodes,
  edges,
  onNodeClick,
  selectedNode,
  addNodeRef,
}) => {
  return (
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
          type={node.type}
          onClick={() => onNodeClick(node)}
          isSelected={selectedNode?.id === node.id}
          nodeData={node}
          ref={addNodeRef}
        />
      ))}
    </group>
  );
};

// === Tree Node (Sphere + Label) ===
const TreeNode = forwardRef(
  ({ position, label, type, onClick, isSelected, nodeData }, ref) => {
    const groupRef = useRef();

    useEffect(() => {
      if (groupRef.current) groupRef.current.userData = { nodeData };
    }, [nodeData]);

    const baseColor =
      type === "Binary Search Tree"
        ? "#60a5fa"
        : type === "Binary Tree"
        ? "#34d399"
        : type === "Full Binary Tree"
        ? "#fbbf24"
        : type === "Complete Binary Tree"
        ? "#a78bfa"
        : "#f87171";

    const color = isSelected ? "#f472b6" : baseColor;

    return (
      <group
        position={position}
        onClick={onClick}
        ref={(g) => {
          groupRef.current = g;
          if (typeof ref === "function") ref(g);
          else if (ref) ref.current = g;
        }}
      >
        <mesh>
          <sphereGeometry args={[0.35, 32, 32]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <Text
          position={[0, 0.8, 0]}
          fontSize={0.35}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </group>
    );
  }
);

// === Connection (Edges) ===
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

// === Node Info Panel ===
const NodeInfoPanel = ({ node, position }) => {
  let description = "";

  switch (node.type) {
    case "General Tree":
      description =
        "A tree with no restriction on the number of children each node can have.";
      break;
    case "Binary Tree":
      description = "Each node can have at most two children: left and right.";
      break;
    case "Full Binary Tree":
      description =
        "Every node has either 0 or 2 children. No node has only one child.";
      break;
    case "Complete Binary Tree":
      description =
        "All levels are completely filled except possibly the last, which is filled from left to right.";
      break;
    case "Binary Search Tree":
      description =
        "A binary tree where left child < root < right child. Used for fast searching and sorting.";
      break;
    default:
      description = "Tree type information not available.";
  }

  const content = [
    `🔹 Node: ${node.id}`,
    `Tree Type: ${node.type}`,
    "",
    description,
  ].join("\n");

  return (
    <FadeInText
      show={true}
      text={content}
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

export default ARPage3;
