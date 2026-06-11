// wake.js — 前進走航の水面エフェクト
// ・スクリュー後流の気泡: 4 軸スクリュー位置から発生 → 浮上 → 水面で白い泡となり
//   後方へ流れながら消える（水面下は海面シェーダに隠れるため浮上後に可視化）
// ・艦首の波切り飛沫: 船首水線から左右 V 字に飛散し、放物線を描いて落水
// ・航跡プレーン: 舷側 V 字航跡 ×2 ＋ 艦尾航跡 ×1（UV スクロールする白泡シェーダ）
// 流れの方向はすべて艦尾方向（-X）へ統一。グループごと艦に追従して動揺する。
// リアル描画モード専用（ワイヤーフレーム時は controls.js が非表示にする）。
import * as THREE from 'three';

const BUBBLE_COUNT = 160; // スクリュー気泡（4軸 × 40）
const SPRAY_COUNT = 120;  // 艦首飛沫

// 4軸スクリュー位置（艦ローカル座標、hull.js の shaftSpecs と一致）
const SHAFTS = [
  [-108, -6.6, 3.9], [-108, -6.6, -3.9],
  [-99, -6.0, 7.2], [-99, -6.0, -7.2],
];

/* ================= テクスチャ生成 ================= */

/** ソフト円形スプライト（パーティクル用・放射グラデーション） */
function discSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/** 流れ縞の泡テクスチャ（U 方向リピート・航跡プレーン用） */
function foamTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  // 透明地に白の流線（進行方向に伸びた縞）を重ねる
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 64;
    const len = 14 + Math.random() * 46;
    const a = 0.06 + Math.random() * 0.18;
    const grad = ctx.createLinearGradient(x, y, x + len, y);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y - 1.2, len, 2.4);
  }
  // 細かい泡の斑点
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.25})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 64,
      0.5 + Math.random() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; // U 方向に流すためリピート
  return tex;
}

/* ================= パーティクル共通 ================= */

function pxScale() {
  // ワールドサイズ(m) → ピクセルサイズ変換係数（FOV 45° 前提、smoke.js と同式）
  return window.innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(22.5)));
}

function pointMaterial(sprite, color) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: sprite },
      uPxScale: { value: pxScale() },
      uColor: { value: new THREE.Color(color) },
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
    mat.uniforms.uPxScale.value = pxScale();
  });
  return mat;
}

/** パーティクルバッファ一式を生成 */
function particleBuffers(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const alpha = new Float32Array(count);
  const size = new Float32Array(count);
  const life = new Float32Array(count);
  const dur = new Float32Array(count);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  return { geo, pos, vel, alpha, size, life, dur };
}

/* ================= スクリュー気泡 ================= */

