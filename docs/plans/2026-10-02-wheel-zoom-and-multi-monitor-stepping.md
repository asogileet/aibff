# Wheel Zoom Limits & Multi-Monitor Adaptive Floor Height

## Problem Overview
1. **Mouse Wheel Penetrating Avatar**:
   `SceneManager.js` allowed `minDist = 0.15m`, which was smaller than the VRM mesh depth (~0.25m). Rolling the wheel forward placed the camera inside the avatar's head/body, triggering backface culling and making the model completely invisible.
   `RaycastManager.js` failed to invoke `setScale` because it called `this.avatarController.setScale` which threw a `TypeError`.
2. **Avatar Disappearing on Side Monitors / Diagonal Walking**:
   In a multi-monitor layout, the center primary display is 1600px tall, while side monitors are only 1080px tall. The 3D floor `floorY = 0.0m` corresponded to pixel $Y \approx 1450$ on the center screen, which is physically below the 1080p display boundary ($Y > 1080$). Walking onto the left or right monitor caused the avatar to drop into the non-existent screen void.
   Moreover, 3D velocity and drag could drift along the Z-axis, causing diagonal walking in depth.

## Changes
1. **`src/renderer/core/SceneManager.js`**:
   - Limited `minDist = 1.6m` (safe bust portrait) and `maxDist = 4.2m` (safe grounded panoramic full-body).
2. **`src/renderer/vrm/MascotPhysicsController.js`**:
   - Added `setDisplayLayout(layout)` and dynamic `getFloorYAt(x)`.
   - On 1080p side monitors, dynamically elevated floor level by $\sim +0.46\text{m}$, aligning feet with the side monitors' taskbars.
   - Strictly locked Z-axis position and velocity to 0 in 2.5D space.
3. **`src/renderer/core/RaycastManager.js`**:
   - Corrected wheel scaling handler to call `avatarManager.setScale`.
   - Clamped drag Y to `getFloorYAt(targetPos.x)`.
   - Strictly locked Z-axis during drag and throw.
4. **`src/renderer/app.js`**:
   - Propagated multi-monitor display layout to `mascotPhysicsController`.
