import React, { useRef, useState, useMemo, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const ARTreePage = () => {
  const [selectedNode, setSelectedNode] = useState(null);
  const nodeRefs = useRef([]);

  const nodes = [
    { id: "A", pos: [0, 3, -6], type: "Root" },
    { id: "B", pos: [-2, 1.5, -6], type: "Child" },
    { id: "C", pos: [2, 1.5, -6], type: "Child" },
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

  const addNodeRef = (r) => {
    if (r && !nodeRefs.current.includes(r)) nodeRefs.current.push(r);
  };

  const handleNodeClick = (node) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  };

  // Start AR session
  const startAR = (gl) => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
        if (supported) {
          navigator.xr
            .requestSession("immersive-ar", {
              requiredFeatures: ["hit-test", "local-floor"],
            })
            .then((session) => gl.xr.setSession(session))
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
        camera={{ position: [0, 2, 0], fov: 60 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={0.8} />

        {/* Header */}
        <FadeInText
          show={true}
          text={"Introduction to Trees"}
          position={[0, 4.5, -6]}
          fontSize={0.6}
          color="white"
        />

        <FadeInText
          show={true}
          text={"A hierarchical, non-linear data structure of connected nodes"}
          position={[0, 3.8, -6]}
          fontSize={0.3}
          color="#fde68a"
        />

        {/* Tree structure */}
        {edges.map(([a, b], i) => {
          const start = nodes.find((n) => n.id === a).pos;
          const end = nodes.find((n) => n.id === b).pos;
          return <Connection key={i} start={start} end={end} />;
        })}

        {nodes.map((node, i) => (
          <TreeNode
            key={i}
            ref={(r) => addNodeRef(r)}
            node={node}
            position={node.pos}
            selected={selectedNode?.id === node.id}
            onClick={() => handleNodeClick(node)}
          />
        ))}

        {/* Info panel */}
        {selectedNode && (
          <NodeInfoPanel node={selectedNode} position={[5, 2, -6]} />
        )}

        <ARInteractionManager
          nodeRefs={nodeRefs}
          setSelectedNode={setSelectedNode}
          nodes={nodes}
        />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// === Clickable node (with XR hit detection) ===
const TreeNode = forwardRef(({ node, position, selected, onClick }, ref) => {
  const color =
    node.type === "Root"
      ? "#60a5fa"
      : node.type === "Child"
      ? "#34d399"
      : "#fbbf24";

  const displayColor = selected ? "#f87171" : color;

  const groupRef = useRef();
  useEffect(() => {
    if (groupRef.current) groupRef.current.userData = { nodeId: node.id };
  }, [node]);

  return (
    <group
      position={position}
      ref={(g) => {
        groupRef.current = g;
        if (typeof ref === "function") ref(g);
        else if (ref) ref.current = g;
      }}
    >
      <mesh onClick={onClick}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color={displayColor} />
      </mesh>

      <FadeInText
        show={true}
        text={node.id}
        position={[0, 0.6, 0]}
        fontSize={0.25}
        color="#fff"
      />
    </group>
  );
});

// === Edges between nodes ===
const Connection = ({ start, end }) => {
  const points = useMemo(
    () => [new THREE.Vector3(...start), new THREE.Vector3(...end)],
    [start, end]
  );
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(points),
    [points]
  );
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#94a3b8" linewidth={2} />
    </line>
  );
};

// === Info panel ===
const NodeInfoPanel = ({ node, position }) => {
  let description = "";
  if (node.type === "Root")
    description = "Topmost node in the tree. Has no parent.";
  else if (node.type === "Child")
    description = "A node that has a parent and may have children.";
  else description = "A leaf node — has no children.";

  const text = `🔹 Node: ${node.id}\nType: ${node.type}\n\n${description}`;

  return (
    <FadeInText
      show={true}
      text={text}
      position={position}
      fontSize={0.28}
      color="#a5f3fc"
    />
  );
};

// === Fade-in text ===
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
      maxWidth={8}
      textAlign="center"
    >
      {text}
    </Text>
  );
};

// === AR interaction manager ===
const ARInteractionManager = ({ nodeRefs, setSelectedNode, nodes }) => {
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
          while (hit && !hit.userData?.nodeId && hit.parent) {
            hit = hit.parent;
          }
          const nodeId = hit?.userData?.nodeId;
          const node = nodes.find((n) => n.id === nodeId);
          if (node) setSelectedNode(node);
        }
      };

      session.addEventListener("select", onSelect);
      const cleanup = () => session.removeEventListener("select", onSelect);
      session.addEventListener("end", cleanup);
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    return () => gl.xr.removeEventListener("sessionstart", onSessionStart);
  }, [gl, nodeRefs, setSelectedNode, nodes]);

  return null;
};

export default ARTreePage;
