// ARPage4.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

/**
 * ARPage4
 * - BST visualization with 3D buttons inside the Canvas
 * - Buttons are interactable in normal mode (pointer events) and in WebXR (raycast on select)
 * - Uses same ARInteractionManager pattern as your ARPage3 reference
 */

const ARPage4 = () => {
  // BST state (start with sample tree)
  const [nodes, setNodes] = useState([
    { id: 50, pos: [0, 3, -8] },
    { id: 30, pos: [-2, 1.5, -8] },
    { id: 70, pos: [2, 1.5, -8] },
    { id: 20, pos: [-3, 0, -8] },
    { id: 40, pos: [-1, 0, -8] },
    { id: 60, pos: [1, 0, -8] },
    { id: 80, pos: [3, 0, -8] },
  ]);
  const [edges, setEdges] = useState([
    [50, 30],
    [50, 70],
    [30, 20],
    [30, 40],
    [70, 60],
    [70, 80],
  ]);

  const [selectedOp, setSelectedOp] = useState(null);
  const [highlightNode, setHighlightNode] = useState(null);
  const [activeButton, setActiveButton] = useState(null);

  // collect refs to 3D button groups for AR raycast
  const buttonRefs = useRef([]);
  const addButtonRef = (r) => {
    if (!r) return;
    if (!buttonRefs.current.includes(r)) buttonRefs.current.push(r);
  };

  // clear button refs if nodes change / remount
  useEffect(() => {
    return () => {
      buttonRefs.current = [];
    };
  }, []);

  // Start AR session if supported (same pattern from your reference)
  const startAR = (gl) => {
    if (navigator.xr && navigator.xr.isSessionSupported) {
      navigator.xr
        .isSessionSupported("immersive-ar")
        .then((supported) => {
          if (supported) {
            return navigator.xr.requestSession("immersive-ar", {
              requiredFeatures: ["hit-test", "local-floor"],
            });
          }
          return null;
        })
        .then((session) => {
          if (session) gl.xr.setSession(session);
        })
        .catch((err) => {
          console.warn("AR session start failed:", err);
        });
    }
  };

  // -------- BST operations: Insert/Search/Delete (Insert descends to bottom) --------
  // helper find children edges
  const getChildrenOf = (parentId) =>
    edges.filter(([a]) => a === parentId).map(([, b]) => b);

  // Insert that descends until empty spot and computes position
  const insertValue = (value) => {
    // keep IDs as numbers for comparisons
    const v = Number(value);
    if (nodes.some((n) => n.id === v)) {
      setSelectedOp(`Insert (exists ${v})`);
      setTimeout(() => setSelectedOp(null), 900);
      return;
    }

    // if no root
    if (nodes.length === 0) {
      setNodes([{ id: v, pos: [0, 3, -8] }]);
      setSelectedOp(`Insert ${v}`);
      setTimeout(() => setSelectedOp(null), 900);
      return;
    }

    // traverse from root
    let currentId = nodes[0].id;
    let parentId = null;
    let depth = 0;
    let parentPos = nodes.find((n) => n.id === currentId).pos.slice();
    let xOffset = 2.5;

    while (true) {
      parentId = currentId;
      const parentNode = nodes.find((n) => n.id === parentId);
      parentPos = parentNode.pos.slice();
      const children = getChildrenOf(parentId);
      // decide left or right
      if (v < parentId) {
        // find left child (child < parent)
        const leftChild = children.find((c) => c < parentId);
        if (!leftChild) {
          // place as left child
          const newPos = [parentPos[0] - xOffset, parentPos[1] - 1.5, parentPos[2]];
          setNodes((prev) => [...prev, { id: v, pos: newPos }]);
          setEdges((prev) => [...prev, [parentId, v]]);
          setSelectedOp(`Insert ${v}`);
          setTimeout(() => setSelectedOp(null), 900);
          break;
        } else {
          currentId = leftChild;
        }
      } else {
        // right child case
        const rightChild = children.find((c) => c > parentId);
        if (!rightChild) {
          const newPos = [parentPos[0] + xOffset, parentPos[1] - 1.5, parentPos[2]];
          setNodes((prev) => [...prev, { id: v, pos: newPos }]);
          setEdges((prev) => [...prev, [parentId, v]]);
          setSelectedOp(`Insert ${v}`);
          setTimeout(() => setSelectedOp(null), 900);
          break;
        } else {
          currentId = rightChild;
        }
      }
      // decrease horizontal offset as depth increases to avoid overlap
      depth++;
      xOffset *= 0.65;
    }
  };

  // Simple search visualization: follow edges from root to value, highlight sequence
  const visualizeSearch = (target) => {
    const t = Number(target);
    if (!nodes.find((n) => n.id === t)) {
      setSelectedOp(`Search (${t}) not found`);
      setTimeout(() => setSelectedOp(null), 1000);
      return;
    }

    let seq = [];
    let curr = nodes[0].id;
    while (curr !== undefined) {
      seq.push(curr);
      if (curr === t) break;
      const children = getChildrenOf(curr);
      curr = t < curr ? children.find((c) => c < curr) : children.find((c) => c > curr);
      if (curr === undefined) break;
    }

    setSelectedOp(`Searching ${t}`);
    let i = 0;
    const interval = setInterval(() => {
      setHighlightNode(seq[i]);
      i++;
      if (i >= seq.length) {
        clearInterval(interval);
        setTimeout(() => setHighlightNode(null), 700);
        setSelectedOp(`Search ${t}`);
        setTimeout(() => setSelectedOp(null), 900);
      }
    }, 700);
  };

  // Delete: remove node and any edges connected to it (simple remove)
  const deleteValue = (value) => {
    const v = Number(value);
    if (!nodes.find((n) => n.id === v)) {
      setSelectedOp(`Delete (${v}) not found`);
      setTimeout(() => setSelectedOp(null), 900);
      return;
    }
    setNodes((prev) => prev.filter((n) => n.id !== v));
    setEdges((prev) => prev.filter(([a, b]) => a !== v && b !== v));
    setSelectedOp(`Delete ${v}`);
    setTimeout(() => setSelectedOp(null), 900);
  };

  // convenience handlers passed to OperationsPanel and ARInteractionManager
  const handleOperation = (action) => {
    setActiveButton(action);
    // visual feedback for button
    setTimeout(() => setActiveButton(null), 250);

    if (action === "Insert") {
      // insert random between 10..99
      insertValue(Math.floor(Math.random() * 90 + 10));
    } else if (action === "Search") {
      if (nodes.length === 0) return;
      const random = nodes[Math.floor(Math.random() * nodes.length)].id;
      visualizeSearch(random);
    } else if (action === "Delete") {
      if (nodes.length === 0) return;
      deleteValue(nodes[nodes.length - 1].id);
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

        {/* Titles */}
        <FadeInText text="Binary Search Tree (BST)" position={[0, 5, -8]} fontSize={0.7} color="white" />
        <FadeInText
          text="Left subtree < Root < Right subtree — interactive in AR and desktop"
          position={[0, -1.5, -8]}
          fontSize={0.32}
          color="#fde68a"
        />

        {/* 3D Buttons Panel on left — these groups are collected by addButtonRef */}
        <group position={[-6, 2, -6]}>
          <OperationsPanel
            onOperation={handleOperation}
            addButtonRef={addButtonRef}
            activeButton={activeButton}
          />
        </group>

        {/* Tree Visualization */}
        <BSTVisualization nodes={nodes} edges={edges} highlightNode={highlightNode} />

        {/* Info text box (right) */}
        {selectedOp && (
          <FadeInText text={selectedOp} position={[8, 2, -8]} fontSize={0.33} color="#a5f3fc" />
        )}

        {/* AR Interaction Manager uses buttonRefs to trigger operations in AR mode */}
        <ARInteractionManager buttonRefs={buttonRefs} onOperation={handleOperation} />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// ---------------- AR INTERACTION MANAGER ----------------
// Listens for sessionstart, adds select listener that raycasts from XR camera
const ARInteractionManager = ({ buttonRefs, onOperation }) => {
  const { gl } = useThree();

  useEffect(() => {
    const onSessionStart = () => {
      const session = gl.xr.getSession();
      if (!session) return;

      const onSelect = () => {
        const xrCamera = gl.xr.getCamera();
        const raycaster = new THREE.Raycaster();
        const cam = xrCamera.cameras ? xrCamera.cameras[0] : xrCamera;

        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
        const origin = cam.getWorldPosition(new THREE.Vector3());
        raycaster.set(origin, dir);

        const candidates = (buttonRefs.current || [])
          .filter(Boolean)
          .map((g) => (g ? g.children : []))
          .flat();

        const intersects = raycaster.intersectObjects(candidates, true);
        if (intersects.length > 0) {
          let hit = intersects[0].object;
          // walk up to parent that has userData.action
          while (hit && hit.userData?.action === undefined && hit.parent) {
            hit = hit.parent;
          }
          const action = hit?.userData?.action;
          if (action && typeof onOperation === "function") {
            onOperation(action);
          }
        }
      };

      session.addEventListener("select", onSelect);
      const onEnd = () => session.removeEventListener("select", onSelect);
      session.addEventListener("end", onEnd);
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    return () => {
      try {
        gl.xr.removeEventListener("sessionstart", onSessionStart);
      } catch (e) {}
    };
  }, [gl, buttonRefs, onOperation]);

  return null;
};

// ---------------- OPERATIONS PANEL (3D buttons) ----------------
const OperationsPanel = ({ position = [0, 0, 0], onOperation, addButtonRef, activeButton }) => {
  const [localActive, setLocalActive] = useState(null);

  useEffect(() => {
    if (activeButton) {
      setLocalActive(activeButton);
      const t = setTimeout(() => setLocalActive(null), 300);
      return () => clearTimeout(t);
    }
  }, [activeButton]);

  const handlePointerDown = (e, action) => {
    e.stopPropagation();
    setLocalActive(action);
    onOperation(action);
    setTimeout(() => setLocalActive(null), 250);
  };

  const renderButton = (label, action, y) => {
    const isActive = localActive === action;
    const color = isActive ? "#22c55e" : "#38bdf8";

    return (
      <group
        position={[0, y, 0]}
        ref={(r) => {
          // add the group ref once so ARInteractionManager can raycast it
          if (r) addButtonRef(r);
        }}
        userData={{ action }}
      >
        {/* Mesh (catch non-AR pointer events) */}
        <mesh
          onPointerDown={(e) => handlePointerDown(e, action)}
          castShadow
          receiveShadow
          userData={{ action }}
        >
          <boxGeometry args={[3.2, 0.8, 0.12]} />
          <meshStandardMaterial color={color} />
        </mesh>

        {/* Text label — also pointerable */}
        <Text
          position={[0, 0, 0.07]}
          fontSize={0.35}
          anchorX="center"
          anchorY="middle"
          onPointerDown={(e) => handlePointerDown(e, action)}
        >
          {label}
        </Text>
      </group>
    );
  };

  return (
    <group position={position}>
      <Text position={[0, 1.6, 0]} fontSize={0.32} color="#fde68a" anchorX="center" anchorY="middle">
        Queue Operations:
      </Text>
      {renderButton("🔍 Search", "Search", 0.6)}
      {renderButton("➕ Insert", "Insert", -0.4)}
      {renderButton("❌ Delete", "Delete", -1.4)}
    </group>
  );
};

// ---------------- BST Visualization ----------------
const BSTVisualization = ({ nodes, edges, highlightNode }) => (
  <group>
    {edges.map(([a, b], i) => {
      const start = nodes.find((n) => n.id === a)?.pos;
      const end = nodes.find((n) => n.id === b)?.pos;
      if (!start || !end) return null;
      return <Connection key={i} start={start} end={end} />;
    })}
    {nodes.map((node) => (
      <TreeNode key={node.id} position={node.pos} label={node.id} isHighlighted={highlightNode === node.id} />
    ))}
  </group>
);

const TreeNode = ({ position, label, isHighlighted }) => {
  const color = isHighlighted ? "#f87171" : "#60a5fa";
  const meshRef = useRef();

  // small pulse for highlighted nodes
  useFrame(() => {
    if (!meshRef.current) return;
    if (isHighlighted) {
      const s = 1 + 0.08 * Math.sin(Date.now() * 0.01);
      meshRef.current.scale.set(s, s, s);
    } else {
      meshRef.current.scale.set(1, 1, 1);
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text position={[0, 0.8, 0]} fontSize={0.35} color="white" anchorX="center" anchorY="middle">
        {String(label)}
      </Text>
    </group>
  );
};

// Connection draws an arrow between two points (using ArrowHelper primitive)
const Connection = ({ start, end }) => {
  const ref = useRef();

  useFrame(() => {
    if (!ref.current) return;
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const dir = endVec.clone().sub(startVec).normalize();
    const length = startVec.distanceTo(endVec);
    // ArrowHelper API: setDirection + setLength / position
    ref.current.position.copy(startVec);
    ref.current.setDirection(dir);
    ref.current.setLength(length, 0.12, 0.08);
  });

  return <primitive ref={ref} object={new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0, "#94a3b8")} />;
};

// FadeInText component (same animate pattern you used)
const FadeInText = ({ text, position = [0, 0, 0], fontSize = 0.35, color = "white" }) => {
  const ref = useRef();
  const opacity = useRef(0);
  const scale = useRef(0.7);

  useFrame(() => {
    if (opacity.current < 1) opacity.current = Math.min(opacity.current + 0.05, 1);
    if (scale.current < 1) scale.current = Math.min(scale.current + 0.05, 1);
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
      textAlign="center"
    >
      {text}
    </Text>
  );
};

export default ARPage4;
