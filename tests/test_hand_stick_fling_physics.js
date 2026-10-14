/**
 * test_hand_stick_fling_physics.js
 * Unit test for:
 * 1. Hand detection & avatar sticking to hand (人偶黏到手)
 * 2. Flinging avatar across the screen with impulse velocity (甩出去)
 * 3. 4-Border screen physics collisions & bouncing (螢幕邊緣反彈)
 * 4. Adjustable bounciness (可調整彈力) & BouncinessModal UI
 */

const assert = require('assert');
const THREE = require('three');

// Mock browser globals
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
            value: '0.75',
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
    appendChild: () => {}
  }
};
global.performance = {
  now: () => Date.now()
};

async function runTests() {
  console.log('--- Starting Hand Sticking, Flinging & Collision Bounce Physics Tests ---');

  // Setup Mock Three.js Scene and Camera
  const camera = new THREE.PerspectiveCamera(30, 1000 / 800, 0.1, 20);
  camera.position.set(0, 1.25, 2.5);
  camera.lookAt(0, 1.25, 0);

  const sceneManager = {
    camera,
    currentCameraDist: 2.5
  };

  // Mock Avatar Slot
  const mockSlot = {
    title: '愛麗絲',
    costumeKey: 'casual',
    scale: 1.0,
    physicsState: 'idle',
    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    vrm: {
      scene: {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Euler(0, Math.PI, 0)
      },
      humanoid: {
        getNormalizedBoneNode: () => null
      }
    }
  };

  const avatarManager = {
    activeIndex: 0,
    slots: [mockSlot],
    getActiveSlot: () => mockSlot,
    getAllSlots: () => [mockSlot],
    updateSelectionRing: () => {}
  };

  const { MascotPhysicsController } = await import('../src/renderer/vrm/MascotPhysicsController.js');

  let grabEvent = null;
  let flingEvent = null;
  let wallBounceEvents = [];

  const physics = new MascotPhysicsController(sceneManager, avatarManager, {
    bounciness: 0.75,
    onHandGrab: (slot) => {
      grabEvent = slot;
    },
    onHandFling: (slot, speed) => {
      flingEvent = { slot, speed };
    },
    onWallBounce: (slot, side, speed) => {
      wallBounceEvents.push({ slot, side, speed });
    }
  });

  // [Test 1] 2D Screen to 3D Plane Unprojection
  console.log('\n[Test 1] Screen to 3D Z=0 Plane Unprojection');
  const center3D = physics.unprojectTo3D(500, 400); // Screen center (width=1000, height=800)
  assert(Math.abs(center3D.x) < 0.05, `Center X should be ~0, actual: ${center3D.x}`);
  assert(Math.abs(center3D.y - 1.25) < 0.05, `Center Y should be ~1.25, actual: ${center3D.y}`);
  assert.strictEqual(center3D.z, 0, 'Center Z must be exactly 0 on 2.5D plane');
  console.log(`✓ Unprojected screen center (500, 400) -> 3D (${center3D.x.toFixed(2)}, ${center3D.y.toFixed(2)}, ${center3D.z})`);

  // [Test 2] Hand Proximity Detection & Avatar Sticking (人偶黏到手)
  console.log('\n[Test 2] Hand Proximity & Avatar Sticking (人偶黏手)');
  mockSlot.physicsState = 'idle';
  mockSlot.vrm.scene.position.set(0, 0.5, 0); // Avatar center around y = 0.5 + 0.65 = 1.15
  mockSlot.position.set(0, 0.5, 0);

  // Position hand right near the avatar center (500, 430)
  physics.handleHandUpdate({
    x: 500,
    y: 430,
    isPinching: false,
    isHandDetected: true,
    hands: [{ x: 500, y: 430, isPinching: false }]
  });

  assert.strictEqual(physics.isHandGrabbed, true, 'isHandGrabbed should be true when hand is near avatar');
  assert.strictEqual(mockSlot.physicsState, 'grabbed', 'Avatar physicsState should become grabbed');
  assert(grabEvent !== null, 'onHandGrab callback should be triggered');
  console.log('✓ Avatar successfully stuck to hand when user hand approaches!');

  // [Test 3] Moving Hand & Flinging Avatar (手部揮動甩出人偶)
  console.log('\n[Test 3] Hand Movement & Rapid Fling (甩飛人偶)');
  // Move hand rapidly to the right (speed > 2.5 m/s)
  physics.handleHandUpdate({
    x: 550,
    y: 400,
    isPinching: false,
    isHandDetected: true,
    hands: [{ x: 550, y: 400, isPinching: false }]
  });

  // Rapid swing upward and to the right
  physics.handleHandUpdate({
    x: 750,
    y: 200,
    isPinching: false,
    isHandDetected: true,
    hands: [{ x: 750, y: 200, isPinching: false }]
  });

  assert.strictEqual(physics.isHandGrabbed, false, 'Avatar should be released/flung after rapid hand flick');
  assert.strictEqual(mockSlot.physicsState, 'falling', 'Avatar physicsState should become falling');
  assert(flingEvent !== null, 'onHandFling callback should be triggered');
  assert(mockSlot.velocity.x > 0.5, `Avatar velocity.x should be positive (thrown right). Actual: ${mockSlot.velocity.x}`);
  assert(mockSlot.velocity.y > 0.5, `Avatar velocity.y should be positive (thrown up). Actual: ${mockSlot.velocity.y}`);
  console.log(`✓ Avatar flung into the air! Velocity: (${mockSlot.velocity.x.toFixed(2)}, ${mockSlot.velocity.y.toFixed(2)}) m/s`);

  // [Test 4] 4-Border Screen Collision & Bouncing (螢幕四邊物理反彈)
  console.log('\n[Test 4] 4-Border Screen Collision & Bouncing');
  physics.setBounciness(0.80);
  assert.strictEqual(physics.getBounciness(), 0.80, 'Bounciness should be 0.80');

  // 4a. Right Screen Border Bounce
  wallBounceEvents = [];
  mockSlot.physicsState = 'falling';
  mockSlot.vrm.scene.position.set(1.5, 1.25, 0); // Position near right edge (NDC.x >= 0.88)
  mockSlot.velocity.set(4.0, 0, 0); // Moving right

  physics.update(0.016);
  assert(mockSlot.velocity.x < 0, `Velocity X should rebound left (< 0). Actual: ${mockSlot.velocity.x}`);
  assert(wallBounceEvents.some(e => e.side === 'right'), 'Right wall bounce event should be recorded');
  console.log(`✓ Right screen border bounce verified: Rebound velocity X = ${mockSlot.velocity.x.toFixed(2)}`);

  // 4b. Left Screen Border Bounce
  wallBounceEvents = [];
  physics._lastWallBounceTime = 0;
  mockSlot.physicsState = 'falling';
  mockSlot.vrm.scene.position.set(-1.5, 1.25, 0); // Position near left edge (NDC.x <= -0.88)
  mockSlot.velocity.set(-4.0, 0, 0); // Moving left

  physics.update(0.016);
  assert(mockSlot.velocity.x > 0, `Velocity X should rebound right (> 0). Actual: ${mockSlot.velocity.x}`);
  assert(wallBounceEvents.some(e => e.side === 'left'), 'Left wall bounce event should be recorded');
  console.log(`✓ Left screen border bounce verified: Rebound velocity X = ${mockSlot.velocity.x.toFixed(2)}`);

  // 4c. Top Ceiling Bounce
  wallBounceEvents = [];
  physics._lastWallBounceTime = 0;
  mockSlot.physicsState = 'falling';
  mockSlot.vrm.scene.position.set(0, 2.2, 0); // Position near top ceiling (NDC.y >= 0.88)
  mockSlot.velocity.set(0, 5.0, 0); // Moving up

  physics.update(0.016);
  assert(mockSlot.velocity.y < 0, `Velocity Y should rebound down (< 0). Actual: ${mockSlot.velocity.y}`);
  assert(wallBounceEvents.some(e => e.side === 'top'), 'Top ceiling bounce event should be recorded');
  console.log(`✓ Top screen border (ceiling) bounce verified: Rebound velocity Y = ${mockSlot.velocity.y.toFixed(2)}`);

  // 4d. Floor Bounce
  wallBounceEvents = [];
  physics._lastWallBounceTime = 0;
  mockSlot.physicsState = 'falling';
  mockSlot.vrm.scene.position.set(0, -0.05, 0); // Below floor Y (0.0)
  mockSlot.velocity.set(0, -3.0, 0); // Falling down

  physics.update(0.016);
  assert(mockSlot.velocity.y > 0, `Velocity Y should rebound upward (> 0). Actual: ${mockSlot.velocity.y}`);
  assert.strictEqual(mockSlot.vrm.scene.position.y, 0.0, 'Position Y should be clamped to floor level');
  console.log(`✓ Floor bounce verified: Rebound velocity Y = ${mockSlot.velocity.y.toFixed(2)}`);

  // [Test 5] Bounciness Adjustment & UI Modal (調整彈力)
  console.log('\n[Test 5] Bounciness Adjustment & UI Modal');
  const { BouncinessModal } = await import('../src/renderer/ui/BouncinessModal.js');
  const modalContainer = document.createElement('div');
  let bubbleShown = null;

  const bouncinessModal = new BouncinessModal(modalContainer, physics, (msg) => {
    bubbleShown = msg;
  });

  // Test setBounciness
  bouncinessModal.setBounciness(0.95, true);
  assert.strictEqual(physics.getBounciness(), 0.95, 'Bounciness should update to 0.95');
  assert(bubbleShown !== null && bubbleShown.includes('95%'), 'Bubble should notify user of bounciness change');

  // Test zero bounciness (clay mode)
  bouncinessModal.setBounciness(0.0, true);
  assert.strictEqual(physics.getBounciness(), 0.0, 'Bounciness should be 0.0 (clay mode)');

  // Test super bounce
  bouncinessModal.setBounciness(1.15, false);
  assert.strictEqual(physics.getBounciness(), 1.15, 'Bounciness should support 1.15 super bounce');
  console.log('✓ Bounciness dynamically adjustable from 0.0 to 1.15 with instant feedback!');

  console.log('\n--- ALL HAND STICKING, FLINGING & BOUNCING TESTS PASSED! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
