/**
 * Shared loader for MediaPipe Tasks Vision (hand / pose / face landmarkers).
 *
 * Every tracker must go through this one library. The legacy MediaPipe
 * "solutions" scripts (e.g. @mediapipe/hands) claim the same global Emscripten
 * `Module`, and mixing them with Tasks Vision in one page aborts the WASM runtime.
 */

const WASM_PATH = '../../node_modules/@mediapipe/tasks-vision/wasm';
// The classic-script build (exposes window.Vision). The package's ES module is a
// .mjs file, which some static servers send as text/plain and browsers then refuse.
const VISION_SCRIPT = '../../node_modules/@mediapipe/tasks-vision/vision_bundle.js';
const MODEL_CDN = 'https://storage.googleapis.com/mediapipe-models';

// Model files are looked up locally first (offline use), then on Google's model CDN.
export const MODEL_SOURCES = {
  pose: [
    '../../assets/mediapipe/pose_landmarker_full.task',
    `${MODEL_CDN}/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task`
  ],
  face: [
    '../../assets/mediapipe/face_landmarker.task',
    `${MODEL_CDN}/face_landmarker/face_landmarker/float16/latest/face_landmarker.task`
  ],
  hand: [
    '../../assets/mediapipe/hand_landmarker.task',
    `${MODEL_CDN}/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`
  ]
};

let visionPromise = null;

function loadVisionScript() {
  if (window.Vision) return Promise.resolve(window.Vision);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = VISION_SCRIPT;
    script.onload = () => (window.Vision ? resolve(window.Vision) : reject(new Error('MediaPipe Vision failed to initialise')));
    script.onerror = () => reject(new Error('Failed to load MediaPipe Vision library'));
    document.head.appendChild(script);
  });
}

/**
 * @returns {Promise<{ vision: Object, fileset: Object }>} The library namespace and its WASM fileset
 */
export function loadVision() {
  if (!visionPromise) {
    visionPromise = (async () => {
      const vision = await loadVisionScript();
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
      return { vision, fileset };
    })();
    // Allow a retry after a failed load
    visionPromise.catch(() => { visionPromise = null; });
  }
  return visionPromise;
}

/**
 * Tries each model location, preferring the GPU delegate and falling back to CPU.
 * @param {string[]} sources Model paths / URLs in order of preference
 * @param {(modelAssetPath: string, delegate: string) => Promise<Object>} create
 */
export async function createWithFallback(sources, create) {
  let lastError = null;
  for (const source of sources) {
    for (const delegate of ['GPU', 'CPU']) {
      try {
        return await create(source, delegate);
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError || new Error('No model source available');
}
