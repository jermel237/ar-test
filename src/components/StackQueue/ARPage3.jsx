// ARPage3.jsx
import React, { useMemo, useState, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage3 = () => {
  const [queue, setQueue] = useState([10, 20, 30]);
  const [highlighted, setHighlighted] = useState(null);
  const [operationInfo, setOperationInfo] = useState(null);
  const [selectedButton, setSelectedButton] = useState(null);
  const buttonRefs = useRef([]);

  const spacing = 2;
  const positions = useMemo(() => queue.map((_, i) => [i * spacing, 0, 0]), [queue]);

  const showOperationInfo = (title, complexity, description) => {
    setOperationInfo({ title, complexity, description });
  };

  // === Queue Operations ===
  const handleEnqueue = () => {
    const newVal = Math.floor(Math.random() * 90) + 10;
    setQueue((prev) => [...prev, newVal]);
    showOperationInfo("Enqueue()", "O(1)", "Adds an element to the rear of the queue.");
  };

  const handleDequeue = () => {
    if (queue.length === 0) return;
    setHighlighted(0);
    setTimeout(() => {
      setQueue((prev) => prev.slice(1));
      setHighlighted(null);
    }, 600);
    showOperationInfo("Dequeue()", "O(1)", "Removes the element from the front of the queue.");
  };

  // === AR Session start ===
  const startAR = (gl) => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
        if (supported) {
          navigator.xr
            .requestSession("immersive-ar", { requiredFeatures: ["hit-test", "local-floor"] })
            .then((session) => gl.xr.setSession(session))
            .catch((err) => console.error("AR session failed:", err));
        } else {
          // not required, just informative
          console.warn("immersive-ar not supported");
        }
      });
    }
  };

  // collect button group refs
  const addButtonRef = (r) => {
    if (!r) return;
    if (!buttonRefs.current.includes(r)) buttonRefs.current.push(r);
  };

  // clear refs when queue changes (avoid stale refs if component remounts)
  useEffect(() => {
    return () => {
      buttonRefs.current = [];
    };
  }, []);

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

        {/* Headers & whole scene */}
        <FadeInText show text={"Introduction to Queues"} position={[0, 4.5, -8]} fontSize={0.55} color="white" />
        <FadeInText show text={"FIFO (First In, First Out) Principle"} position={[0, 3.7, 0]} fontSize={0.35} color="#fde68a" />

        {/* Move queue group back to z = -9 */}
        <group position={[0, 0, -8]}>
          {/* Queue Base and Boxes */}
          <QueueBase width={queue.length * spacing + 2} />

          {queue.map((value, i) => (
            <QueueBox
              key={i}
              value={value}
              position={positions[i]}
              isFront={i === 0}
              isRear={i === queue.length - 1}
              highlight={highlighted === i}
            />
          ))}

          {/* Operation Info Panel (left) */}
          {operationInfo && <OperationInfoPanel info={operationInfo} position={[-6, 1.5, 0]} />}

          {/* Operations Panel (right) — buttons are added via addButtonRef */}
          <OperationsPanel
            position={[6, 1.5, 0]}
            onEnqueue={handleEnqueue}
            onDequeue={handleDequeue}
            addButtonRef={addButtonRef}
            selectedButton={selectedButton}
          />

          <FadeInText show text={"Real-Life Example: A line at the ticket counter —\nfirst person served first."} position={[0, -2.5, 0]} fontSize={0.3} color="#a5f3fc" />
        </group>

        {/* AR Interaction Manager reads buttonRefs and triggers actions */}
        <ARInteractionManager
          buttonRefs={buttonRefs}
          setSelectedButton={setSelectedButton}
          handleEnqueue={handleEnqueue}
          handleDequeue={handleDequeue}
        />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// === AR Interaction Manager ===
