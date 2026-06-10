// environment.js — 空（大気散乱）・海面・太陽光・環境マップ
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';

/** タイル可能な海面法線マップを Canvas で生成（外部アセット不要） */
function makeWaterNormals(size = 512) {
  // 整数周波数の正弦波を重ねた高さ場（タイル境界が連続する）
  // 振幅は 1/|f|^1.3 で減衰させ、自然な波スペクトルに近づける
  const waves = [];
  for (let i = 0; i < 24; i++) {
    const a = Math.round((Math.random() * 2 - 1) * 14);
    const b = Math.round((Math.random() * 2 - 1) * 14);
    const f = Math.hypot(a, b);
    if (f < 1.5) { i--; continue; }
    waves.push({
      ka: (a / size) * Math.PI * 2,
      kb: (b / size) * Math.PI * 2,
      amp: 1 / Math.pow(f, 1.3),
      ph: Math.random() * Math.PI * 2,
    });
  }
  const h = (x, y) => {
    let v = 0;
    for (const w of waves) v += w.amp * Math.sin(w.ka * x + w.kb * y + w.ph);
    return v;
  };

  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const S = 22; // 法線の傾き（控えめに：白飛び反射を防ぐ）
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * S;
      const dy = (h(x, y + 1) - h(x, y - 1)) * S;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const k = (y * size + x) * 4;
      img.data[k] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[k + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[k + 2] = inv * 255;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createEnvironment(scene, renderer) {
  // ---- 遠景の霞 ----
  const fog = new THREE.Fog(0xaec6d8, 2400, 13000);
  scene.fog = fog;

  // ---- 空（Rayleigh / Mie 散乱モデル） ----
  const sky = new Sky();
  sky.scale.setScalar(20000);
  const su = sky.material.uniforms;
  su.turbidity.value = 3.5;
  su.rayleigh.value = 3.0;
  su.mieCoefficient.value = 0.003;
  su.mieDirectionalG.value = 0.85;

  // 太陽位置（仰角 25°・方位 132°）
  const sun = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - 25),
    THREE.MathUtils.degToRad(132),
  );
  su.sunPosition.value.copy(sun);

  // ---- 環境マップ（空を PMREM 化 → 金属反射に使用） ----
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(sky);
  scene.environment = pmrem.fromScene(envScene).texture;
  scene.add(sky); // PMREM 後に本シーンへ戻す

  // ---- 海面 ----
  const waterNormals = makeWaterNormals();
  const water = new Water(new THREE.PlaneGeometry(14000, 14000), {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals,
    sunDirection: sun.clone(),
    sunColor: 0xffffff,
    waterColor: 0x06343c,
    distortionScale: 2.2,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.material.uniforms.size.value = 0.8; // 波のスケール（大きめのうねり）

  // 標準 Water シェーダは常時 30% 空を反射して海が白くなるため、
  // ベース反射率を下げて深い海色を出す
  water.material.fragmentShader =
    water.material.fragmentShader.replace('rf0 = 0.3', 'rf0 = 0.1');
  water.material.needsUpdate = true;
  scene.add(water);

  // ---- 太陽光（影付き） ----
  const sunLight = new THREE.DirectionalLight(0xfff1da, 2.8);
  sunLight.position.copy(sun).multiplyScalar(1200);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(4096, 4096);
  const sc = sunLight.shadow.camera;
  sc.left = -180; sc.right = 180;
  sc.top = 120; sc.bottom = -60;
  sc.near = 600; sc.far = 2200;
  sunLight.shadow.bias = -0.0002;
  sunLight.shadow.normalBias = 0.6;
  sunLight.target.position.set(0, 0, 0);
  scene.add(sunLight, sunLight.target);

  // ---- 空からの拡散光 ----
  const hemi = new THREE.HemisphereLight(0xbed3e4, 0x16242e, 0.5);
  scene.add(hemi);

  return {
    sky, water, sunLight, hemi, fog,
    update(dt) {
      water.material.uniforms.time.value += dt * 0.55;
    },
  };
}
