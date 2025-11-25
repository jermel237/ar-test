import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
  forwardRef,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const ARPage4 = ({ nodes = ["A", "B", "C", "D", "E", "F"], radius = 8 }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [traversalProgress, setTraversalProgress] = useState(-1);

  // Structure position (whole structure moves together)
  const [structurePos, setStructurePos] = useState([0, -3, -20]);
  const [isDragging, setIsDragging] = useState(false);

  const positions = useMemo(() => {
    const n = nodes.length;
    return nodes.map((_, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      return [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
    });
  }, [nodes, radius]);

  const nodeRefs = useRef([]);
  const structureRef = useRef();
  
  const addNodeRef = (r) => {
    if (!r) return;
    if (!nodeRefs.current.includes(r)) nodeRefs.current.push(r);
  };

  const traversalTimers = useRef([]);
  useEffect(() => {
    return () => {
      traversalTimers.current.forEach((t) => clearTimeout(t));
      traversalTimers.current = [];
    };
  }, []);

  // Drag whole structure
  const onDragStart = () => {
    setIsDragging(true);
    setSelectedNode(null);
    setTraversalProgress(-1);
    // Clear any ongoing traversal
    traversalTimers.current.forEach((t) => clearTimeout(t));
    traversalTimers.current = [];
  };

  const onDragMove = (newPos) => {
    setStructurePos(newPos);
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  const animateTraversal = useCallback(
    (targetIndex, stepMs = 600, onComplete) => {
      traversalTimers.current.forEach((t) => clearTimeout(t));
      traversalTimers.current = [];
      setTraversalProgress(-1);
      let idx = 0;
      const schedule = () => {
        const t = setTimeout(() => {
          setTraversalProgress(idx);
          idx++;
          if (idx <= targetIndex) schedule();
          else {
            if (onComplete) onComplete();
          }
        }, stepMs);
        traversalTimers.current.push(t);
      };
      schedule();
    },
    []
  );

  const handleNodeClick = (i) => {
    if (!isDragging) {
      animateTraversal(i, 600, () =>
        setSelectedNode((prev) => (prev === i ? null : i))
      );
    }
  };

  const generateCode = (index, value) =>
    [
      "📘 Pseudo Code Example (Circular Linked List):",
      "",
      "// Initialize circular linked list",
      "Head -> Node1 -> Node2 -> ... -> NodeN -> Head",
      "",
      `targetIndex = ${index}`,
      "currentNode = Head",
      "i = 0",
      "",
      "// Traverse until target node",
      "while i < targetIndex:",
      "    currentNode = currentNode.next",
      "    i += 1",
      "",
      "print('Accessed Node:', currentNode.value)",
      "",
      `// Result: ${value}`,
    ].join("\n");

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
        .catch((err) => console.warn("AR session start failed:", err));
    }
  };

  return (
    <div className="w-full h-[300px] flex items-center justify-center">
      <Canvas
        camera={{ position: [0, 9, 28], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* Whole structure group - moves together when dragging */}
        <group position={structurePos} ref={structureRef}>
          <FadeText
            text="Circular Linked List (Circle Layout)"
            position={[0, 5, -2]}
            fontSize={0.6}
            color="#facc15"
          />
          <FadeText
            text={isDragging ? "✋ Moving Structure..." : "Tap / Click a node to start traversal"}
            position={[0, 4.2, -2]}
            fontSize={0.35}
            color={isDragging ? "#f97316" : "white"}
          />

          <Scene
            nodes={nodes}
            positions={positions}
            selectedNode={selectedNode}
            traversalProgress={traversalProgress}
            handleNodeClick={handleNodeClick}
            addNodeRef={addNodeRef}
            isDragging={isDragging}
          />

          {selectedNode !== null && !isDragging && (
            <group position={[radius + 6, 1, 0]}>
              <FadeText
                text={generateCode(selectedNode, nodes[selectedNode])}
                fontSize={0.3}
                color="#c7d2fe"
              />
            </group>
          )}
        </group>

        <ARInteractionManager
          nodeRefs={nodeRefs}
          structureRef={structureRef}
          onNodeSelect={(idx) =>
            animateTraversal(idx, 600, () =>
              setSelectedNode((prev) => (prev === idx ? null : idx))
            )
          }
          isDragging={isDragging}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />

        <OrbitControls makeDefault enabled={!isDragging} />
      </Canvas>
    </div>
  );
};

const Scene = ({
  nodes,
  positions,
  selectedNode,
  traversalProgress,
  handleNodeClick,
  addNodeRef,
  isDragging,
}) => (
  <>
    {nodes.map((val, idx) => (
      <CNode
        key={idx}
        value={val}
        index={idx}
        position={positions[idx]}
        onClick={() => handleNodeClick(idx)}
        selected={selectedNode === idx}
        addNodeRef={addNodeRef}
        highlighted={traversalProgress >= idx}
        isDragging={isDragging}
      />
    ))}

    {nodes.map((_, idx) => (
      <CurvedArrow
        key={idx}
        start={positions[idx]}
        end={positions[(idx + 1) % nodes.length]}
        highlight={traversalProgress >= idx}
        animate={traversalProgress >= idx && !isDragging}
      />
    ))}
  </>
);

const CNode = forwardRef(
  ({ value, index, position, selected, onClick, addNodeRef, highlighted, isDragging }, ref) => {
    const size = [2.5, 2, 1];
    const groupRef = useRef();

    useEffect(() => {
      if (groupRef.current) groupRef.current.userData = { nodeIndex: index };
      if (addNodeRef && groupRef.current) addNodeRef(groupRef.current);
    }, [index, addNodeRef]);

    useEffect(() => {
      if (!ref) return;
      if (typeof ref === "function") ref(groupRef.current);
      else ref.current = groupRef.current;
    }, [ref]);

    return (
      <group position={position} ref={groupRef}>
        <mesh onClick={onClick}>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color={selected ? "#f87171" : highlighted ? "#fde68a" : "#60a5fa"}
          />
        </mesh>
        <Text
          position={[0, size[1] / 2 + 0.2, 0]}
          fontSize={0.35}
          anchorX="center"
          anchorY="middle"
          color="white"
        >
          {value}
        </Text>
      </group>
    );
  }
);

const CurvedArrow = ({ start, end, highlight, animate }) => {
  const sphereRef = useRef();
  const [t, setT] = useState(0);

  const lift = 2;
  const mid = [(start[0] + end[0]) / 2, lift, (start[2] + end[2]) / 2];

  const curve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(...mid),
      new THREE.Vector3(...end)
    );
  }, [start, mid, end]);

  const easeInOut = (x) => x * x * (3 - 2 * x);

  useFrame((state, delta) => {
    if (animate) {
      const speed = 1.0;
      setT((prev) => Math.min(prev + delta * speed, 1));
      const easedT = easeInOut(t);
      const pos = curve.getPoint(easedT);
      if (sphereRef.current) sphereRef.current.position.set(pos.x, pos.y, pos.z);
    } else {
      setT(0);
      if (sphereRef.current) sphereRef.current.position.set(...start);
    }
  });

  const points = curve.getPoints(50);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <group>
      <line>
        <bufferGeometry attach="geometry" {...geometry} />
        <lineBasicMaterial
          attach="material"
          color={highlight ? "yellow" : "black"}
          linewidth={2}
        />
      </line>
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="orange" />
      </mesh>
    </group>
  );
};

