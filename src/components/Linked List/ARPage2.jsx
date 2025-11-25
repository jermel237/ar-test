import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  forwardRef,
  useCallback,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

/**
 * ARPage2
 * - AR-enabled version of VisualPage2 (singly linked list traversal)
 * - Auto-starts immersive-ar session if supported
 * - Supports AR "select" events via raycasting against node groups
 * - Also works with normal clicks (OrbitControls fallback)
 */
const ARPage2 = ({ nodes = ["10", "20", "30", "40"], spacing = 6 }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // compute node positions like VisualPage2
  const positions = useMemo(() => {
    const mid = (nodes.length - 1) / 2;
    return nodes.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [nodes, spacing]);

  // refs to node groups for AR raycast
  const nodeRefs = useRef([]);
  const addNodeRef = (r) => {
    if (r && !nodeRefs.current.includes(r)) nodeRefs.current.push(r);
  };

  // store timers for traversal animation so we can clear them
  const traversalTimers = useRef([]);

  useEffect(() => {
    return () => {
      // cleanup traversal timers on unmount
      traversalTimers.current.forEach((t) => clearTimeout(t));
      traversalTimers.current = [];
    };
  }, []);

  // traversal animation: highlight nodes from 0 to targetIndex
  const animateTraversal = useCallback(
    (targetIndex, stepMs = 500, onComplete) => {
      traversalTimers.current.forEach((t) => clearTimeout(t));
      traversalTimers.current = [];

      // start from 0
      setHighlightedIndex(-1);
      let idx = 0;

      const schedule = () => {
        const t = setTimeout(() => {
          setHighlightedIndex(idx);
          idx++;
          if (idx <= targetIndex) {
            schedule();
          } else {
            if (typeof onComplete === "function") onComplete();
          }
        }, stepMs);
        traversalTimers.current.push(t);
      };

      // start immediately for index 0 (so first highlight shows quickly)
      schedule();
    },
    []
  );

  // generate pseudo code (same style as VisualPage2)
  const generateCode = (index, value) =>
    [
      "📘 Pseudo Code Example:",
      "",
      "Head -> Node1 -> Node2 -> ... -> null",
      `index = ${index}`,
      "",
      "currentNode = Head",
      `for i in range(0, index):`,
      "    currentNode = currentNode.next",
      "print('Accessed Node:', currentNode.value)",
      "",
      `// Result: ${value}`,
    ].join("\n");

  // Auto-start AR session if available
  const startAR = (gl) => {
    if (navigator.xr && navigator.xr.isSessionSupported) {
      navigator.xr
        .isSessionSupported("immersive-ar")
        .then((supported) => {
          if (supported) {
            return navigator.xr.requestSession("immersive-ar", {
              requiredFeatures: ["hit-test", "local-floor"],
            });
          } else {
            // not supported; silently ignore (OrbitControls will still work)
            return null;
          }
        })
        .then((session) => {
          if (session) {
            gl.xr.setSession(session);
          }
        })
        .catch((err) => {
          console.warn("AR session start failed:", err);
        });
    }
  };

  return (
    <div className="w-full h-[300px]">
      <Canvas
        camera={{ position: [0, 5, 18], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        <group position={[0, 0, -8]}>
          <FadeText
            text="Singly Linked List Overview"
            position={[0, 4, -2]}
            fontSize={0.6}
            color="#facc15"
          />
          <FadeText
            text="Tap a node to view its value and pseudo code"
            position={[0, 3.2, -2]}
            fontSize={0.35}
            color="white"
          />

          {nodes.map((val, i) => (
            <Node3D
              key={i}
              index={i}
              value={val}
              position={positions[i]}
              isLast={i === nodes.length - 1}
              selected={selectedNode === i}
              highlighted={i <= highlightedIndex}
              onClick={() => {
                // on normal click (non-AR), animate traversal and set selectedNode after traversal
                animateTraversal(i, 500, () =>
                  setSelectedNode((prev) => (prev === i ? null : i))
                );
              }}
              ref={(r) => addNodeRef(r)}
            />
          ))}

          {selectedNode !== null && (
            <group position={[positions[positions.length - 1][0] + 8, 1, 0]}>
              <FadeText
                text={generateCode(selectedNode, nodes[selectedNode])}
                fontSize={0.3}
                color="#c7d2fe"
              />
            </group>
          )}
        </group>

        {/* AR raycast interaction manager */}
        <ARInteractionManager
          nodeRefs={nodeRefs}
          setSelectedNode={(idx) => {
            // when AR select happens, run traversal animation then update selected
            if (idx === null || idx === undefined) return;
            animateTraversal(idx, 500, () =>
              setSelectedNode((prev) => (prev === idx ? null : idx))
            );
          }}
          setHighlightedIndex={setHighlightedIndex}
        />
      </Canvas>
    </div>
  );
};

/* AR Interaction Manager:
   - Listens for XR 'select' events when session starts and uses raycasting
   - Raycasts from the XR camera forward vector to intersect node groups
*/
const ARInteractionManager = ({ nodeRefs, setSelectedNode, setHighlightedIndex }) => {
  const { gl } = useThree();

  useEffect(() => {
    const onSessionStart = () => {
      const session = gl.xr.getSession();
      if (!session) return;

      const onSelect = () => {
        const xrCamera = gl.xr.getCamera();
        const raycaster = new THREE.Raycaster();
        const cam = xrCamera.cameras ? xrCamera.cameras[0] : xrCamera;

        // forward direction of camera
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
          // walk up to parent that holds the userData.nodeIndex
          while (hit && hit.userData?.nodeIndex === undefined && hit.parent) {
            hit = hit.parent;
          }
          const idx = hit?.userData?.nodeIndex;
          if (idx !== undefined) {
            setSelectedNode(idx);
          }
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

/* Node3D component (forwardRef) - similar to VisualPage2 node
   - attaches userData.nodeIndex to the group for AR raycast detection
   - exposes onClick for non-AR clicks
*/
const Node3D = forwardRef(({ index, value, position, isLast, selected, highlighted, onClick }, ref) => {
  const size = [4.5, 2, 1];
  const groupRef = useRef();

  useEffect(() => {
    if (groupRef.current) groupRef.current.userData = { nodeIndex: index };
  }, [index]);

  // wire both forwarded ref and internal groupRef
  useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") ref(groupRef.current);
    else if (ref) ref.current = groupRef.current;
  }, [ref]);

  const boxHalf = size[0] / 2;

  return (
    <group position={position} ref={groupRef}>
      <mesh onClick={onClick}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={selected ? "#f87171" : highlighted ? "#fde68a" : "#60a5fa"} />
      </mesh>

      <mesh position={[0.5, 0, 0.51]}>
        <boxGeometry args={[0.05, size[1], 0.05]} />
        <meshStandardMaterial color="white" />
      </mesh>

      <Text position={[-0.8, 0, 0.55]} fontSize={0.35} anchorX="center" anchorY="middle" color="white">
        {value}
      </Text>

      <Text position={[1.4, 0, 0.55]} fontSize={0.35} anchorX="center" anchorY="middle" color="white">
        Next
      </Text>

      {!isLast ? (
        <Arrow3D start={[boxHalf, 0, 0]} end={[boxHalf + 1.8, 0, 0]} highlighted={highlighted} />
      ) : (
        <>
          <Arrow3D start={[boxHalf, 0, 0]} end={[boxHalf + 1.2, 0, 0]} highlighted={highlighted} />
          <NullCircle offset={boxHalf + 1.8} />
        </>
      )}

      {selected && (
        <Text position={[0, size[1] + 0.2, 0]} fontSize={0.32} color="#fde68a" anchorX="center" anchorY="middle">
          Node "{value}"
        </Text>
      )}
    </group>
  );
});

const Arrow3D = ({ start, end, highlighted }) => {
  const ref = useRef();
  const dir = new THREE.Vector3(end[0] - start[0], 0, 0).normalize();
  const length = new THREE.Vector3(end[0] - start[0], 0, 0).length();

  useFrame(() => {
    if (ref.current) {
      ref.current.setDirection(dir);
      ref.current.setLength(length, 0.4, 0.2);
    }
  });

  return (
    <primitive
      object={
        new THREE.ArrowHelper(dir, new THREE.Vector3(...start), length, highlighted ? "yellow" : "black")
      }
      ref={ref}
    />
  );
};

const NullCircle = ({ offset }) => (
  <group position={[offset, 0, 0]}>
    <mesh>
      <circleGeometry args={[0.6, 32]} />
      <meshStandardMaterial color="red" />
    </mesh>
    <Text position={[0, 0, 0.4]} fontSize={0.3} anchorX="center" anchorY="middle" color="white">
      null
    </Text>
  </group>
);

/* FadeText - fade-in text identical to VisualPage2 */
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
      maxWidth={10}
      textAlign="left"
    >
      {text}
    </Text>
  );
};

export default ARPage2;
