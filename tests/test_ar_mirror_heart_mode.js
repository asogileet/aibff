/**
 * test_ar_mirror_heart_mode.js
 * Unit test verifying AR motion detection mirror toggle, face-to-face heart interaction,
 * HandTracker coordinate mapping, and MotionCaptureController retargeting.
 */

const assert = require('assert');

// Mock window & document for headless testing of UI and math components
global.window = {
  innerWidth: 1000,
  innerHeight: 800,
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.document = {
  createElement: (tag) => {
    return {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      style: {},
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      },
      innerHTML: '',
      _childrenMap: new Map(),
      querySelector: function(selector) {
        if (!this._childrenMap.has(selector)) {
          this._childrenMap.set(selector, {
            id: selector.replace(/[#.]/g, ''),
            textContent: '',
            title: '',
            style: {},
            classList: {
              add: () => {},
              remove: () => {},
              toggle: () => {},
              contains: () => false
            },
            addEventListener: () => {}
          });
        }
        return this._childrenMap.get(selector);
      },
      querySelectorAll: () => [],
      appendChild: () => {},
      addEventListener: () => {}
    };
  },
  body: {
    prepend: () => {},
    appendChild: () => {}
  },
  addEventListener: () => {}
};
global.performance = {
  now: () => Date.now()
};

async function runTests() {
  console.log('--- Starting AR Motion Mirror & Face-to-Face Heart Mode Verification ---');

  // Test 1: HandTracker Mirror Coordinate Mapping
  console.log('\n[Test 1] HandTracker Mirror & Direct Coordinate Mapping');
  const { HandTracker } = await import('../src/renderer/core/HandTracker.js');
  let receivedUpdate = null;
  const tracker = new HandTracker({
    onHandUpdate: (update) => {
      receivedUpdate = update;
    }
  });

  // Default should be isMirror === true (selfie mirror)
  assert.strictEqual(tracker.isMirror, true, 'HandTracker default isMirror should be true');

  // Simulate MediaPipe results in mirror mode
  tracker.isCameraTracking = true;
  tracker._onMediaPipeResults({
    landmarks: [
      {
        8: { x: 0.2, y: 0.5 }, // Index tip
        4: { x: 0.2, y: 0.51 } // Thumb tip (pinch)
      }
    ]
  });

  assert(receivedUpdate !== null, 'Hand update should be emitted');
  assert.strictEqual(receivedUpdate.hands.length, 1);
  // With isMirror = true: screenX = (1 - 0.2) * 1000 = 800
  assert.strictEqual(receivedUpdate.hands[0].x, 800, 'Mirrored screenX should be 800');

  // Switch to face-to-face (isMirror = false)
  tracker.setMirror(false);
  assert.strictEqual(tracker.isMirror, false, 'isMirror should be toggled to false');

  tracker._onMediaPipeResults({
    landmarks: [
      {
        8: { x: 0.2, y: 0.5 },
        4: { x: 0.2, y: 0.51 }
      }
    ]
  });
  // With isMirror = false: screenX = 0.2 * 1000 = 200
  assert.strictEqual(receivedUpdate.hands[0].x, 200, 'Direct screenX should be 200');
  console.log('✓ HandTracker mirror coordinates verified (800 in mirror vs 200 in direct)');

  // Test 2: MotionCaptureController Mirror Retargeting & Heart Detection
  console.log('\n[Test 2] MotionCaptureController Mirror State & Heart Gesture Detection');
  const { MotionCaptureController } = await import('../src/renderer/vrm/MotionCaptureController.js');

  let heartDetectedEvent = null;
  const mocap = new MotionCaptureController(
    { getCurrentVRM: () => null },
    {},
    {
      onHeartDetected: (event) => {
        heartDetectedEvent = event;
      }
    }
  );

  assert.strictEqual(mocap.isMirror, true, 'MotionCaptureController default isMirror should be true');

  // Toggle to direct and back to Face-to-Face mirror mode
  mocap.setMirror(false);
  assert.strictEqual(mocap.isMirror, false, 'MotionCaptureController isMirror should toggle to false');
  mocap.setMirror(true);
  assert.strictEqual(mocap.isMirror, true, 'MotionCaptureController isMirror should toggle back to true');

  // Test face-to-face single arm heart gesture detection
  const LM = {
    nose: 0,
    leftShoulder: 11, rightShoulder: 12,
    leftElbow: 13, rightElbow: 14,
    leftWrist: 15, rightWrist: 16
  };

  // Mock pose image: user arches right wrist near midline, elbow flared out
  const mockHeartPoseImage = [];
  mockHeartPoseImage[LM.nose] = { x: 0.5, y: 0.2, visibility: 0.9 };
  mockHeartPoseImage[LM.leftShoulder] = { x: 0.6, y: 0.4, visibility: 0.9 };
  mockHeartPoseImage[LM.rightShoulder] = { x: 0.4, y: 0.4, visibility: 0.9 };
  mockHeartPoseImage[LM.rightElbow] = { x: 0.25, y: 0.35, visibility: 0.9 }; // Elbow out to the right
  mockHeartPoseImage[LM.rightWrist] = { x: 0.45, y: 0.25, visibility: 0.9 }; // Wrist raised near nose center
  mockHeartPoseImage[LM.leftElbow] = { x: 0.65, y: 0.7, visibility: 0.9 };
  mockHeartPoseImage[LM.leftWrist] = { x: 0.65, y: 0.8, visibility: 0.9 };

  mocap._checkHeartGesture(mockHeartPoseImage);
  assert(heartDetectedEvent !== null, 'Single arm face-to-face heart gesture should be detected');
  assert.strictEqual(heartDetectedEvent.type, 'single');
  assert.strictEqual(heartDetectedEvent.isFaceToFace, true);
  console.log('✓ Face-to-Face heart gesture detection triggered successfully');

  // Test dual hands heart gesture
  mocap._lastHeartTime = 0; // Reset cooldown
  heartDetectedEvent = null;
  mockHeartPoseImage[LM.leftElbow] = { x: 0.75, y: 0.35, visibility: 0.9 };
  mockHeartPoseImage[LM.leftWrist] = { x: 0.52, y: 0.25, visibility: 0.9 }; // Left wrist close to right wrist (0.45)
  mocap._checkHeartGesture(mockHeartPoseImage);
  assert(heartDetectedEvent !== null, 'Dual hands heart gesture should be detected');
  assert.strictEqual(heartDetectedEvent.type, 'dual');
  console.log('✓ Dual hands heart gesture detection triggered successfully');

  // Test 3: PuppetPoseBar setMirrorState
  console.log('\n[Test 3] PuppetPoseBar & Toolbar Mirror Mode UI Elements');
  const { PuppetPoseBar } = await import('../src/renderer/ui/PuppetPoseBar.js');
  let mirrorToggled = false;
  const mockContainer = global.document.createElement('div');
  const poseBar = new PuppetPoseBar(
    mockContainer,
    { keepPoseOnRelease: true },
    {},
    {},
    () => {},
    null,
    null,
    {
      onToggleMirror: () => { mirrorToggled = true; }
    }
  );

  const mirrorBtn = poseBar.element.querySelector('#btnToggleMirror');
  assert(mirrorBtn !== null, 'PuppetPoseBar should render #btnToggleMirror');
  poseBar.setMirrorState(false);
  assert.strictEqual(poseBar.isMirror, false);
  poseBar.setMirrorState(true);
  assert.strictEqual(poseBar.isMirror, true);
  console.log('✓ PuppetPoseBar mirror button and state updates verified');

  // Test 4: Toolbar setMirrorState
  const { Toolbar } = await import('../src/renderer/ui/Toolbar.js');
  let toolbarMirrorToggled = false;
  const toolbar = new Toolbar(mockContainer, {
    onMirror: () => { toolbarMirrorToggled = true; }
  });
  const tbMirrorBtn = toolbar.element.querySelector('#btnMirror');
  const tbIcon = toolbar.element.querySelector('#iconToolbarMirror');
  const tbText = toolbar.element.querySelector('#textToolbarMirror');
  assert(tbMirrorBtn !== null, 'Toolbar should render #btnMirror');

  toolbar.setMirrorState(true);
  assert.strictEqual(tbText.textContent, '面對面', 'Mirror=true should display 面對面');
  assert.strictEqual(tbIcon.textContent, '❤️', 'Mirror=true should display heart icon');

  toolbar.setMirrorState(false);
  assert.strictEqual(tbText.textContent, '同步', 'Mirror=false should display 同步');
  assert.strictEqual(tbIcon.textContent, '🪞', 'Mirror=false should display mirror icon');
  console.log('✓ Toolbar mirror button text and icons verified (面對面 in mirror vs 同步 in direct)');

  // Test 5: Magic Mirror Interactive Behaviors (Kiss, Head Touch, Touch Screen, Half-Heart)
  console.log('\n[Test 5] Magic Mirror Interactive Behaviors (Kiss, Head Touch, Touch Screen, Half Heart)');
  let mirrorInteractionEvent = null;
  const THREE = await import('three');
  const mockAvatar = {
    getCurrentVRM: () => ({
      humanoid: {
        getNormalizedBoneNode: (name) => ({
          name,
          position: new THREE.Vector3(name.includes('left') ? 0.3 : -0.3, 0, 0),
          quaternion: new THREE.Quaternion(),
          parent: null
        })
      },
      scene: {
        position: new THREE.Vector3(0, 0, 0)
      },
      expressionManager: {
        setValue: () => {},
        getValue: () => 0
      }
    })
  };

  const interactiveMocap = new MotionCaptureController(
    mockAvatar,
    {},
    {
      onMirrorInteraction: (event) => {
        mirrorInteractionEvent = event;
      }
    }
  );
  interactiveMocap.setEnabled(true);

  // 5a. Proximity Leaning & Kiss ("親螢幕")
  // User leans close to camera: wide shoulders (dist > 0.45)
  const leanPose = {
    world: Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.9 }),
    image: Array(33).fill({ x: 0.5, y: 0.5, visibility: 0.9 })
  };
  leanPose.image[LM.leftShoulder] = { x: 0.75, y: 0.5, visibility: 0.9 };
  leanPose.image[LM.rightShoulder] = { x: 0.25, y: 0.5, visibility: 0.9 }; // shoulderDist = 0.50
  leanPose.image[LM.nose] = { x: 0.5, y: 0.3, visibility: 0.9 };
  leanPose.image[LM.rightWrist] = { x: 0.25, y: 0.9, visibility: 0.9 };
  leanPose.image[LM.leftWrist] = { x: 0.75, y: 0.9, visibility: 0.9 };

  interactiveMocap.applyResults({ pose: leanPose });
  assert.strictEqual(interactiveMocap.isKissing, true, 'isKissing should be true when leaning close');
  assert(interactiveMocap.targetScenePos.z > 0.45, 'Avatar targetScenePos.z should move forward (>0.45m)');
  assert(mirrorInteractionEvent !== null && mirrorInteractionEvent.type === 'kiss', 'Kiss event should be triggered');
  console.log('✓ Proximity lean & screen kissing ("親螢幕") verified (Z forward + kiss event)');

  // 5b. Head-to-Head Touching ("比肩頭碰頭")
  interactiveMocap._lastInteractionTime = 0;
  mirrorInteractionEvent = null;
  // Tilt head sideways and lean close (nose shifted relative to shoulders, shoulderDist > 0.33)
  leanPose.image[LM.leftShoulder] = { x: 0.68, y: 0.5, visibility: 0.9 };
  leanPose.image[LM.rightShoulder] = { x: 0.32, y: 0.5, visibility: 0.9 }; // shoulderDist = 0.36 -> leanRatio = 0.40 > 0.25
  leanPose.image[LM.nose] = { x: 0.58, y: 0.35, visibility: 0.9 }; // headOffset = 0.58 - 0.50 = +0.08 > 0.055

  interactiveMocap.applyResults({ pose: leanPose });
  assert.strictEqual(interactiveMocap.isHeadTouching, true, 'isHeadTouching should be true when head is tilted close');
  assert(interactiveMocap.targetScenePos.x !== 0, 'Avatar targetScenePos.x should laterally glide towards user head');
  assert(mirrorInteractionEvent !== null && mirrorInteractionEvent.type === 'head_touch', 'Head touch event should be triggered');
  console.log('✓ Head-to-Head lateral glide ("比肩頭碰頭") verified (X slide + head_touch event)');

  // 5c. Screen Touching ("手往螢幕 她的手也往螢幕")
  interactiveMocap._lastInteractionTime = 0;
  mirrorInteractionEvent = null;
  const touchPose = {
    world: Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.9 }),
    image: Array(33).fill({ x: 0.5, y: 0.5, visibility: 0.9 })
  };
  touchPose.world[LM.leftShoulder] = { x: 0.2, y: 0, z: 0, visibility: 0.9 };
  touchPose.world[LM.rightShoulder] = { x: -0.2, y: 0, z: 0, visibility: 0.9 };
  // Push right wrist forward towards camera: z is -0.30m relative to shoulder
  touchPose.world[LM.rightWrist] = { x: -0.15, y: 0.05, z: -0.30, visibility: 0.9 };
  touchPose.world[LM.leftWrist] = { x: 0.2, y: 0.6, z: 0.0, visibility: 0.9 };

  interactiveMocap.applyResults({ pose: touchPose });
  assert.strictEqual(interactiveMocap.isTouchingScreen, true, 'isTouchingScreen should be true when wrist extended forward');
  assert(mirrorInteractionEvent !== null && mirrorInteractionEvent.type === 'touch_screen', 'Touch screen event should be triggered');
  console.log('✓ Palm flat against screen glass ("手往螢幕 她的手也往螢幕") verified');

  // 5d. Half-Heart Completion ("我比一半愛心 人偶用另一手補齊拼出大愛心")
  interactiveMocap._lastInteractionTime = 0;
  interactiveMocap._lastHeartTime = 0;
  mirrorInteractionEvent = null;
  const halfHeartPose = {
    world: Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.9 }),
    image: Array(33).fill({ x: 0.5, y: 0.5, visibility: 0.9 })
  };
  halfHeartPose.image[LM.nose] = { x: 0.5, y: 0.3, visibility: 0.9 };
  halfHeartPose.image[LM.leftShoulder] = { x: 0.65, y: 0.45, visibility: 0.9 };
  halfHeartPose.image[LM.rightShoulder] = { x: 0.35, y: 0.45, visibility: 0.9 };
  // User forms half heart with right hand on right side of image (>0.5)
  halfHeartPose.image[LM.rightWrist] = { x: 0.48, y: 0.30, visibility: 0.9 };
  halfHeartPose.image[LM.rightElbow] = { x: 0.22, y: 0.40, visibility: 0.9 }; // elbow out
  halfHeartPose.image[LM.leftWrist] = { x: 0.70, y: 0.85, visibility: 0.9 }; // left arm down

  interactiveMocap.applyResults({ pose: halfHeartPose });
  assert(interactiveMocap._activeComplementHeartSide !== null, 'Complement heart side should be activated');
  assert(mirrorInteractionEvent !== null && mirrorInteractionEvent.type === 'half_heart', 'Half heart event should be triggered');
  console.log(`✓ Half-heart completion verified (avatar complements with ${interactiveMocap._activeComplementHeartSide} arm)`);

  // 5e. Side-by-side Non-overlapping Positioning (你在左她在右，你在右她在左)
  // When user is on the left of screen: in mirror mode, userRawX > 0.5 means screenX = (1 - 0.75) = 0.25 (left)
  const userOnLeftPose = {
    world: Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.9 }),
    image: Array(33).fill({ x: 0.75, y: 0.5, visibility: 0.9 })
  };
  userOnLeftPose.image[LM.nose] = { x: 0.75, y: 0.3, visibility: 0.9 };
  userOnLeftPose.image[LM.leftShoulder] = { x: 0.85, y: 0.5, visibility: 0.9 };
  userOnLeftPose.image[LM.rightShoulder] = { x: 0.65, y: 0.5, visibility: 0.9 };
  userOnLeftPose.image[LM.rightWrist] = { x: 0.65, y: 0.8, visibility: 0.9 };
  userOnLeftPose.image[LM.leftWrist] = { x: 0.85, y: 0.8, visibility: 0.9 };

  interactiveMocap.applyResults({ pose: userOnLeftPose });
  assert(interactiveMocap.targetScenePos.x > 0.3, `Avatar should stand on the right (+X) when user is on the left. Actual: ${interactiveMocap.targetScenePos.x}`);
  console.log(`✓ Non-overlap verified: User on left (screenX=0.25) -> Avatar stands on right (X=${interactiveMocap.targetScenePos.x.toFixed(2)}m)`);

  // When user is on the right of screen: userRawX < 0.5 means screenX = (1 - 0.25) = 0.75 (right)
  const userOnRightPose = {
    world: Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.9 }),
    image: Array(33).fill({ x: 0.25, y: 0.5, visibility: 0.9 })
  };
  userOnRightPose.image[LM.nose] = { x: 0.25, y: 0.3, visibility: 0.9 };
  userOnRightPose.image[LM.leftShoulder] = { x: 0.35, y: 0.5, visibility: 0.9 };
  userOnRightPose.image[LM.rightShoulder] = { x: 0.15, y: 0.5, visibility: 0.9 };
  userOnRightPose.image[LM.rightWrist] = { x: 0.15, y: 0.8, visibility: 0.9 };
  userOnRightPose.image[LM.leftWrist] = { x: 0.35, y: 0.8, visibility: 0.9 };

  interactiveMocap.applyResults({ pose: userOnRightPose });
  assert(interactiveMocap.targetScenePos.x < -0.3, `Avatar should stand on the left (-X) when user is on the right. Actual: ${interactiveMocap.targetScenePos.x}`);
  console.log(`✓ Non-overlap verified: User on right (screenX=0.75) -> Avatar stands on left (X=${interactiveMocap.targetScenePos.x.toFixed(2)}m)`);

  // 5f. Face-to-Face Facing Direction (人偶在左向右轉面對我，人偶在右向左轉面對我，相向面對面)
  interactiveMocap._lastBodyTime = performance.now();
  interactiveMocap.targetScenePos.x = -0.48;
  const mockScene = {
    position: new THREE.Vector3(-0.48, 0, 0),
    rotation: new THREE.Euler(0, Math.PI, 0)
  };
  mockAvatar.getCurrentVRM = () => ({
    humanoid: {
      getNormalizedBoneNode: (name) => ({
        name,
        position: new THREE.Vector3(name.includes('left') ? 0.3 : -0.3, 0, 0),
        quaternion: new THREE.Quaternion(),
        parent: null
      })
    },
    scene: mockScene,
    expressionManager: { setValue: () => {}, getValue: () => 0 }
  });

  // Run update steps:
  for (let step = 0; step < 25; step++) {
    interactiveMocap._lastBodyTime = performance.now();
    interactiveMocap.update(0.033);
  }
  // Avatar on left should face towards screen-right (+X, towards user):
  const fwdLeft = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), mockScene.rotation.y);
  assert(fwdLeft.x > 0.4, `Avatar on left should turn towards user (+X). Actual fwd.x: ${fwdLeft.x}`);
  console.log(`✓ Avatar on left faces screen-right (+X) towards user: fwd.x = ${fwdLeft.x.toFixed(2)}`);

  // Simulate avatar standing on right (user on left):
  interactiveMocap.targetScenePos.x = 0.48;
  mockScene.position.x = 0.48;
  for (let step = 0; step < 25; step++) {
    interactiveMocap._lastBodyTime = performance.now();
    interactiveMocap.update(0.033);
  }
  // Avatar on right should face towards screen-left (-X, towards user):
  const fwdRight = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), mockScene.rotation.y);
  assert(fwdRight.x < -0.4, `Avatar on right should turn towards user (-X). Actual fwd.x: ${fwdRight.x}`);
  console.log(`✓ Avatar on right faces screen-left (-X) towards user: fwd.x = ${fwdRight.x.toFixed(2)}`);
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
