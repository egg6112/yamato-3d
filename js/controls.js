// controls.js — OrbitControls 設定と UI（描画モード切替・自動回転）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function setupControls(camera, dom) {
  const c = new OrbitControls(camera, dom);
  c.target.set(0, 9, 0);
  c.enableDamping = true;
  c.dampingFactor = 0.06;
  c.minDistance = 18;
  c.maxDistance = 1500;
  c.maxPolarAngle = 1.54; // 海面下へ潜り込まない程度
  c.autoRotateSpeed = 0.6;
  return c;
}

/**
 * UI（リアル⇔ワイヤーフレーム切替・自動回転・砲塔/砲身アニメ・煙制御）
 */
export function setupUI({ scene, yamato, env, controls, grid, animator, smoke }) {
  const wireMat = new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0x4fd2ff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const wireBg = new THREE.Color(0x071520);

  const btnReal = document.getElementById('btn-real');
  const btnWire = document.getElementById('btn-wire');
  const btnRotate = document.getElementById('btn-rotate');
  const btnTurret = document.getElementById('btn-turret');
  const btnBarrel = document.getElementById('btn-barrel');

  let wireframe = false;
  let turretAnim = false;
  let barrelAnim = false;

  function setMode(wire) {
    if (wire === wireframe) return;
    wireframe = wire;

    yamato.traverse((o) => {
      if (!o.isMesh) return;
      if (wire) {
        o.userData.realMaterial = o.material;
        o.material = wireMat;
      } else if (o.userData.realMaterial) {
        o.material = o.userData.realMaterial;
      }
    });

    // 設計図モード：空・海・霞を消して暗背景＋グリッド
    env.sky.visible = !wire;
    env.water.visible = !wire;
    scene.fog = wire ? null : env.fog;
    scene.background = wire ? wireBg : null;
    grid.visible = wire;
    smoke.points.visible = !wire; // 煙はリアル描画のみ

    btnReal.classList.toggle('active', !wire);
    btnWire.classList.toggle('active', wire);
  }

  btnReal.addEventListener('click', () => setMode(false));
  btnWire.addEventListener('click', () => setMode(true));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') setMode(!wireframe);
  });

  btnRotate.addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    btnRotate.classList.toggle('active', controls.autoRotate);
  });

  // 砲塔旋回アニメーション ON/OFF（OFF 時は現在の角度で停止）
  btnTurret.addEventListener('click', () => {
    turretAnim = !turretAnim;
    animator.setTurretAnim(turretAnim);
    btnTurret.classList.toggle('active', turretAnim);
  });

  // 砲身俯仰アニメーション ON/OFF（旋回とは独立制御）
  btnBarrel.addEventListener('click', () => {
    barrelAnim = !barrelAnim;
    animator.setBarrelAnim(barrelAnim);
    btnBarrel.classList.toggle('active', barrelAnim);
  });

  // ---- 初期状態: ワイヤーフレーム・自動回転・砲塔旋回・砲身俯仰すべて ON ----
  setMode(true);
  controls.autoRotate = true;
  btnRotate.classList.add('active');
  turretAnim = true;
  animator.setTurretAnim(true);
  btnTurret.classList.add('active');
  barrelAnim = true;
  animator.setBarrelAnim(true);
  btnBarrel.classList.add('active');

  return { isWireframe: () => wireframe };
}
