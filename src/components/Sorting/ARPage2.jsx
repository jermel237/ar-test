// ✅ ARPage2.jsx — Bubble Sort (Based on VisualPage2 + AR structure of ARPage1)

import React, { useState, useMemo, useEffect, useRef, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const ARPage2 = ({ data = [35, 10, 25, 5, 15], spacing = 2 }) => {
  const [array, setArray] = useState(data);
  const [swapPair, setSwapPair] = useState([]);
  const [isSorting, setIsSorting] = useState(false);
  const [finished, setFinished] = useState(false);

  const boxGroupRefs = useRef([]);

  const addBoxGroupRef = (r) => {
    if (r && !boxGroupRefs.current.includes(r)) boxGroupRefs.current.push(r);
  };

  const heights = useMemo(() => {
    const maxVal = Math.max(...array);
    return array.map((v) => (v / maxVal) * 2 + 0.5);
  }, [array]);

  const positions = useMemo(() => {
    const mid = (array.length - 1) / 2;
    return array.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [array, spacing]);

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  const handleReset = () => {
    setArray([...data]);
    setSwapPair([]);
    setIsSorting(false);
    setFinished(false);
  };

  const handleSortStart = async () => {
    if (isSorting) return;
    if (finished) {
      handleReset();
      return;
    }

    setIsSorting(true);

    let tempArray = [...array];
    const n = tempArray.length;

    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        setSwapPair([j, j + 1]);
        await sleep(700);

        if (tempArray[j] > tempArray[j + 1]) {
          [tempArray[j], tempArray[j + 1]] = [tempArray[j + 1], tempArray[j]];
          setArray([...tempArray]);
          await sleep(700);
        }
      }
    }

    setSwapPair([]);
    setFinished(true);
    setIsSorting(false);
  };

  const generateCode = () => {
    return [
      "📘 Bubble Sort Pseudo Code:",
      "",
      "array = [35, 10, 25, 5, 15]",
      "n = length(array)",
      "",
      "for i = 0 to n-1:",
      "    for j = 0 to n-i-1:",
      "        if array[j] > array[j+1]:",
      "            swap(array[j], array[j+1])",
      "",
      "// Result: [5, 10, 15, 25, 35]"
    ].join("\n");
  };

  // === Auto AR Start ===
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
        }
      });
    }
  };

  return (
    <div className="w-full h-[300px]">
      <Canvas
        camera={{ position: [0, 5, 13], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[8, 12, 6]} intensity={1} />

        <group position={[0, 0, -8]}>
          <FadeText
            text="Bubble Sort Algorithm (O(n²))"
            position={[0, 4.8, 0]}
            fontSize={0.6}
            color="#facc15"
          />

          <FadeText
            text={
              finished
                ? "Sorting completed! Tap any bar to reset."
                : isSorting
                ? "Sorting in progress..."
                : "Tap a bar to start Bubble Sort"
            }
            position={[0, 3.7, 0]}
            fontSize={0.35}
            color="white"
          />

          {/* Bars */}
          {array.map((value, i) => (
            <AnimatedBoxAR
              key={i}
              index={i}
              value={value}
              highlighted={swapPair.includes(i)}
              sorted={finished}
              height={heights[i]}
              position={positions[i]}
              onClick={handleSortStart}
              ref={(r) => addBoxGroupRef(r)}
            />
          ))}

          {finished && <CodePanel code={generateCode()} position={[8.8, 1, 0]} />}
        </group>

        <ARInteractionManager
          boxGroupRefs={boxGroupRefs}
          onToggleSort={handleSortStart}
        />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// === Animated Box (with AR linking for interaction) ===
const AnimatedBoxAR = forwardRef(
  ({ index, value, height, position, highlighted, sorted, onClick }, ref) => {
    const groupRef = useRef();
    const meshRef = useRef();
    const labelRef = useRef();

    const targetY = height / 2;
    const normalColor = sorted ? "#34d399" : "#60a5fa";
    const highlightColor = "#f87171";
    const targetColor = highlighted
      ? new THREE.Color(highlightColor)
      : new THREE.Color(normalColor);

    useEffect(() => {
      if (groupRef.current)
        groupRef.current.userData = { boxIndex: index };
    }, [index]);

    useFrame(() => {
      if (!meshRef.current) return;

      meshRef.current.position.x +=
        (position[0] - meshRef.current.position.x) * 0.15;
      meshRef.current.position.y +=
        (targetY - meshRef.current.position.y) * 0.15;

      meshRef.current.material.color.lerp(targetColor, 0.15);

      labelRef.current.position.set(
        meshRef.current.position.x,
        meshRef.current.position.y + height / 2 + 0.35,
        meshRef.current.position.z
      );
    });

    return (
      <group
        ref={(g) => {
          groupRef.current = g;
          if (typeof ref === "function") ref(g);
          else if (ref) ref.current = g;
        }}
      >
        <mesh ref={meshRef} onClick={onClick}>
          <boxGeometry args={[1.6, height, 1]} />
          <meshStandardMaterial color={highlighted ? highlightColor : normalColor} />
        </mesh>

        <Text ref={labelRef} fontSize={0.35} color="white">
          {String(value)}
        </Text>

        <mesh onClick={onClick}>
          <planeGeometry args={[1.6, height + 1]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>
    );
  }
);

// === AR Interaction Manager ===
const ARInteractionManager = ({ boxGroupRefs, onToggleSort }) => {
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

        const candidates = (boxGroupRefs.current || [])
          .map((group) => (group ? group.children : []))
          .flat();

        const hit = raycaster.intersectObjects(candidates, true)[0];
        if (hit) onToggleSort();
      };

      session.addEventListener("select", onSelect);
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    return () => gl.xr.removeEventListener("sessionstart", onSessionStart);
  }, [gl, boxGroupRefs, onToggleSort]);

  return null;
};

// === Shared fade text ===
const FadeText = ({ text, position, fontSize, color }) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    let start;
    const fade = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 900, 1);
      setOpacity(p);
      if (p < 1) requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }, []);

  return (
    <Text position={position} fontSize={fontSize} color={color} fillOpacity={opacity}>
      {text}
    </Text>
  );
};

const CodePanel = ({ code, position }) => (
  <FadeText text={code} position={position} fontSize={0.3} color="#c7d2fe" />
);

export default ARPage2;
