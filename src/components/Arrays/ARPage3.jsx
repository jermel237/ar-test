// ARPage3.jsx
import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import useSound from "use-sound";
import dingSfx from "/sounds/ding.mp3"; // ensure this exists in /public/sounds/

const ARPage3 = ({ data = [5, 10, 15, 20, 25], spacing = 2.0 }) => {
  // Search state
  const [searching, setSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(null);
  const [foundIndex, setFoundIndex] = useState(null);
  const [statusText, setStatusText] = useState("");
  const [infoText, setInfoText] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [pseudoCode, setPseudoCode] = useState([]);
  const [play] = useSound(dingSfx, { volume: 0.5 });

  // Positions computed once
  const positions = useMemo(() => {
    const mid = (data.length - 1) / 2;
    return data.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [data, spacing]);

  // refs for AR raycasting (groups)
  const boxRefs = useRef([]);
  const addBoxRef = (r) => {
    if (r && !boxRefs.current.includes(r)) boxRefs.current.push(r);
  };

  // === Linear search animation ===
  const startSearch = (targetIndex) => {
    if (searching) return;
    setSearching(true);
    setHighlightIndex(null);
    setFoundIndex(null);
    setStatusText("");
    setInfoText("");
    setShowCode(false);

    let i = 0;
    setStatusText("🔍 Starting linear search...");

    const interval = setInterval(() => {
      setHighlightIndex(i);
      setStatusText(`Checking index ${i} → value ${data[i]}`);

      if (i === targetIndex) {
        clearInterval(interval);
        setTimeout(() => {
          setFoundIndex(i);
          play();
          setStatusText(`✅ Found value ${data[i]} at index ${i}`);
          setInfoText(`Value ${data[i]} located after ${i + 1} comparisons`);
          setPseudoCode([
            "📘 Pseudo Code Example:",
            "",
            "for i = 0 to n-1:",
            "   if array[i] == key:",
            "       return i",
            "",
            `// Found at index ${i}`,
          ]);
          setShowCode(true);
          setSearching(false);
        }, 900);
      } else {
        i++;
        if (i >= data.length) {
          clearInterval(interval);
          setTimeout(() => {
            setStatusText("❌ Value not found in array");
            setInfoText("Search completed — no match found.");
            setPseudoCode([
              "📘 Pseudo Code Example:",
              "",
              "for i = 0 to n-1:",
              "   if array[i] == key:",
              "       return i",
              "",
              "return -1  // not found",
            ]);
            setShowCode(true);
            setSearching(false);
          }, 800);
        }
      }
    }, 900);
  };

  // Auto-start WebXR AR session when possible
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
        camera={{ position: [0, 4, 10], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} />

        {/* Title */}
        <FadeText text="Search Operation (Linear Search)" position={[0, 3, -8]} fontSize={0.55} color="white" />

        {/* Instruction */}
        <FadeText
          text={!searching && !foundIndex && !infoText ? "Tap any box to start searching..." : ""}
          position={[0, 2.4, -8]}
          fontSize={0.3}
          color="#ffd166"
        />

        {/* Transition label */}
        <FadeText showText={!!statusText} text={statusText} position={[0, 2, -8]} fontSize={0.32} color="#ffd166" />

        {/* Boxes */}
        <group position={[0, 0, -10]}>
          {data.map((value, i) => (
            <Box
              key={i}
              index={i}
              value={value}
              position={positions[i]}
              highlight={highlightIndex === i}
              found={foundIndex === i}
              disabled={searching}
              onClick={() => startSearch(i)}
              ref={(r) => addBoxRef(r)}
            />
          ))}

          {/* Info / pseudo code to the right when search finishes */}
          {showCode && (
            <group position={[8, 1.2, 0]}>
              <FadeText text={infoText} position={[0, 0.8, 0]} fontSize={0.35} color="#9be7a2" />
              {pseudoCode.map((line, idx) => (
                <FadeText key={idx} text={line} position={[0, 0.4 - idx * 0.35, 0]} fontSize={0.28} color={line.startsWith("//") ? "#9be7a2" : "#ffeb99"} />
              ))}
            </group>
          )}
        </group>

        {/* AR Interaction Manager handles XR select events and maps them to startSearch */}
        <ARInteractionManager boxRefs={boxRefs} startSearch={startSearch} />
      </Canvas>
    </div>
  );
};

// === ARInteractionManager ===
const ARInteractionManager = ({ boxRefs, startSearch }) => {
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

        const candidates = (boxRefs.current || []).map((group) => (group ? group.children : [])).flat();
        const intersects = raycaster.intersectObjects(candidates, true);
        if (intersects.length > 0) {
          let hit = intersects[0].object;
          while (hit && hit.userData?.boxIndex === undefined && hit.parent) {
            hit = hit.parent;
          }
          const idx = hit?.userData?.boxIndex;
          if (idx !== undefined) {
            // trigger the linear search animation towards idx
            startSearch(idx);
          }
        }
      };

      session.addEventListener("select", onSelect);
      const onEnd = () => session.removeEventListener("select", onSelect);
      session.addEventListener("end", onEnd);
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    return () => gl.xr.removeEventListener("sessionstart", onSessionStart);
  }, [gl, boxRefs, startSearch]);

  return null;
};

// === Box ===
const Box = forwardRef(({ index, value, position, highlight, found, disabled, onClick }, ref) => {
  const meshRef = useRef();
  const size = [1.6, 1.2, 1];

  useEffect(() => {
    // attach index to group for raycasting detection
    if (meshRef.current && meshRef.current.parent) {
      meshRef.current.parent.userData = { boxIndex: index };
    }
  }, [index]);

  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material;
    const baseColor = new THREE.Color(index % 2 === 0 ? "#60a5fa" : "#34d399");
    const targetColor = found ? new THREE.Color("#fbbf24") : highlight ? new THREE.Color("#f87171") : baseColor;
    const targetEmissive = highlight || found ? 0.9 : 0;
    mat.color.lerp(targetColor, 0.12);
    mat.emissive = mat.emissive || new THREE.Color(0x000000);
    mat.emissive.lerp(targetColor, 0.12);
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity || 0, targetEmissive, 0.12);
  });

  return (
    <group
      position={position}
      ref={(g) => {
        if (typeof ref === "function") ref(g);
        else if (ref) ref.current = g;
      }}
      onClick={!disabled ? onClick : undefined}
      style={{ cursor: disabled ? "default" : "pointer" }}
    >
      <mesh ref={meshRef} castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={"#60a5fa"} emissive={"#000"} />
      </mesh>

      <Text position={[0, size[1] / 2 + 0.1, size[2] / 2 + 0.01]} fontSize={0.35} anchorX="center" anchorY="middle">
        {String(value)}
      </Text>

      <Text position={[0, size[1] / 2 - 0.35, size[2] / 2 + 0.01]} fontSize={0.22} anchorX="center" anchorY="middle" color="#e0e0e0">
        [{index}]
      </Text>
    </group>
  );
});

// === FadeText (simple fade-in for AR scene) ===
const FadeText = ({ text = "", position = [0, 0, 0], fontSize = 0.5, color = "white", showText = true }) => {
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    let frame;
    let start;
    const duration = 800;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setOpacity(progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    if (showText) frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [showText]);

  return (
    <Text position={position} fontSize={fontSize} color={color} anchorX="center" anchorY="middle" fillOpacity={opacity} maxWidth={10} textAlign="left">
      {text}
    </Text>
  );
};

export default ARPage3;