function createBubbles(sprite) {
  const b = particleBuffers(BUBBLE_COUNT);

  function spawn(i, scatter) {
    const s = SHAFTS[i % SHAFTS.length];
    b.pos[i * 3] = s[0] + (Math.random() - 0.5) * 1.2;
    b.pos[i * 3 + 1] = s[1] + (Math.random() - 0.5) * 0.8;
    b.pos[i * 3 + 2] = s[2] + (Math.random() - 0.5) * 1.2;
    // スクリュー後流: 強い後方流 + 浮力上昇
    b.vel[i * 3] = -(8 + Math.random() * 6);          // 後方（艦尾方向）
    b.vel[i * 3 + 1] = 3.5 + Math.random() * 2.5;     // 浮上
    b.vel[i * 3 + 2] = (Math.random() - 0.5) * 1.2;   // 横拡散
    b.dur[i] = 2.4 + Math.random() * 1.6;
    b.life[i] = scatter ? Math.random() : 0;
    if (scatter) {
      const t = b.life[i] * b.dur[i];
      b.pos[i * 3] += b.vel[i * 3] * t;
      b.pos[i * 3 + 1] = Math.min(b.pos[i * 3 + 1] + b.vel[i * 3 + 1] * t, 0.15);
    }
  }
  for (let i = 0; i < BUBBLE_COUNT; i++) spawn(i, true);

  const points = new THREE.Points(b.geo, pointMaterial(sprite, 0xf2faf7));
  points.name = 'screwBubbles';
  points.frustumCulled = false;
  points.renderOrder = 6;

  function update(dt) {
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      b.life[i] += dt / b.dur[i];
      if (b.life[i] >= 1) { spawn(i, false); continue; }

      b.pos[i * 3] += b.vel[i * 3] * dt;
      b.pos[i * 3 + 2] += b.vel[i * 3 + 2] * dt;

      const y = b.pos[i * 3 + 1];
      if (y < 0.15) {
        // 水面下: 浮力で加速しつつ浮上（海面シェーダに隠れるため非表示）
        b.pos[i * 3 + 1] = Math.min(y + b.vel[i * 3 + 1] * dt, 0.15);
        b.vel[i * 3 + 1] += 2.5 * dt;
        b.alpha[i] = 0;
        b.size[i] = 0.3;
      } else {
        // 水面到達: 白泡となって後方へ流れ、減速・膨張しながら消える
        b.vel[i * 3] *= 1 - 0.5 * dt; // 水の抵抗で艦の流れに同化
        const l = b.life[i];
        b.alpha[i] = Math.pow(1 - l, 1.2) * 0.5;
        b.size[i] = 0.6 + 2.8 * l;
      }
    }
    b.geo.attributes.position.needsUpdate = true;
    b.geo.attributes.aAlpha.needsUpdate = true;
    b.geo.attributes.aSize.needsUpdate = true;
  }

  return { points, update };
}

/* ================= 艦首の波切り飛沫 ================= */

function createBowSpray(sprite) {
  const b = particleBuffers(SPRAY_COUNT);

  function spawn(i, scatter) {
    const side = i % 2 ? 1 : -1;
    b.pos[i * 3] = 123.5 + Math.random() * 3.5;       // 船首水線付近
    b.pos[i * 3 + 1] = 0.3 + Math.random() * 0.6;
    b.pos[i * 3 + 2] = side * (0.6 + Math.random() * 1.2);
    // 左右へ V 字に広がりつつ後方へ（放物線で落水）
    b.vel[i * 3] = -(4 + Math.random() * 6);          // 後方
    b.vel[i * 3 + 1] = 2.2 + Math.random() * 3.4;     // 跳ね上げ
    b.vel[i * 3 + 2] = side * (2.2 + Math.random() * 4.2); // 舷外へ
    b.dur[i] = 1.4 + Math.random() * 0.9;
    b.life[i] = scatter ? Math.random() : 0;
    if (scatter) {
      const t = b.life[i] * b.dur[i];
      b.pos[i * 3] += b.vel[i * 3] * t;
      b.pos[i * 3 + 1] += b.vel[i * 3 + 1] * t - 4.25 * t * t;
      b.pos[i * 3 + 2] += b.vel[i * 3 + 2] * t;
    }
  }
  for (let i = 0; i < SPRAY_COUNT; i++) spawn(i, true);

  const points = new THREE.Points(b.geo, pointMaterial(sprite, 0xffffff));
  points.name = 'bowSpray';
  points.frustumCulled = false;
  points.renderOrder = 6;

  function update(dt) {
    for (let i = 0; i < SPRAY_COUNT; i++) {
      b.life[i] += dt / b.dur[i];
      if (b.life[i] >= 1 || b.pos[i * 3 + 1] < -0.25) { spawn(i, false); continue; }

      b.vel[i * 3 + 1] -= 8.5 * dt; // 重力で放物線落下
      b.pos[i * 3] += b.vel[i * 3] * dt;
      b.pos[i * 3 + 1] += b.vel[i * 3 + 1] * dt;
      b.pos[i * 3 + 2] += b.vel[i * 3 + 2] * dt;

      const l = b.life[i];
      const fadeIn = Math.min(l / 0.1, 1);
      b.alpha[i] = fadeIn * Math.pow(1 - l, 1.2) * 0.55;
      b.size[i] = 0.7 + 2.6 * l;
    }
    b.geo.attributes.position.needsUpdate = true;
    b.geo.attributes.aAlpha.needsUpdate = true;
    b.geo.attributes.aSize.needsUpdate = true;
  }

  return { points, update };
}

