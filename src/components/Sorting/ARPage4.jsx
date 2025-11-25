// ✅ ARPage4.jsx — Selection Sort (Based on ARPage3)

import React, { useState, useEffect, useMemo, useRef, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const ARPage4 = ({ data = [40, 15, 10, 25, 5], spacing = 2 }) => {
  const [array, setArray] = useState(data);
  const [isSorting, setIsSorting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [highlight, setHighlight] = useState([]); // [i, j, min]

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

  const resetSort = () => {
    setArray([...data]);
    setIsSorting(false);
    setFinished(false);
    setHighlight([]);
  };

  const startSort = async () => {
    if (isSorting) return;
    if (finished) return resetSort();

    setIsSorting(true);
    let temp = [...array];

    for (let i = 0; i < temp.length - 1; i++) {
      let minIndex = i;
      setHighlight([i, null, minIndex]);
      await sleep(700);

      for (let j = i + 1; j < temp.length; j++) {
        setHighlight([i, j, minIndex]);
        await sleep(700);

        if (temp[j] < temp[minIndex]) {
          minIndex = j;
          setHighlight([i, j, minIndex]);
          await sleep(700);
        }
      }

      if (minIndex !== i) {
        [temp[i], temp[minIndex]] = [temp[minIndex], temp[i]];
        setArray([...temp]);
        await sleep(700);
      }
    }

    setHighlight([]);
    setFinished(true);
    setIsSorting(false);
  };

  const generateCode = () => {
    return [
      "📘 Selection Sort Pseudo Code:",
      "",
      "for i = 0 to n-2:",
      "    min = i",
      "    for j = i+1 to n-1:",
      "        if array[j] < array[min]:",
      "            min = j",
      "    swap(array[i], array[min])",
      "",
      `Result: [${[...array].sort((a, b) => a - b).join(", ")}]`,
    ].join("\n");
  };

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
            .catch((err) => console.error("AR Session failed:", err));
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
            text="Selection Sort Algorithm (O(n²))"
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
                : "Tap a bar to start Selection Sort"
            }
            position={[0, 3.7, 0]}
            fontSize={0.35}
            color="white"
          />

          {array.map((value, i) => (
            <AnimatedBoxAR
              key={i}
              index={i}
              value={value}
              height={heights[i]}
              highlighted={highlight.includes(i)}
              sorted={finished}
              position={positions[i]}
              onClick={startSort}
              ref={(r) => addBoxGroupRef(r)}
            />
          ))}

          {finished && <CodePanel code={generateCode()} position={[8.8, 1, 0]} />}
        </group>

        <ARInteractionManager boxGroupRefs={boxGroupRefs} onToggleSort={startSort} />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// ✅ Animated Box Component (same as ARPage3)
const AnimatedBoxAR = forwardRef(
  ({ index, value, height, highlighted, sorted, position, onClick }, ref) => {
    const groupRef = useRef();
    const meshRef = useRef();
    const textRef = useRef();
    const normal = sorted ? "#34d399" : "#60a5fa";
    const focused = "#f87171";

    useEffect(() => {
      if (groupRef.current) {
        groupRef.current.userData = { boxIndex: index };
      }
    }, [index]);

    useFrame(() => {
      if (!meshRef.current) return;

      meshRef.current.position.x += (position[0] - meshRef.current.position.x) * 0.15;
      meshRef.current.position.y += ((height / 2) - meshRef.current.position.y) * 0.15;
      meshRef.current.material.color.lerp(
        new THREE.Color(highlighted ? focused : normal),
        0.2
      );

      textRef.current.position.set(
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
          <meshStandardMaterial />
        </mesh>

        <Text ref={textRef} fontSize={0.35} color="white">
          {String(value)}
        </Text>

        {/* Transparent plane for easier AR click detection */}
        <mesh onClick={onClick}>
          <planeGeometry args={[1.6, height + 1]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>
    );
  }
);

// ✅ XR Tap Detection
const ARInteractionManager = ({ boxGroupRefs, onToggleSort }) => {
  const { gl } = useThree();

  useEffect(() => {
    const onStart = () => {
      const session = gl.xr.getSession();
      if (!session) return;

      const onSelect = () => onToggleSort();
      session.addEventListener("select", onSelect);
    };

    gl.xr.addEventListener("sessionstart", onStart);
    return () => gl.xr.removeEventListener("sessionstart", onStart);
  }, [gl, onToggleSort]);

  return null;
};

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

export default ARPage4;
