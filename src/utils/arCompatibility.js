/**
 * AR Compatibility Utilities
 * Handles cross-platform AR support for both Android and iOS
 */

/**
 * Detects if the device is iOS (iPhone, iPad, iPod)
 * @returns {boolean} True if device is iOS
 */
export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

/**
 * Detects if the device is Android
 * @returns {boolean} True if device is Android
 */
export const isAndroid = () => {
  return /Android/.test(navigator.userAgent);
};

/**
 * Checks if WebXR is supported on the device
 * @returns {Promise<boolean>} True if AR is supported
 */
export const isARSupported = async () => {
  // iOS doesn't support WebXR in standard browsers
  if (isIOS()) {
    return false;
  }

  // Check for Android/Chrome WebXR support
  if (!navigator.xr) {
    return false;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-ar");
    return supported;
  } catch (error) {
    console.warn("Error checking AR support:", error);
    return false;
  }
};

/**
 * Initializes AR session with proper error handling
 * Gracefully falls back to 3D visualization on unsupported devices
 * @param {Object} gl - Three.js WebGLRenderer object
 * @returns {Promise<boolean>} True if AR session started successfully
 */
export const initARSession = async (gl) => {
  // Skip AR on iOS - provide 3D visualization instead
  if (isIOS()) {
    console.info("iOS device detected. AR not available. Using 3D visualization mode.");
    return false;
  }

  try {
    const supported = await isARSupported();
    
    if (!supported) {
      console.warn("AR not supported on this device. Using 3D visualization mode.");
      return false;
    }

    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "local-floor"],
      optionalFeatures: ["dom-overlay"],
    });

    gl.xr.setSession(session);
    console.info("AR session started successfully");
    return true;
  } catch (error) {
    console.error("Failed to start AR session:", error);
    return false;
  }
};

/**
 * Gets device information for debugging
 * @returns {Object} Device information
 */
export const getDeviceInfo = () => {
  return {
    userAgent: navigator.userAgent,
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    hasWebXR: !!navigator.xr,
    platform: navigator.platform,
  };
};
