import React, { useState, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const ARPage1 = () => {
  const [stack, setStack] = useState([10, 20, 30]);
  const [highlighted, setHighlighted] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [page, setPage] = useState(0);

  const spacing = 1.6;
  const buttonRefs = useRef([]);

  const addButtonRef = (r) => {
    if (r && !buttonRefs.current.includes(r)) buttonRefs.current.push(r);
  };

  const positions = useMemo(() => stack.map((_, i) => [0, i * spacing, 0]), [stack]);

  const handlePush = () => {
    const newVal = Math.floor(Math.random() * 90) + 10;
    setStack((prev) => [...prev, newVal]);
    setActionType("push");
  };

  const handlePop = () => {
    if (stack.length === 0) return;
    setStack((prev) => prev.slice(0, -1));
    setActionType("pop");
  };

  const handlePeek = () => {
    if (stack.length === 0) return;
    const topIndex = stack.length - 1;
    setHighlighted(topIndex);
    setActionType("peek");
    setTimeout(() => setHighlighted(null), 1000);
  };

  const handleInfoClick = () => {
    setShowPanel((prev) => !prev);
    setPage(0);
  };

  const handleNextClick = () => {
    if (page < 1) setPage(page + 1);
    else setShowPanel(false);
  };

  const startAR = (gl) => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
        if (supported) {
          navigator.xr
            .requestSession("immersive-ar", { requiredFeatures: ["hit-test", "local-floor"] })
            .then((session) => {
              gl.xr.setSession(session);
            })
            .catch((err) => console.error("AR session failed:", err));
        } else console.warn("AR not supported on this device.");
      });
    }
  };

  return (
    <div className="w-full h-[300px]">
      <Canvas
        camera={{ position: [0, 4, 10], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        <group position={[-2, 0, -10]}>
          <FadeInText show text="Stack Operations & Complexity" position={[5, 5, 0]} fontSize={0.6} color="white" />

          <StackBackground height={stack.length * spacing + 2} />

          {stack.map((value, i) => (
            <StackBox
              key={i}
              index={i}
              value={value}
              position={[0, i * spacing, 0]}
              isTop={i === stack.length - 1}
              highlight={highlighted === i && i === stack.length - 1}
              actionType={actionType && i === stack.length - 1 ? actionType : null}
            />
          ))}

          <OperationsPanelAR
            position={[5, 2, 0]}
            onPush={handlePush}
            onPop={handlePop}
            onPeek={handlePeek}
            addButtonRef={addButtonRef}
            setActionType={setActionType}
          />

          {/* Info Button */}
          <group
            ref={addButtonRef}
            position={[5, -1.6, 0]}
            userData={{ btnAction: "info" }}
          >
            <mesh>
              <boxGeometry args={[2.5, 0.7, 0.2]} />
              <meshStandardMaterial color="#38bdf8" transparent opacity={0.1} />
            </mesh>
            <Text
              position={[0, 0, 0.11]}
              fontSize={0.45}
              color="#38bdf8"
              anchorX="center"
              anchorY="middle"
            >
              {showPanel ? "Close ✖" : "Info ▶"}
            </Text>
          </group>

          {/* Info Panel */}
          {showPanel && (
            <DefinitionPanel
              page={page}
              position={[11, 2.2, 0]}
              onNextClick={handleNextClick}
              stack={stack}
            />
          )}
        </group>

        <ARInteractionManager
          buttonRefs={buttonRefs}
          onSelectAction={(action) => {
            if (action === "push") handlePush();
            if (action === "pop") handlePop();
            if (action === "peek") handlePeek();
            if (action === "info") handleInfoClick();
          }}
        />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// === AR Interaction Manager ===
const ARInteractionManager = ({ buttonRefs, onSelectAction }) => {
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

        const candidates = (buttonRefs.current || []).map((g) => (g ? g.children : [])).flat();
        const intersects = raycaster.intersectObjects(candidates, true);
        if (intersects.length > 0) {
          let hit = intersects[0].object;
          while (hit && hit.userData?.btnAction === undefined && hit.parent) hit = hit.parent;
          const action = hit?.userData?.btnAction;
          if (action) onSelectAction(action);
        }
      };

      session.addEventListener("select", onSelect);
      session.addEventListener("end", () => session.removeEventListener("select", onSelect));
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    return () => gl.xr.removeEventListener("sessionstart", onSessionStart);
  }, [gl, buttonRefs, onSelectAction]);

  return null;
};

