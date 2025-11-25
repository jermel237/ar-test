import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage1 = ({ spacing = 4.0 }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const nodeRefs = useRef([]);

  const data = [
    { id: 0, label: "A", connections: [1, 2] },
    { id: 1, label: "B", connections: [0, 3] },
    { id: 2, label: "C", connections: [0, 3] },
    { id: 3, label: "D", connections: [1, 2] },
  ];

  const nodeDefinitions = {
    A: "Vertices (nodes) represent entities in a graph. Each vertex is a data point or object.",
    B: "Edges represent relationships or connections between vertices.",
    C: "Graphs can be directed or undirected — showing one-way or two-way relationships.",
    D: "Graphs are used in real life, such as in social networks, maps, and computer networks.",
  };

  const addNodeRef = (r) => {
    if (r && !nodeRefs.current.includes(r)) nodeRefs.current.push(r);
  };

  // === Circular layout ===
  const positions = useMemo(() => {
    const angleStep = (2 * Math.PI) / data.length;
    const radius = 1.8; // smaller radius for tighter view
    return data.map((_, i) => [
      Math.cos(i * angleStep) * radius,
      Math.sin(i * angleStep) * radius,
      -9, // pushed farther away from the user
    ]);
  }, [data.length]);

  const handleNodeClick = (i) => {
    setSelectedNode((prev) => (prev === i ? null : i));
  };

  // === Start AR automatically ===
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
        camera={{ position: [0, 2, 0], fov: 60 }} // camera a bit above and closer
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={0.8} />

        {/* Title */}
        <FadeInText
          show={true}
          text={"Introduction to Graphs"}
          position={[0, 3.5, -9]}
          fontSize={0.35}
          color="white"
        />

        {/* Edges */}
        {data.map((node, i) =>
          node.connections.map(
            (conn) =>
              conn > i && (
                <Edge
                  key={`${i}-${conn}`}
                  start={positions[i]}
                  end={positions[conn]}
                />
              )
          )
        )}

        {/* Nodes */}
        {data.map((node, i) => (
          <GraphNode
            key={i}
            ref={(r) => addNodeRef(r)}
            index={i}
            node={node}
            position={positions[i]}
            selected={selectedNode === i}
            onClick={() => handleNodeClick(i)}
          />
        ))}

        {/* Definition Panel */}
        {selectedNode !== null && (
          <DefinitionPanel
            node={data[selectedNode]}
            definition={nodeDefinitions[data[selectedNode].label]}
            position={[3.5, 1.5, -9]}
            onClose={() => setSelectedNode(null)}
          />
        )}

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
          while (hit && hit.userData?.nodeIndex === undefined && hit.parent) {
            hit = hit.parent;
          }
          const idx = hit?.userData?.nodeIndex;
          if (idx !== undefined) setSelectedNode(idx);
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

// === Node (AR Clickable) ===
const GraphNode = forwardRef(
  ({ index, node, position, selected, onClick }, ref) => {
    const color = selected ? "#facc15" : "#60a5fa";
    const emissive = selected ? "#fbbf24" : "#000000";
    const groupRef = useRef();

    useEffect(() => {
      if (groupRef.current) groupRef.current.userData = { nodeIndex: index };
    }, [index]);

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
          <sphereGeometry args={[0.25, 32, 32]} /> {/* smaller size */}
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={selected ? 0.4 : 0}
          />
        </mesh>

        <FadeInText
          show={true}
          text={node.label}
          position={[0, 0.5, 0]}
          fontSize={0.2}
          color="white"
        />

        {selected && (
          <Text
            position={[0, 1, 0]}
            fontSize={0.18}
            color="#fde68a"
            anchorX="center"
            anchorY="middle"
          >
            Node {node.label} connected to {node.connections.join(", ")}
          </Text>
        )}
      </group>
    );
  }
);

// === Edge ===
const Edge = ({ start, end }) => {
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

// === Fade-in Text ===
const FadeInText = ({ show, text, position, fontSize, color }) => {
  const ref = useRef();
  const opacity = useRef(0);
  const scale = useRef(0.6);

  useFrame(() => {
    if (show) {
      opacity.current = Math.min(opacity.current + 0.06, 1);
      scale.current = Math.min(scale.current + 0.06, 1);
    } else {
      opacity.current = Math.max(opacity.current - 0.06, 0);
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
      maxWidth={4}
      textAlign="center"
    >
      {text}
    </Text>
  );
};

// === Definition Panel ===
const DefinitionPanel = ({ node, definition, position }) => {
  if (!node) return null;
  return (
    <group>
      <FadeInText
        show={true}
        text={`📘 Node ${node.label}\n\n${definition}`}
        position={position}
        fontSize={0.22}
        color="#fde68a"
      />
    </group>
  );
};

export default ARPage1;