const ARInteractionManager = ({ 
  nodeRefs, 
  structureRef,
  onNodeSelect,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd
}) => {
  const { gl } = useThree();
  const longPressTimer = useRef(null);
  const touchedNode = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    const onSessionStart = () => {
      const session = gl.xr.getSession();
      if (!session) return;

      // Get camera ray (center of phone screen)
      const getCameraRay = () => {
        const xrCamera = gl.xr.getCamera();
        const cam = xrCamera.cameras ? xrCamera.cameras[0] : xrCamera;
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
        const origin = cam.getWorldPosition(new THREE.Vector3());
        return { origin, dir };
      };

      // Check if pointing at any node
      const getHitNode = () => {
        const { origin, dir } = getCameraRay();
        const raycaster = new THREE.Raycaster();
        raycaster.set(origin, dir);

        const candidates = (nodeRefs.current || [])
          .map((g) => (g ? g.children : []))
          .flat();

        const intersects = raycaster.intersectObjects(candidates, true);
        if (intersects.length > 0) {
          let hit = intersects[0].object;
          while (hit && hit.userData?.nodeIndex === undefined && hit.parent) {
            hit = hit.parent;
          }
          const idx = hit?.userData?.nodeIndex;
          if (idx !== undefined) {
            return idx;
          }
          return -1; // Hit structure but not specific node
        }
        return null;
      };

      // Calculate 3D position where phone is pointing
      const getPointPosition = () => {
        const { origin, dir } = getCameraRay();
        
        // Project ray to a distance (20 units in front)
        const distance = 20;
        const x = origin.x + dir.x * distance;
        const y = origin.y + dir.y * distance;
        const z = origin.z + dir.z * distance;
        
        return [x, y, z];
      };

      // Touch start
      const onSelectStart = () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
        }

        const hitNode = getHitNode();
        touchedNode.current = hitNode;

        // If touching any part of structure, start long press for drag
        if (hitNode !== null) {
          longPressTimer.current = setTimeout(() => {
            onDragStart();
            longPressTimer.current = null;
          }, 500);
        }
      };

      // Touch end
      const onSelectEnd = () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        if (isDraggingRef.current) {
          // Drop structure at current position
          onDragEnd();
        } else if (touchedNode.current !== null && touchedNode.current >= 0) {
          // Short tap on node - trigger traversal animation
          onNodeSelect(touchedNode.current);
        }

        touchedNode.current = null;
      };

      session.addEventListener("selectstart", onSelectStart);
      session.addEventListener("selectend", onSelectEnd);

      // Frame loop - move structure while dragging
      const onFrame = (time, frame) => {
        if (isDraggingRef.current) {
          const newPos = getPointPosition();
          onDragMove(newPos);
        }
        session.requestAnimationFrame(onFrame);
      };
      session.requestAnimationFrame(onFrame);

      session.addEventListener("end", () => {
        session.removeEventListener("selectstart", onSelectStart);
        session.removeEventListener("selectend", onSelectEnd);
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
        }
      });
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);

    return () => {
      try {
        gl.xr.removeEventListener("sessionstart", onSessionStart);
      } catch (e) {}
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [gl, nodeRefs, structureRef, onNodeSelect, onDragStart, onDragMove, onDragEnd]);

  return null;
};

const FadeText = ({ text, fontSize = 0.5, color = "white", position = [0, 0, 0] }) => {
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
      anchorX="center"
      anchorY="middle"
      fillOpacity={opacity}
      maxWidth={12}
      textAlign="center"
    >
      {text}
    </Text>
  );
};

export default ARPage4;