// === Stack Background ===
const StackBackground = ({ height }) => {
  const geometry = useMemo(() => new THREE.BoxGeometry(3.5, height, 0.08), [height]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
  return (
    <group position={[0, height / 2 - 1, -0.5]}>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#1e293b" opacity={0.3} transparent />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#64748b" linewidth={2} />
      </lineSegments>
    </group>
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
    <Text ref={ref} position={position} fontSize={fontSize} color={color} anchorX="center" anchorY="middle" material-transparent maxWidth={8} textAlign="center">
      {text}
    </Text>
  );
};

// === Stack Box ===
const StackBox = ({ index, value, position, isTop, highlight, actionType }) => {
  const baseColor = highlight ? "#facc15" : isTop ? "#60a5fa" : "#34d399";
  const [color, setColor] = useState(baseColor);
  const meshRef = useRef();
  const scaleY = useRef(0);

  useFrame(() => {
    if (meshRef.current) {
      scaleY.current += (1 - scaleY.current) * 0.2;
      meshRef.current.scale.y = scaleY.current;
    }
  });

  useEffect(() => {
    if (actionType === "push" || actionType === "pop") {
      setColor("#fbbf24");
      const timer = setTimeout(() => setColor(baseColor), 300);
      return () => clearTimeout(timer);
    } else if (actionType === "peek") {
      setColor("#facc15");
      const timer = setTimeout(() => setColor(baseColor), 300);
      return () => clearTimeout(timer);
    } else {
      setColor(baseColor);
    }
  }, [actionType, baseColor]);

  return (
    <group position={position}>
      <mesh ref={meshRef} position={[0, 0.5, 0]}>
        <boxGeometry args={[2, 1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <FadeInText show={true} text={String(value)} position={[0, 0.6, 0.57]} fontSize={0.4} color="white" />
      {isTop && (
        <Text position={[0, 1.6, 0]} fontSize={0.3} color="#fde68a" anchorX="center" anchorY="middle">
          🟢 Top
        </Text>
      )}
    </group>
  );
};

// === Operations Panel AR ===
const OperationsPanelAR = ({ position, onPush, onPop, onPeek, addButtonRef, setActionType }) => {
  const [activeButton, setActiveButton] = useState(null);

  const handleClick = (e, action, callback) => {
    e.stopPropagation();
    setActiveButton(action);
    setActionType(action);
    callback();
    setTimeout(() => setActiveButton(null), 250);
  };

  const renderButton = (label, action, y, callback) => {
    const isActive = activeButton === action;
    const color = isActive ? "#22c55e" : "#38bdf8";

    return (
      <group ref={addButtonRef} position={[0, y, 0]} userData={{ btnAction: action }}>
        <mesh onClick={(e) => handleClick(e, action, callback)}>
          <boxGeometry args={[2.6, 0.6, 0.1]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <Text position={[0, 0, 0.06]} fontSize={0.33} color="white" anchorX="center" anchorY="middle" onClick={(e) => handleClick(e, action, callback)}>
          {label}
        </Text>
      </group>
    );
  };

  return (
    <group position={position}>
      <FadeInText show={true} text="Stack Functions:" position={[0, 2, 0]} fontSize={0.35} color="#fde68a" />
      {renderButton("➕ Push", "push", 1.2, onPush)}
      {renderButton("➖ Pop", "pop", 0.4, onPop)}
      {renderButton("👁️ Peek", "peek", -0.4, onPeek)}
    </group>
  );
};

// === Definition Panel (Single Close Button) ===
const DefinitionPanel = ({ position, onNextClick, stack }) => {
  const content = [
    "📘 Stacks in 3D Visualization:",
    "",
    "A Stack is a linear data structure that follows",
    "the Last-In, First-Out (LIFO) principle, meaning",
    "the last element added is the first to be removed.",
    "",
    "Operations include:",
    "• Push → add an element to the top",
    "• Pop → remove the top element",
    "• Peek → view the top element without removing it",
    "",
    "In this AR visualization, the stack is represented",
    "as 3D boxes. Just like a stack of plates, you can",
    "only interact with the top box, which illustrates",
    "how stacks work in real life."
  ].join("\n");

  return (
    <group>
      <FadeInText show={true} text={content} position={position} fontSize={0.32} color="#fde68a" />
      <Text
        position={[position[0], position[1] - 3.8, position[2]]} // Close button lowered by 1 unit
        fontSize={0.45}
        color="#38bdf8"
        anchorX="center"
        anchorY="middle"
        onClick={onNextClick}
      >
        Close ✖
      </Text>
    </group>
  );
};




export default ARPage1;