/* ================= 航跡プレーン ================= */

const SHIP_SPEED = 12; // 想定前進速度 m/s（≒23 ノット）— UV スクロール速度の基準

function wakePlaneMaterial(tex, { opacity, repeat, scrollSpeed, spreadMin }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uRepeat: { value: repeat },
      uSpeed: { value: scrollSpeed },
      uSpreadMin: { value: spreadMin },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime, uOpacity, uRepeat, uSpeed, uSpreadMin;
      varying vec2 vUv;
      void main() {
        // U=1 が発生端（船首/船尾側）。時間とともに泡模様が後方（U-）へ流れる
        float foam = texture2D(uMap, vec2(vUv.x * uRepeat + uTime * uSpeed, vUv.y)).a;
        // 発生端ほど細く、後方ほど広がる（V 字の開き）
        float spread = mix(uSpreadMin, 0.5, smoothstep(1.0, 0.45, vUv.x));
        float side = 1.0 - smoothstep(spread * 0.55, spread, abs(vUv.y - 0.5));
        float head = 1.0 - smoothstep(0.96, 1.0, vUv.x); // 発生端のフェード
        float tail = smoothstep(0.0, 0.3, vUv.x);        // 末端で消える
        float a = foam * side * head * tail * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vec3(1.0), a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function createWakePlanes(tex) {
  const meshes = [];
  const mats = [];

  function addPlane({ length, width, mid, yaw, y, opacity, repeat, spreadMin }) {
    const geo = new THREE.PlaneGeometry(length, width);
    geo.rotateX(-Math.PI / 2); // XZ 平面に寝かせる（U 軸 = X 軸）
    const mat = wakePlaneMaterial(tex, {
      opacity,
      repeat,
      scrollSpeed: (SHIP_SPEED / length) * repeat, // 模様の移動速度 = 艦速
      spreadMin,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(mid[0], y, mid[1]);
    m.rotation.y = yaw;
    m.renderOrder = 4; // 海面の後・煙/飛沫の前
    m.frustumCulled = false;
    m.userData.noWire = true; // ワイヤーフレーム切替・三角形数集計の対象外
    meshes.push(m);
    mats.push(mat);
  }

  // 舷側 V 字航跡 ×2: 船首 (124, ±2) → 後方 (-150, ±30)
  for (const s of [1, -1]) {
    addPlane({
      length: 275, width: 7,
      mid: [-13, s * 16], yaw: s * 0.102, y: 0.14,
      opacity: 0.5, repeat: 10, spreadMin: 0.1,
    });
  }
  // 艦尾航跡: 船尾 (-120) → 後方 (-260)
  addPlane({
    length: 140, width: 24,
    mid: [-190, 0], yaw: 0, y: 0.12,
    opacity: 0.42, repeat: 5, spreadMin: 0.28,
  });

  function update(dt) {
    for (const mat of mats) mat.uniforms.uTime.value += dt;
  }

  return { meshes, update };
}

/* ================= 統合 ================= */

export function createWake() {
  const group = new THREE.Group();
  group.name = 'wakeEffects';

  const sprite = discSprite();
  const bubbles = createBubbles(sprite);
  const spray = createBowSpray(sprite);
  const planes = createWakePlanes(foamTexture());

  group.add(bubbles.points, spray.points, ...planes.meshes);

  function update(dt) {
    if (!group.visible) return;
    bubbles.update(dt);
    spray.update(dt);
    planes.update(dt);
  }

  return { group, update };
}
