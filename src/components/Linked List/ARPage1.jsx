import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage1 = ({ nodes = ["A", "B", "C"], spacing = 6.3 }) => {
  const [selectedNode, setSelectedNode] = useState(null);

  // === Compute node positions ===
  const positions = useMemo(() => {
    const mid = (nodes.length - 1) / 2;
    return nodes.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [nodes, spacing]);

  // === Node references for AR raycasting ===
  const nodeRefs = useRef([]);
  const addNodeRef = (r) => {
    if (r && !nodeRefs.current.includes(r)) nodeRefs.current.push(r);
  };

  // === Generate pseudo code when node is tapped ===
  const generateCode = (index, value) => {
    return [
      "📘 Pseudo Code Example:",
      "",
      "linkedList = Head -> Node1 -> Node2 -> ...",
      `index = ${index}`,
      "",
      "currentNode = Node at position index",
      "print('Accessed Node:', currentNode.value)",
      "",
      `// Result: ${value}`,
    ].join("\n");
  };

  // === Auto-start AR session ===
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
        camera={{ position: [0, 4, 18], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        {/* Lights */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* Scene */}
        <group position={[0, 0, -8]}>
          <FadeText
            text="Linked List Introduction"
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

          {nodes.map((value, i) => (
            <Node3D
              key={i}
              index={i}
              value={value}
              position={positions[i]}
              selected={selectedNode === i}
              isLast={i === nodes.length - 1}
              onClick={() => setSelectedNode((prev) => (prev === i ? null : i))}
              ref={(r) => addNodeRef(r)}
            />
          ))}

          {selectedNode !== null && (
            <CodePanel
              code={generateCode(selectedNode, nodes[selectedNode])}
              position={[positions[positions.length - 1][0] + 8, 1, 0]}
            />
          )}
        </group>

        <ARInteractionManager nodeRefs={nodeRefs} setSelectedNode={setSelectedNode} />
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
          if (idx !== undefined) {
            setSelectedNode((prev) => (prev === idx ? null : idx));
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

// === Node3D Component ===
const Node3D = forwardRef(({ index, value, position, isLast, selected, onClick }, ref) => {
  const size = [4.5, 2, 1];
  const groupRef = useRef();

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.userData = { nodeIndex: index };
    }
  }, [index]);

  const boxHalf = size[0] / 2;

  return (
    <group
      position={position}
      ref={(g) => {
        groupRef.current = g;
        if (typeof ref === "function") ref(g);
        else if (ref) ref.current = g;
      }}
    >
      {/* Main Box */}
      <mesh onClick={onClick}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={selected ? "#f87171" : "#60a5fa"} />
      </mesh>

      {/* Divider */}
      <mesh position={[0.5, 0, 0.51]}>
        <boxGeometry args={[0.05, size[1], 0.05]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Labels */}
      <Text position={[-0.8, 0, 0.55]} fontSize={0.35} color="white">
        {value}
      </Text>
      <Text position={[1.4, 0, 0.55]} fontSize={0.35} color="white">
        Next
      </Text>

      {/* Arrow or Null */}
      {!isLast ? (
        <Arrow3D start={[boxHalf, 0, 0]} end={[boxHalf + 1.8, 0, 0]} />
      ) : (
        <>
          <Arrow3D start={[boxHalf, 0, 0]} end={[boxHalf + 1.2, 0, 0]} />
          <NullCircle offset={boxHalf + 1.8} />
        </>
      )}

      {/* Floating Label */}
      {selected && (
        <Text
          position={[0, size[1] + 0.2, 0]}
          fontSize={0.32}
          color="#fde68a"
          anchorX="center"
          anchorY="middle"
        >
          Node "{value}"
        </Text>
      )}
    </group>
  );
});

// === Arrow3D ===
const Arrow3D = ({ start, end }) => {
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
      object={new THREE.ArrowHelper(dir, new THREE.Vector3(...start), length, "black")}
      ref={ref}
    />
  );
};

// === NullCircle ===
const NullCircle = ({ offset }) => (
  <group position={[offset, 0, 0]}>
    <mesh>
      <circleGeometry args={[0.6, 32]} />
      <meshStandardMaterial color="red" />
    </mesh>
    <Text position={[0, 0, 0.4]} fontSize={0.3} color="white">
      null
    </Text>
  </group>
);

// === Code Panel ===
const CodePanel = ({ code, position }) => (
  <FadeText text={code} position={position} fontSize={0.3} color="#c7d2fe" />
);

// === Fade Text ===
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

export default ARPage1;
