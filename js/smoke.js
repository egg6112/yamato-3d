// smoke.js — 煙突の煙パーティクル（THREE.Points + カスタムシェーダ）
// 後傾煙突の頂部から放出し、上昇しつつ後方へ流れ、膨張しながら透明化する。
// リアル描画モード専用（ワイヤーフレーム時は controls.js が非表示にする）。
import * as THREE from 'three';

const COUNT = 240;
const EMIT = new THREE.Vector3(-12.9, 27.2, 0); // 煙突頂部（艦ローカル座標）

/** ソフト円形スプライト（放射グラデーション） */
function smokeSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.38)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createSmoke() {
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT * 3);
  const alpha = new Float32Array(COUNT);
  const size = new Float32Array(COUNT);
  const life = new Float32Array(COUNT);   // 0〜1 の正規化寿命
  const dur = new Float32Array(COUNT);    // 寿命（秒）

  function spawn(i, scatter) {
    // 楕円煙突口（半径 2.3 × 1.5）の範囲から放出
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random());
    pos[i * 3] = EMIT.x + Math.cos(a) * 2.3 * r;
    pos[i * 3 + 1] = EMIT.y + Math.random() * 0.8;
    pos[i * 3 + 2] = EMIT.z + Math.sin(a) * 1.5 * r;
    vel[i * 3] = -(1.2 + Math.random() * 1.4);        // 後方へ流れる
    vel[i * 3 + 1] = 2.6 + Math.random() * 2.4;       // 上昇
    vel[i * 3 + 2] = (Math.random() - 0.5) * 0.9;     // 横拡散
    dur[i] = 5 + Math.random() * 4;
    life[i] = scatter ? Math.random() : 0;
    // 起動直後から煙柱が立っているよう、初期化時は寿命分だけ前進させる
    if (scatter) {
      const t = life[i] * dur[i];
      pos[i * 3] += vel[i * 3] * t;
      pos[i * 3 + 1] += vel[i * 3 + 1] * t;
      pos[i * 3 + 2] += vel[i * 3 + 2] * t;
    }
  }
  for (let i = 0; i < COUNT; i++) spawn(i, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: smokeSprite() },
      // ワールドサイズ(m) → ピクセルサイズ変換係数（FOV 45° 前提）
      uPxScale: { value: window.innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(22.5))) },
      uColor: { value: new THREE.Color(0x43474b) },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      attribute float aSize;
      uniform float uPxScale;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPxScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
  });

  window.addEventListener('resize', () => {
    mat.uniforms.uPxScale.value =
      window.innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(22.5)));
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'funnelSmoke';
  points.frustumCulled = false; // 煙柱はエミッタから大きく離れるためカリング無効
  points.renderOrder = 5;       // 海面など不透明物の後に描画

  function update(dt) {
    if (!points.visible) return;
    for (let i = 0; i < COUNT; i++) {
      life[i] += dt / dur[i];
      if (life[i] >= 1) { spawn(i, false); continue; }
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      vel[i * 3] -= 0.25 * dt; // 風で徐々に後方へ加速

      const l = life[i];
      const fadeIn = Math.min(l / 0.12, 1);
      alpha[i] = fadeIn * Math.pow(1 - l, 1.35) * 0.55; // 上昇とともに透明化
      size[i] = 2.4 + 10.5 * l;                          // 膨張
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }

  return { points, update };
}