const ARInteractionManager = ({ buttonRefs, setSelectedButton, handleEnqueue, handleDequeue }) => {
  const { gl } = useThree();

  useEffect(() => {
    const onSessionStart = () => {
      const session = gl.xr.getSession();
      if (!session) return;

      const onSelect = () => {
        // cast a ray from the XR camera forward
        const xrCamera = gl.xr.getCamera();
        const raycaster = new THREE.Raycaster();
        const cam = xrCamera.cameras ? xrCamera.cameras[0] : xrCamera;
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
        const origin = cam.getWorldPosition(new THREE.Vector3());
        raycaster.set(origin, dir);

        const candidates = (buttonRefs.current || [])
          .filter(Boolean)
          .map((group) => (group ? group.children : []))
          .flat();

        const intersects = raycaster.intersectObjects(candidates, true);
        if (intersects.length > 0) {
          // find parent group that has userData.action
          let hit = intersects[0].object;
          while (hit && hit.userData?.action === undefined && hit.parent) {
            hit = hit.parent;
          }
          const action = hit?.userData?.action;
          if (action) {
            setSelectedButton(action);
            if (action === "enqueue") handleEnqueue();
            else if (action === "dequeue") handleDequeue();
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
  }, [gl, buttonRefs, setSelectedButton]);

  return null;
};

// === FadeInText ===
const FadeInText = ({ show = true, text, position, fontSize = 0.35, color = "white" }) => {
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
    <Text ref={ref} position={position} fontSize={fontSize} color={color} anchorX="center" anchorY="middle" material-transparent maxWidth={10} textAlign="center">
      {text}
    </Text>
  );
};

// === QueueBox ===
const QueueBox = ({ value, position, isFront, isRear, highlight }) => {
  const color = highlight ? "#facc15" : "#34d399";
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current && meshRef.current.scale.y < 1) meshRef.current.scale.y += 0.1;
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} position={[0, 0.5, 0]}>
        <boxGeometry args={[1.5, 1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <FadeInText text={String(value)} position={[0, 0.5, 0.6]} fontSize={0.4} color="white" />

      {isFront && <Text position={[-1.6, 0.5, 0]} fontSize={0.3} color="#60a5fa">Front 🔵</Text>}
      {isRear && <Text position={[1.6, 0.5, 0]} fontSize={0.3} color="#f472b6">🟣 Rear</Text>}
    </group>
  );
};

// === QueueBase ===
const QueueBase = ({ width }) => {
  const geometry = useMemo(() => new THREE.BoxGeometry(width, 0.2, 2), [width]);
  return (
    <mesh position={[width / 2 - 2, -0.1, 0]}>
      <primitive object={geometry} />
      <meshBasicMaterial color="#1e293b" opacity={0.3} transparent />
    </mesh>
  );
};

// === OperationsPanel ===
const OperationsPanel = ({ position, onEnqueue, onDequeue, addButtonRef, selectedButton }) => {
  const [activeButton, setActiveButton] = useState(null);

  useEffect(() => {
    if (selectedButton) {
      setActiveButton(selectedButton);
      // clear active after a short while so visual feedback resets
      const t = setTimeout(() => setActiveButton(null), 300);
      return () => clearTimeout(t);
    }
  }, [selectedButton]);

  const handleClick = (e, action, callback) => {
    e.stopPropagation();
    setActiveButton(action);
    callback();
    setTimeout(() => setActiveButton(null), 250);
  };

  const renderButton = (label, action, y, callback) => {
    const isActive = activeButton === action;
    const color = isActive ? "#22c55e" : "#38bdf8";

    return (
      <group position={[0, y, 0]} ref={addButtonRef} userData={{ action }}>
        <mesh onClick={(e) => handleClick(e, action, callback)} castShadow receiveShadow userData={{ action }}>
          <boxGeometry args={[2.8, 0.6, 0.1]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <Text position={[0, 0, 0.06]} fontSize={0.35} color="white" anchorX="center" anchorY="middle" onClick={(e) => handleClick(e, action, callback)}>
          {label}
        </Text>
      </group>
    );
  };

  return (
    <group position={position}>
      <FadeInText show text={"Queue Functions:"} position={[0, 3, 0]} fontSize={0.35} color="#fde68a" />
      {renderButton("➕ Enqueue", "enqueue", 2.2, onEnqueue)}
      {renderButton("➖ Dequeue", "dequeue", 1.4, onDequeue)}
      <FadeInText show text={"Operations → O(1)\nFIFO Order"} position={[0, -2, 0]} fontSize={0.28} color="#fef9c3" />
    </group>
  );
};

// === OperationInfoPanel ===
const OperationInfoPanel = ({ info, position }) => {
  const content = [`🔹 ${info.title}`, `Complexity: ${info.complexity}`, "", info.description].join("\n");
  return <FadeInText show text={content} position={position} fontSize={0.32} color="#a5f3fc" />;
};

export default ARPage3;
