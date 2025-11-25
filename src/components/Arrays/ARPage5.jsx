import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import useSound from "use-sound";
import dingSfx from "/sounds/ding.mp3";

/**
 * ARPage5.jsx (Closer to Camera at Z = -7)
 */
const ARPage5 = ({ spacing = 2.2 }) => {
  const [array] = useState([5, 10, 15, 20, 25]);
  const [removedIndexes, setRemovedIndexes] = useState(new Set());
  const [infoText, setInfoText] = useState("Tap a box to remove it");
  const [pseudoCode, setPseudoCode] = useState([]);
  const [play] = useSound(dingSfx, { volume: 0.5 });

  const boxRefs = useRef([]);
  const removedRef = useRef(removedIndexes);
  const handleSelectRef = useRef();

  useEffect(() => {
    removedRef.current = removedIndexes;
  }, [removedIndexes]);

  const handleSelect = (index) => {
    if (removedRef.current.has(index)) return;

    const newRemoved = new Set(removedRef.current);
    newRemoved.add(index);
    setRemovedIndexes(newRemoved);
    removedRef.current = newRemoved;

    play();
    setInfoText(`✅ Removed value ${array[index]}`);

    const remaining = array
      .map((v, i) => ({ value: v, originalIndex: i }))
      .filter((item) => !newRemoved.has(item.originalIndex));

    const remainingValues = remaining.map((r) => r.value);
    const remainingMap = remaining.map((r, newIdx) => `[${newIdx}] = ${r.value}`).join(", ");

    const deletedItems = Array.from(newRemoved)
      .sort((a, b) => a - b)
      .map((i) => `[${i}] = ${array[i]}`)
      .join(", ");

    setPseudoCode([
      "📘 Pseudo Code Example:",
      "",
      `// Original array: [${array.join(", ")}]`,
      `// Deleted (original index:value): ${deletedItems || "none"}`,
      `array = [${remainingValues.join(", ")}]`,
      `// Remaining (newIndex:value): ${remainingMap || "none"}`,
      `index = ${index} // removed`,
      "",
      "value = array[index]",
      "delete array[index]",
      `// New array length = ${remainingValues.length}`,
    ]);
  };

  useEffect(() => {
    handleSelectRef.current = handleSelect;
  }, [handleSelect]);

  // ✅ Now uses -7 instead of -10
  const positions = useMemo(() => {
    const visible = array.filter((_, i) => !removedRef.current.has(i));
    const activeCount = visible.length;
    const mid = (activeCount - 1) / 2;
    let cur = 0;

    return array.map((_, i) => {
      if (!removedRef.current.has(i)) {
        const pos = [(cur - mid) * spacing, 0, -7];
        cur++;
        return pos;
      }
      return [0, -9999, 0];
    });
  }, [array, spacing, removedIndexes]);

  const startAR = (gl) => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
        if (supported) {
          navigator.xr
            .requestSession("immersive-ar", {
              requiredFeatures: ["hit-test", "local-floor"],
            })
            .then((session) => gl.xr.setSession(session))
            .catch((err) => console.error("AR session failed:", err));
        }
      });
    }
  };

  return (
    <div className="w-full h-[400px]">
      <Canvas
        camera={{ position: [0, 2, 10], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} />

        {/* ✅ moved from -10 to -7 */}
        <FadeText text="Deletion Operation" position={[0, 2.5, -7]} fontSize={0.55} color="white" />
        <FadeText text={infoText} position={[0, 2, -7]} fontSize={0.3} color="#ffd166" />

        <group position={[0, 0, -7]}>
          {array.map((value, i) =>
            !removedIndexes.has(i) ? (
              <AnimatedBox
                key={i}
                index={i}
                value={value}
                targetPosition={positions[i]}
                onClick={() => handleSelect(i)}
                ref={(r) => (boxRefs.current[i] = r)}
              />
            ) : null
          )}
        </group>

        {pseudoCode.length > 0 &&
          pseudoCode.map((line, idx) => (
            <FadeText
              key={idx}
              text={line}
              position={[0, -1 - idx * 0.35, -7]}
              fontSize={0.28}
              color={
                line.startsWith("//")
                  ? "#8ef5b8"
                  : line.startsWith("array") || line.startsWith("index") || line.startsWith("delete") || line.startsWith("value")
                  ? "#ffeb99"
                  : "#9be7a2"
              }
            />
          ))}

        <ARInteractionManager boxRefs={boxRefs} handleSelectRef={handleSelectRef} />
      </Canvas>
    </div>
  );
};

/* XR Interaction */
const ARInteractionManager = ({ boxRefs, handleSelectRef }) => {
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

        const candidates = (boxRefs.current || []).map((g) => (g ? g.children : [])).flat();
        const intersects = raycaster.intersectObjects(candidates, true);

        if (intersects.length > 0) {
          let hit = intersects[0].object;
          while (hit && hit.userData?.boxIndex === undefined && hit.parent) hit = hit.parent;
          const idx = hit?.userData?.boxIndex;

          if (idx !== undefined && handleSelectRef.current) handleSelectRef.current(idx);
        }
      };

      session.addEventListener("select", onSelect);
      session.addEventListener("end", () => session.removeEventListener("select", onSelect));
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    return () => gl.xr.removeEventListener("sessionstart", onSessionStart);
  }, [gl, boxRefs, handleSelectRef]);

  return null;
};

/* AnimatedBox */
const AnimatedBox = forwardRef(({ index, value, targetPosition, onClick }, ref) => {
  const groupRef = useRef();
  const size = [1.6, 1.2, 1];

  useEffect(() => {
    if (groupRef.current) groupRef.current.userData = { boxIndex: index };
  }, [index]);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(new THREE.Vector3(...targetPosition), 0.12);
  });

  return (
    <group
      ref={(g) => {
        groupRef.current = g;
        if (typeof ref === "function") ref(g);
        else if (ref) ref.current = g;
      }}
      onClick={onClick}
    >
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#60a5fa" emissive="#000" />
      </mesh>

      <Text position={[0, size[1] / 2 + 0.1, size[2] / 2 + 0.01]} fontSize={0.35} color="white">
        {value}
      </Text>

      <Text position={[0, size[1] / 2 - 0.35, size[2] / 2 + 0.02]} fontSize={0.22} color="#e0e0e0">
        [{index}]
      </Text>
    </group>
  );
});

/* FadeText */
const FadeText = ({ text, position, fontSize = 0.5, color = "white" }) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    let frame;
    let start;
    const duration = 400;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setOpacity(progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [text]);

  return (
    <Text position={position} fontSize={fontSize} color={color} fillOpacity={opacity} anchorX="center" anchorY="middle">
      {text}
    </Text>
  );
};

export default ARPage5;
