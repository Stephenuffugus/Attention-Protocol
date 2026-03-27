/**
 * SWS Attention Protocol — Movement & Fitness Hash System
 * GPS haversine step counting, DeviceMotion accelerometer,
 * and OAuth fitness bridge framework (Google Fit / Strava).
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */
(function(window, navigator) {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  var GPS_UPDATE_INTERVAL = 5000;        // GPS poll every 5 seconds
  var STEP_LENGTH_METERS = 0.762;        // Average human step length (30 inches)
  var STEPS_PER_HASH_SMALL = 200;        // trail_steps_200 threshold
  var STEPS_PER_HASH_LARGE = 2000;       // trail_steps_2000 milestone
  var FITNESS_STEPS_PER_HASH = 1000;     // fitness_import threshold
  var FITNESS_DAILY_CAP = 10;            // Max 10 hashes from fitness import per day
  var ACCEL_STEP_THRESHOLD = 1.2;        // G-force threshold for step detection
  var ACCEL_STEP_COOLDOWN_MS = 250;      // Min time between accelerometer steps

  // ============================================================
  // STATE
  // ============================================================

  var _gpsWatchId = null;
  var _lastGpsPosition = null;
  var _gpsStepCount = 0;
  var _gpsTotalDistance = 0;
  var _gpsStartTime = null;

  var _accelListening = false;
  var _accelStepCount = 0;
  var _lastStepTime = 0;
  var _lastAccelMagnitude = 0;

  var _fitnessImportCount = 0;
  var _fitnessImportDate = '';

  var _movementCallbacks = {
    onStep: null,
    onMilestone: null,
    onHashEarned: null
  };

  // ============================================================
  // GPS-BASED STEP COUNTING (Haversine Distance)
  // ============================================================

  /**
   * Start GPS-based step counting.
   * Uses haversine formula to calculate real-world distance between GPS samples,
   * then converts distance to estimated steps.
   *
   * @param {Object} options
   * @param {Function} options.onStep     - Called on each step milestone (200, 400, ...)
   * @param {Function} options.onMilestone - Called on 2000-step milestones
   * @param {Function} options.onHashEarned - Called when a hash is earned
   */
  function startGPSTracking(options) {
    if (!('geolocation' in navigator)) {
      console.warn('[SWS Movement] Geolocation not available');
      return false;
    }

    _movementCallbacks = options || {};
    _gpsStartTime = Date.now();
    _gpsStepCount = 0;
    _gpsTotalDistance = 0;
    _lastGpsPosition = null;

    _gpsWatchId = navigator.geolocation.watchPosition(
      _onGpsUpdate,
      _onGpsError,
      {
        enableHighAccuracy: true,
        maximumAge: GPS_UPDATE_INTERVAL,
        timeout: 10000
      }
    );

    return true;
  }

  function stopGPSTracking() {
    if (_gpsWatchId !== null) {
      navigator.geolocation.clearWatch(_gpsWatchId);
      _gpsWatchId = null;
    }

    return {
      steps: _gpsStepCount,
      distanceMeters: Math.round(_gpsTotalDistance),
      durationMs: _gpsStartTime ? Date.now() - _gpsStartTime : 0
    };
  }

  function _onGpsUpdate(position) {
    var lat = position.coords.latitude;
    var lon = position.coords.longitude;
    var accuracy = position.coords.accuracy;

    // Ignore low-accuracy readings (> 30 meters)
    if (accuracy > 30) return;

    if (_lastGpsPosition) {
      var distance = _haversineDistance(
        _lastGpsPosition.lat, _lastGpsPosition.lon,
        lat, lon
      );

      // Ignore tiny movements (GPS noise) and impossibly large jumps
      if (distance > 0.5 && distance < 100) {
        _gpsTotalDistance += distance;
        var newSteps = Math.floor(distance / STEP_LENGTH_METERS);
        _gpsStepCount += newSteps;

        // Check for 200-step milestone
        var prevMilestone200 = Math.floor((_gpsStepCount - newSteps) / STEPS_PER_HASH_SMALL);
        var currMilestone200 = Math.floor(_gpsStepCount / STEPS_PER_HASH_SMALL);
        if (currMilestone200 > prevMilestone200) {
          _earnMovementHash('trail_steps_200', STEPS_PER_HASH_SMALL);
        }

        // Check for 2000-step milestone
        var prevMilestone2K = Math.floor((_gpsStepCount - newSteps) / STEPS_PER_HASH_LARGE);
        var currMilestone2K = Math.floor(_gpsStepCount / STEPS_PER_HASH_LARGE);
        if (currMilestone2K > prevMilestone2K) {
          _earnMovementHash('trail_steps_2000', STEPS_PER_HASH_LARGE);
          if (typeof _movementCallbacks.onMilestone === 'function') {
            _movementCallbacks.onMilestone(_gpsStepCount);
          }
        }

        if (typeof _movementCallbacks.onStep === 'function') {
          _movementCallbacks.onStep(_gpsStepCount, distance);
        }
      }
    }

    _lastGpsPosition = { lat: lat, lon: lon, timestamp: Date.now() };
  }

  function _onGpsError(error) {
    console.warn('[SWS Movement] GPS error:', error.message);
  }

  /**
   * Haversine formula: calculates great-circle distance between two GPS coordinates.
   * Returns distance in meters.
   */
  function _haversineDistance(lat1, lon1, lat2, lon2) {
    var R = 6371000; // Earth's radius in meters
    var dLat = _toRad(lat2 - lat1);
    var dLon = _toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(_toRad(lat1)) * Math.cos(_toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function _toRad(deg) { return deg * Math.PI / 180; }

  // ============================================================
  // ACCELEROMETER-BASED STEP COUNTING (DeviceMotion API)
  // ============================================================

  /**
   * Start accelerometer-based step counting.
   * Works alongside GPS or standalone. Uses peak detection on acceleration magnitude.
   */
  function startAccelerometerTracking(options) {
    _movementCallbacks = options || _movementCallbacks;

    // iOS 13+ requires permission
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission()
        .then(function(state) {
          if (state === 'granted') _attachAccelerometer();
        })
        .catch(function() {
          console.warn('[SWS Movement] Accelerometer permission denied');
        });
    } else if ('DeviceMotionEvent' in window) {
      _attachAccelerometer();
    } else {
      console.warn('[SWS Movement] DeviceMotion not available');
      return false;
    }

    return true;
  }

  function stopAccelerometerTracking() {
    if (_accelListening) {
      window.removeEventListener('devicemotion', _onDeviceMotion);
      _accelListening = false;
    }
    return { steps: _accelStepCount };
  }

  function _attachAccelerometer() {
    _accelListening = true;
    _accelStepCount = 0;
    _lastStepTime = 0;
    window.addEventListener('devicemotion', _onDeviceMotion);
  }

  function _onDeviceMotion(event) {
    var accel = event.accelerationIncludingGravity;
    if (!accel) return;

    // Compute acceleration magnitude
    var magnitude = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
    var gForce = magnitude / 9.81;

    var now = Date.now();

    // Step detection: peak detection with threshold and cooldown
    if (gForce > ACCEL_STEP_THRESHOLD &&
        _lastAccelMagnitude <= ACCEL_STEP_THRESHOLD &&
        (now - _lastStepTime) > ACCEL_STEP_COOLDOWN_MS) {
      _accelStepCount++;
      _lastStepTime = now;

      // Check for 200-step milestone
      if (_accelStepCount % STEPS_PER_HASH_SMALL === 0) {
        _earnMovementHash('trail_steps_200', STEPS_PER_HASH_SMALL);
      }

      // Check for 2000-step milestone
      if (_accelStepCount % STEPS_PER_HASH_LARGE === 0) {
        _earnMovementHash('trail_steps_2000', STEPS_PER_HASH_LARGE);
        if (typeof _movementCallbacks.onMilestone === 'function') {
          _movementCallbacks.onMilestone(_accelStepCount);
        }
      }
    }

    _lastAccelMagnitude = gForce;
  }

  // ============================================================
  // FITNESS API OAUTH BRIDGE FRAMEWORK
  // ============================================================

  /**
   * Import step count from a fitness API (Google Fit, Strava, etc.)
   * This is a framework — actual OAuth flow requires server-side implementation.
   *
   * @param {string} provider - 'google_fit' | 'strava' | 'apple_health'
   * @param {number} stepCount - Steps imported from the provider
   * @param {string} dateStr - Date string (YYYY-MM-DD) for the step data
   */
  function importFitnessSteps(provider, stepCount, dateStr) {
    // Daily cap check
    var today = _getTodayKey();
    if (_fitnessImportDate !== today) {
      _fitnessImportDate = today;
      _fitnessImportCount = 0;
    }

    if (_fitnessImportCount >= FITNESS_DAILY_CAP) {
      return {
        success: false,
        reason: 'daily_cap_reached',
        remaining: 0
      };
    }

    // Calculate hashes earned
    var hashesEarned = Math.min(
      Math.floor(stepCount / FITNESS_STEPS_PER_HASH),
      FITNESS_DAILY_CAP - _fitnessImportCount
    );

    if (hashesEarned <= 0) {
      return {
        success: false,
        reason: 'insufficient_steps',
        stepsNeeded: FITNESS_STEPS_PER_HASH - (stepCount % FITNESS_STEPS_PER_HASH)
      };
    }

    // Earn the hashes
    for (var i = 0; i < hashesEarned; i++) {
      if (typeof window.SWSAttention !== 'undefined') {
        window.SWSAttention.earn('fitness_import', 0, stepCount, 'active');
      }
    }
    _fitnessImportCount += hashesEarned;

    // Log the import to Firestore
    _logFitnessImport(provider, stepCount, hashesEarned, dateStr);

    return {
      success: true,
      hashesEarned: hashesEarned,
      remaining: FITNESS_DAILY_CAP - _fitnessImportCount,
      provider: provider
    };
  }

  /**
   * Get OAuth authorization URL for a fitness provider.
   * Returns URL string that the user should be redirected to.
   * NOTE: Actual OAuth requires server-side token exchange.
   */
  function getFitnessAuthUrl(provider, redirectUri) {
    var urls = {
      google_fit: 'https://accounts.google.com/o/oauth2/v2/auth?' +
        'scope=https://www.googleapis.com/auth/fitness.activity.read' +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&client_id=YOUR_GOOGLE_CLIENT_ID',

      strava: 'https://www.strava.com/oauth/authorize?' +
        'scope=activity:read' +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&client_id=YOUR_STRAVA_CLIENT_ID'
    };

    return urls[provider] || null;
  }

  function _logFitnessImport(provider, steps, hashes, dateStr) {
    if (typeof firebase === 'undefined') return;
    try {
      var user = firebase.auth().currentUser;
      if (!user) return;
      firebase.firestore().collection('vaults').doc(user.uid)
        .collection('fitness_imports').add({
          provider: provider,
          step_count: steps,
          hashes_earned: hashes,
          import_date: dateStr || _getTodayKey(),
          imported_at: Date.now()
        });
    } catch (e) { /* non-critical */ }
  }

  // ============================================================
  // COMMON
  // ============================================================

  function _earnMovementHash(eventType, stepCount) {
    if (typeof window.SWSAttention !== 'undefined') {
      var duration = _gpsStartTime ? Date.now() - _gpsStartTime : 0;
      window.SWSAttention.earn(eventType, duration, stepCount, 'active');
    }
    if (typeof _movementCallbacks.onHashEarned === 'function') {
      _movementCallbacks.onHashEarned(eventType, stepCount);
    }
  }

  function getMovementStats() {
    return {
      gps: {
        active: _gpsWatchId !== null,
        steps: _gpsStepCount,
        distanceMeters: Math.round(_gpsTotalDistance),
        durationMs: _gpsStartTime ? Date.now() - _gpsStartTime : 0
      },
      accelerometer: {
        active: _accelListening,
        steps: _accelStepCount
      },
      fitness: {
        importsToday: _fitnessImportCount,
        remainingToday: FITNESS_DAILY_CAP - _fitnessImportCount
      },
      totalSteps: _gpsStepCount + _accelStepCount
    };
  }

  function _getTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ============================================================
  // EXPORT
  // ============================================================

  window.SWSMovement = {
    startGPSTracking: startGPSTracking,
    stopGPSTracking: stopGPSTracking,
    startAccelerometerTracking: startAccelerometerTracking,
    stopAccelerometerTracking: stopAccelerometerTracking,
    importFitnessSteps: importFitnessSteps,
    getFitnessAuthUrl: getFitnessAuthUrl,
    getMovementStats: getMovementStats
  };

})(window, navigator);
