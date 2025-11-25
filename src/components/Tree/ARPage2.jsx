import React, { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage2 = () => {
  const [selectedNode, setSelectedNode] = useState(null);
  const nodeRefs = useRef([]);

  const addNodeRef = (r) => {
    if (r && !nodeRefs.current.includes(r)) nodeRefs.current.push(r);
  };

  // Node structure with relationships
  const nodes = [
    { id: "A", pos: [0, 3, -6], type: "Root" },
    { id: "B", pos: [-2, 1.5, -6], type: "Parent" },
    { id: "C", pos: [2, 1.5, -6], type: "Parent" },
    { id: "D", pos: [-3, 0, -6], type: "Leaf" },
    { id: "E", pos: [-1, 0, -6], type: "Leaf" },
    { id: "F", pos: [1, 0, -6], type: "Leaf" },
    { id: "G", pos: [3, 0, -6], type: "Leaf" },
  ];

  const edges = [
    ["A", "B"],
    ["A", "C"],
    ["B", "D"],
    ["B", "E"],
    ["C", "F"],
    ["C", "G"],
  ];

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  // --- Automatically start AR session ---
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
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* Title */}
        <FadeInText
          show={true}
          text={"Basic Terminology of Trees"}
          position={[0, 5, -6]}
          fontSize={0.7}
          color="white"
        />

        <FadeInText
          show={true}
          text={
            "Understanding Root, Parent, Child, Sibling, Leaf, Height, and Depth"
          }
          position={[0, 4.3, -6]}
          fontSize={0.35}
          color="#fde68a"
        />

        {/* Tree Visualization */}
        <TreeVisualization
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          selectedNode={selectedNode}
          addNodeRef={addNodeRef}
        />

        {/* Info Panel */}
        {selectedNode && (
          <NodeInfoPanel node={selectedNode} position={[7.4, 2, -6]} />
        )}

        {/* Handles AR click detection */}
        <ARInteractionManager
          nodeRefs={nodeRefs}
          setSelectedNode={setSelectedNode}
        />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// === AR Interaction Manager ===
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
          refCallback={addNodeRef}
          nodeData={node}
        />
      ))}
    </group>
  );
};

// === Node (Sphere + Label) ===
const TreeNode = ({
  position,
  label,
  type,
  onClick,
  isSelected,
  refCallback,
  nodeData,
}) => {
  const groupRef = useRef();

  useEffect(() => {
    if (groupRef.current) groupRef.current.userData = { nodeData };
    if (refCallback) refCallback(groupRef.current);
  }, [nodeData, refCallback]);

  const baseColor =
    type === "Root" ? "#60a5fa" : type === "Parent" ? "#34d399" : "#fbbf24";
  const color = isSelected ? "#f87171" : baseColor;

  return (
    <group ref={groupRef} position={position} onClick={onClick}>
      <mesh>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[0, 0.6, 0]}
        fontSize={0.35}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
};

// === Edge (Line between nodes) ===
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
    case "Root":
      description = "The first or topmost node of the tree. It has no parent.";
      break;
    case "Parent":
      description = "A node that has child nodes connected below it.";
      break;
    case "Leaf":
      description =
        "A node with no children. It represents the end of a branch.";
      break;
    default:
      description = "Tree node.";
  }

  const extraInfo = `
🧾 Terminology:
• Root – top node
• Parent & Child – relationship between connected nodes
• Siblings – children with the same parent
• Leaf – node with no children
• Height – longest path from root to a leaf
• Depth – distance from root to the node
`;

  const content = [
    `🔹 Node: ${node.id}`,
    `Type: ${node.type}`,
    "",
    description,
    "",
    extraInfo,
  ].join("\n");

  return (
    <FadeInText
      show={true}
      text={content}
      position={position}
      fontSize={0.25}
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
      maxWidth={10}
      textAlign="left"
    >
      {text}
    </Text>
  );
};

export default ARPage2;
