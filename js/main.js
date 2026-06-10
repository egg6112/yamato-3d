// main.js — シーン統括・レンダリングループ
import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { createEnvironment } from './environment.js';
import { buildYamato } from './yamato/index.js';
import { setupControls, setupUI } from './controls.js';

/* ---- レンダラ ---- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.4;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

/* ---- シーン・カメラ ---- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 0.5, 30000);
camera.position.set(175, 55, 235);

/* ---- 環境（空・海・光） ---- */
const env = createEnvironment(scene, renderer);

/* ---- 戦艦大和 ---- */
const materials = createMaterials();
const yamato = buildYamato(materials);
scene.add(yamato);

/* ---- 設計図モード用グリッド ---- */
const grid = new THREE.GridHelper(800, 80, 0x1c4e6e, 0x0e2c42);
grid.visible = false;
scene.add(grid);

/* ---- 操作・UI ---- */
const controls = setupControls(camera, renderer.domElement);
setupUI({ scene, yamato, env, controls, grid });

/* ---- リサイズ ---- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// デバッグ・検証用フック
window.__yamato = { camera, controls, scene, renderer, yamato };

/* ---- ループ ---- */
const clock = new THREE.Clock();
let firstFrame = true;

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  env.update(dt);

  // 微小な動揺（停泊中の艦のゆらぎ）
  yamato.position.y = Math.sin(t * 0.5) * 0.16;
  yamato.rotation.x = Math.sin(t * 0.38) * 0.0035;
  yamato.rotation.z = Math.sin(t * 0.31) * 0.005;

  controls.update();
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loading').classList.add('hidden');
    const stat = document.getElementById('stat');
    stat.textContent = `三角形数: ${renderer.info.render.triangles.toLocaleString()}`;
  }
});
