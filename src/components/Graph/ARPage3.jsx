import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import * as THREE from "three";

const ARPage3 = () => {
  const [showPanel, setShowPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [highlightedNode, setHighlightedNode] = useState(null);
  const [visitedNodes, setVisitedNodes] = useState([]);
  const [visitedEdges, setVisitedEdges] = useState([]);
  const [mode, setMode] = useState(null);

  const clickableRefs = useRef([]);

  const addClickableRef = (r) => {
    if (r && !clickableRefs.current.includes(r)) clickableRefs.current.push(r);
  };

  const handleIndexClick = () => {
    setShowPanel((prev) => !prev);
    setPage(0);
  };

  const handleNextClick = () => {
    if (page < 2) setPage(page + 1);
    else setShowPanel(false);
  };

  const nodes = useMemo(
    () => [
      { id: "A", position: [0, 2.5, 0] },
      { id: "B", position: [-2, 0, 0] },
      { id: "C", position: [2, 0, 0] },
      { id: "D", position: [0, -2.5, 0] },
    ],
    []
  );

  const edges = useMemo(
    () => [
      ["A", "B"],
      ["A", "C"],
      ["B", "C"],
      ["B", "D"],
      ["C", "D"],
    ],
    []
  );

  const getNodePosition = (id) => nodes.find((n) => n.id === id).position;

  // --- DFS/BFS traversal animation ---
  useEffect(() => {
    if (!mode) return;
    const dfsOrder = ["A", "B", "D", "C"];
    const bfsOrder = ["A", "B", "C", "D"];
    const order = mode === "DFS" ? dfsOrder : bfsOrder;

    setVisitedNodes([]);
    setVisitedEdges([]);
    setHighlightedNode(null);

    let i = 0;
    let step = 0;

    const interval = setInterval(() => {
      if (step === 0) {
        setHighlightedNode(order[i]);
        setVisitedNodes((prev) => [...prev, order[i]]);
        step = 1;
      } else if (step === 1) {
        if (i < order.length - 1) {
          const edge = [order[i], order[i + 1]];
          setVisitedEdges((prev) => [...prev, edge]);
        }
        step = 0;
        i++;
        if (i >= order.length) {
          clearInterval(interval);
          setTimeout(() => setHighlightedNode(null), 1000);
        }
      }
    }, 800);

    return () => clearInterval(interval);
  }, [mode]);

  const isEdgeVisited = (a, b) =>
    visitedEdges.some(
      (e) => (e[0] === a && e[1] === b) || (e[1] === a && e[0] === b)
    );

  // === Auto-start AR ===
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
        camera={{ position: [0, 3, 10], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1} />

        <group position={[0, 0, -6]}>
          <FadeInText
            show={true}
            text={"Graph Traversals"}
            position={[0, 4.5, 0]}
            fontSize={0.8}
            color="white"
          />
          <FadeInText
            show={true}
            text={"DFS and BFS Visualization"}
            position={[0, 3.8, 0]}
            fontSize={0.45}
            color="#93c5fd"
          />

          {/* Edges */}
          {edges.map(([a, b], i) => {
            const visited = isEdgeVisited(a, b);
            return (
              <Line
                key={i}
                points={[getNodePosition(a), getNodePosition(b)]}
                color={visited ? "#facc15" : "#94a3b8"}
                lineWidth={visited ? 3 : 1.5}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node, i) => (
            <NodeSphere
              key={i}
              id={node.id}
              position={node.position}
              highlighted={highlightedNode === node.id}
              visited={visitedNodes.includes(node.id)}
              ref={(r) => addClickableRef(r)}
            />
          ))}

          {/* Info Panel */}
          {showPanel && (
            <DefinitionPanel
              page={page}
              position={[6, 0.5, 0]}
              onNextClick={handleNextClick}
            />
          )}

          {/* Buttons */}
          <Button3D
            label="Run DFS"
            position={[-2.5, -4.5, 0]}
            color={mode === "DFS" ? "#facc15" : "#60a5fa"}
            onClick={() => setMode("DFS")}
            ref={addClickableRef}
          />
          <Button3D
            label="Run BFS"
            position={[2.5, -4.5, 0]}
            color={mode === "BFS" ? "#facc15" : "#60a5fa"}
            onClick={() => setMode("BFS")}
            ref={addClickableRef}
          />

          <Text
            position={[0, -5.8, 0]}
            fontSize={0.4}
            color="#38bdf8"
            anchorX="center"
            anchorY="middle"
            onClick={handleIndexClick}
            ref={addClickableRef}
          >
            📘 Learn DFS/BFS ▶
          </Text>

          <ARInteractionManager
            clickableRefs={clickableRefs}
            onClickLabel={(label) => {
              if (label === "Run DFS") setMode("DFS");
              else if (label === "Run BFS") setMode("BFS");
              else if (label === "Learn DFS/BFS ▶") handleIndexClick();
            }}
          />
        </group>

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// === AR Interaction Manager (Raycast click fix) ===
const ARInteractionManager = ({ clickableRefs, onClickLabel }) => {
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

        const candidates = (clickableRefs.current || [])
          .map((g) => (g ? g.children : []))
          .flat();

        const intersects = raycaster.intersectObjects(candidates, true);
        if (intersects.length > 0) {
          let hit = intersects[0].object;
          while (hit && !hit.userData?.label && hit.parent) {
            hit = hit.parent;
          }
          const label = hit?.userData?.label;
          if (label) onClickLabel(label);
        }
      };

      session.addEventListener("select", onSelect);
      const onEnd = () => session.removeEventListener("select", onSelect);
      session.addEventListener("end", onEnd);
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    return () => gl.xr.removeEventListener("sessionstart", onSessionStart);
  }, [gl, clickableRefs, onClickLabel]);

  return null;
};

// === NodeSphere ===
const NodeSphere = forwardRef(({ id, position, highlighted, visited }, ref) => {
  const color = highlighted ? "#facc15" : visited ? "#fde68a" : "#60a5fa";
  const groupRef = useRef();

  useEffect(() => {
    if (groupRef.current) groupRef.current.userData = { label: id };
  }, [id]);

  return (
    <group
      position={position}
      ref={(g) => {
        groupRef.current = g;
        if (typeof ref === "function") ref(g);
        else if (ref) ref.current = g;
      }}
    >
      <mesh>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={highlighted ? "#fbbf24" : visited ? "#fcd34d" : "#000000"}
          emissiveIntensity={highlighted ? 0.8 : visited ? 0.3 : 0}
        />
      </mesh>
      <Text position={[0, 0.8, 0]} fontSize={0.35} color="white">
        {id}
      </Text>
    </group>
  );
});

// === Button3D ===
const Button3D = forwardRef(({ label, position, color, onClick }, ref) => {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef();

  useEffect(() => {
    if (groupRef.current) groupRef.current.userData = { label };
  }, [label]);

  return (
    <group
      position={position}
      ref={(g) => {
        groupRef.current = g;
        if (typeof ref === "function") ref(g);
        else if (ref) ref.current = g;
      }}
    >
      <mesh
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[2.2, 0.8, 0.2]} />
        <meshStandardMaterial
          color={hovered ? "#38bdf8" : color}
          emissive={hovered ? "#0284c7" : "#000000"}
          emissiveIntensity={hovered ? 0.4 : 0}
        />
      </mesh>
      <Text position={[0, 0, 0.15]} fontSize={0.35} color="white">
        {label}
      </Text>
    </group>
  );
});

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
    >
      {text}
    </Text>
  );
};

// === Definition Panel ===
const DefinitionPanel = ({ page, position, onNextClick }) => {
  const pages = [
    "🔍 Graph Traversal:\n\nProcess of visiting all nodes in a graph.\nTwo major methods:\n1️⃣ Depth-First Search (DFS)\n2️⃣ Breadth-First Search (BFS)",
    "📘 DFS (Depth-First Search):\n\n• Explore deep before backtracking.\n• Implemented via recursion or stack.\n• Example: solving puzzles, topological sort.",
    "📗 BFS (Breadth-First Search):\n\n• Explore level by level.\n• Implemented via queue.\n• Example: shortest path in unweighted graphs.\n\nComplexity: O(V + E)",
  ];
  const nextLabel = page < 2 ? "Next ▶" : "Close ✖";

  return (
    <group>
      <FadeInText
        show={true}
        text={pages[page]}
        position={position}
        fontSize={0.3}
        color="#fde68a"
      />
      <Text
        position={[position[0], position[1] - 2.3, position[2]]}
        fontSize={0.45}
        color="#38bdf8"
        anchorX="center"
        anchorY="middle"
        onClick={onNextClick}
      >
        {nextLabel}
      </Text>
    </group>
  );
};

export default ARPage3;
