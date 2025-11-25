import * as THREE from "three";

/**
 * setupXRInput
 * Sets up XR selectstart/selectend handlers and a pose-based frame loop.
 * Options:
 * - gl: three renderer (required)
 * - getCandidates: () => Array of candidate meshes to raycast against
 * - onSelect: (hit) => called when select (tap) happens; hit is {object, point, index}
 * - onSelectStart: () => called on selectstart
 * - onSelectEnd: () => called on selectend
 * - onDragMove: (hitOrPoint) => called every XR frame while input active
 *
 * Returns a cleanup function to remove listeners.
 */
export function setupXRInput(gl, options) {
  const {
    getCandidates,
    onSelect,
    onSelectStart,
    onSelectEnd,
    onDragMove,
    useReferenceSpace = "local-floor",
  } = options || {};

  const sessionStartHandler = async () => {
    const session = gl.xr.getSession();
    if (!session) return;

    let refSpace = null;
    try {
      refSpace = await session.requestReferenceSpace(useReferenceSpace);
    } catch (e) {
      refSpace = null;
    }

    let activeInput = null;
    let rafHandle = null;
    let triggerSelectOnNextFrame = null;

    const raycaster = new THREE.Raycaster();

    const poseToRay = (pose) => {
      const p = pose.transform.position;
      const o = pose.transform.orientation;
      const origin = new THREE.Vector3(p.x, p.y, p.z);
      const quat = new THREE.Quaternion(o.x, o.y, o.z, o.w);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize();
      return { origin, dir };
    };

    const doRaycast = (origin, dir) => {
      raycaster.set(origin, dir);
      const candidates = (typeof getCandidates === "function" && getCandidates()) || [];
      const intersects = raycaster.intersectObjects(candidates, true);
      if (intersects.length > 0) {
        let hit = intersects[0];
        // find parent with index metadata if present
        let obj = hit.object;
        while (obj && obj.userData && obj.userData.nodeIndex === undefined && obj.userData.boxIndex === undefined && obj.parent) {
          obj = obj.parent;
        }
        const idx = obj?.userData?.nodeIndex ?? obj?.userData?.boxIndex;
        return { object: obj || hit.object, point: hit.point, index: idx };
      }
      return null;
    };

    const onSelectStartInternal = (evt) => {
      activeInput = evt.inputSource;
      if (typeof onSelectStart === "function") onSelectStart(evt);
    };

    const onSelectEndInternal = (evt) => {
      // Delay selection handling to the next XR frame so we can access an XRFrame and the input pose
      triggerSelectOnNextFrame = evt.inputSource || activeInput;
      if (typeof onSelectEnd === "function") onSelectEnd(evt);
      activeInput = null;
    };

    session.addEventListener("selectstart", onSelectStartInternal);
    session.addEventListener("selectend", onSelectEndInternal);

    const onXRFrame = (time, frame) => {
      // schedule next
      rafHandle = session.requestAnimationFrame(onXRFrame);

      if (!frame) return;

      // If there's an active input (press/drag), try to get its pose
      const inputSources = session.inputSources;
      if (activeInput) {
        try {
          const pose = frame.getPose(activeInput.targetRaySpace, refSpace || frame.session.referenceSpace);
          if (pose) {
            const { origin, dir } = poseToRay(pose);
            const hit = doRaycast(origin, dir);
            if (hit) {
              if (typeof onDragMove === "function") onDragMove(hit, frame);
            } else {
              // no hit, but still report point in front
              const point = origin.clone().add(dir.clone().multiplyScalar(8));
              if (typeof onDragMove === "function") onDragMove({ object: null, point }, frame);
            }
          }
        } catch (e) {

      // Handle selectend that was deferred to this frame
      if (triggerSelectOnNextFrame && frame) {
        try {
          const pose = frame.getPose(triggerSelectOnNextFrame.targetRaySpace, refSpace || frame.session.referenceSpace);
          if (pose) {
            const { origin, dir } = poseToRay(pose);
            const hit = doRaycast(origin, dir);
            if (hit && typeof onSelect === "function") onSelect(hit, frame);
          }
        } catch (e) {
          // ignore pose errors
        }
        triggerSelectOnNextFrame = null;
      }
          // ignore pose errors
        }
      } else {
        // no active input - we can still detect "select" style taps by checking each inputSource for a transient press
        // some platforms emit 'select' events; we rely on session events for final selection
      }

      // Also update hover/visual feedback using camera-centered ray if desired (not implemented here)
    };

    // start loop
    rafHandle = session.requestAnimationFrame(onXRFrame);

    const onSessionEnd = () => {
      try {
        session.removeEventListener("selectstart", onSelectStartInternal);
        session.removeEventListener("selectend", onSelectEndInternal);
      } catch (e) {}
      if (rafHandle) session.cancelAnimationFrame(rafHandle);
    };

    session.addEventListener("end", onSessionEnd);
  };

  gl.xr.addEventListener("sessionstart", sessionStartHandler);

  // return cleanup
  return () => {
    try {
      gl.xr.removeEventListener("sessionstart", sessionStartHandler);
    } catch (e) {}
  };
}
