// hull.js — 船体ロフト生成・甲板・推進器・舵
// 座標系: +X=艦首方向, +Y=上, +Z=右舷, 水線 y=0, 単位 m
import * as THREE from 'three';
import { V, tube, mergeToMesh } from './utils.js';

export const LOA = 263;       // 全長
export const HALF = LOA / 2;  // 131.5
export const BEAM_HALF = 19.45;

/* ================= 船型プロファイル ================= */

/** u: 0=艦尾 → 1=艦首 */
export const uOf = (x) => (x + HALF) / LOA;

/** 水線面半幅 */
export function halfBeam(u) {
  let f = 1;
  if (u > 0.62) {            // 艦首の絞り込み
    const t = (u - 0.62) / 0.38;
    f = 1 - Math.pow(t, 1.6);
  }
  if (u < 0.42) {            // 艦尾の絞り込み（巡洋艦型船尾）
    const t = u / 0.42;
    f = Math.min(f, Math.pow(Math.sin(t * Math.PI / 2), 0.8));
  }
  return BEAM_HALF * Math.max(f, 0.015);
}

/** 甲板高さ（シア曲線：艦首に向かって反り上がる） */
export function deckY(u) {
  let y = 8.7;
  if (u > 0.7) y += 6.8 * Math.pow((u - 0.7) / 0.3, 2);          // 艦首シア
  if (u < 0.15) y -= 1.7 * Math.pow((0.15 - u) / 0.15, 1.5);     // 艦尾
  return y;
}

/** キール深さ */
export function keelY(u) {
  let y = -10.4;
  if (u > 0.8) y += 9.4 * Math.pow((u - 0.8) / 0.2, 1.7);        // 艦首船底の立ち上がり
  if (u < 0.18) y += 9.0 * Math.pow((0.18 - u) / 0.18, 1.8);     // 艦尾カウンター
  return y;
}

export const deckAt = (x) => deckY(uOf(x));
export const halfBeamAt = (x) => halfBeam(uOf(x));

/** 断面の張り具合（中央部は箱型、艦首尾は V 型） */
function sectionPower(u) {
  return 0.35 + 1.45 * Math.pow(Math.abs(u - 0.5) / 0.5, 2);
}
function bottomPower(u) {
  return 1.2 + 1.4 * (1 - Math.pow(Math.abs(u - 0.5) / 0.5, 1.5));
}

/* ================= 船体メッシュ ================= */

function buildHullMesh(M) {
  const STATIONS = 170;       // 長手方向分割（高精細）
  const SECTS = 26;           // 半断面分割
  const RING = SECTS * 2 + 1;

  const pos = [], col = [], uv = [], idx = [];
  const cGray = new THREE.Color(0.56, 0.58, 0.61); // 軍艦色
  const cBlack = new THREE.Color(0.07, 0.07, 0.08); // 水線帯
  const cRed = new THREE.Color(0.45, 0.13, 0.11);   // 艦底色
  const tmp = new THREE.Color();

  for (let i = 0; i <= STATIONS; i++) {
    const u = i / STATIONS;
    const x = -HALF + LOA * u;
    const hb = halfBeam(u), dy = deckY(u), ky = keelY(u);
    const p = sectionPower(u), q = bottomPower(u);

    for (let j = 0; j < RING; j++) {
      const t = j / (RING - 1);            // 0=右舷甲板縁 → 0.5=キール → 1=左舷甲板縁
      const side = t < 0.5 ? 1 : -1;
      const s = 1 - Math.abs(t - 0.5) * 2; // 1=甲板縁, 0=キール
      const z = side * hb * Math.pow(Math.sin(s * Math.PI / 2), p);
      const y = ky + (dy - ky) * (1 - Math.pow(Math.cos(s * Math.PI / 2), q));
      pos.push(x, y, z);
      uv.push(u * 30, t * 4);

      // 高さで塗り分け（喫水線まわりに黒帯）
      if (y < -1.1) tmp.copy(cRed);
      else if (y < 1.1) tmp.copy(cBlack);
      else tmp.copy(cGray);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let i = 0; i < STATIONS; i++) {
    for (let j = 0; j < RING - 1; j++) {
      const a = i * RING + j, b = (i + 1) * RING + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, M.hull);
}

/* ================= 甲板（リボン生成） ================= */

/** x0..x1 を覆う甲板ストリップ。inset で舷側からの控え、yOff で浮かせ量 */
export function buildDeckStrip(M, mat, x0, x1, inset = 0.35, yOff = 0, segs = 120) {
  const ACROSS = 10;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const x = x0 + (x1 - x0) * (i / segs);
    const u = uOf(x);
    const hw = Math.max(halfBeam(u) - inset, 0.05);
    const dy = deckY(u);
    for (let a = 0; a <= ACROSS; a++) {
      const f = (a / ACROSS) * 2 - 1; // -1..1
      const z = f * hw;
      const y = dy - 0.06 + 0.3 * (1 - f * f) + yOff; // キャンバー（中央の盛り上がり）
      pos.push(x, y, z);
      uv.push(z / 3.2, x / 8); // 板目スケール：横3.2m=16枚, 縦8mで繰り返し
    }
  }
  const W = ACROSS + 1;
  for (let i = 0; i < segs; i++) {
    for (let a = 0; a < ACROSS; a++) {
      const k = i * W + a, n = (i + 1) * W + a;
      idx.push(k, k + 1, n, k + 1, n + 1, n);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/* ================= 推進器・舵・バルバスバウ ================= */

function buildPropulsion(M) {
  const g = new THREE.Group();
  const propellers = [];

  // 4軸スクリュー（内側2軸・外側2軸）
  const shaftSpecs = [
    { x: -108, z: 3.9, y: -6.6 }, { x: -108, z: -3.9, y: -6.6 },
    { x: -99, z: 7.2, y: -6.0 }, { x: -99, z: -7.2, y: -6.0 },
  ];
  for (const s of shaftSpecs) {
    // シャフト＋支持ブラケット
    g.add(tube(V(s.x + 9, s.y + 0.9, s.z * 0.8), V(s.x, s.y, s.z), 0.34, M.steelDark, 10));
    g.add(tube(V(s.x + 2.5, s.y + 3.2, s.z * 0.55), V(s.x + 1, s.y, s.z), 0.22, M.steelDark));

    // プロペラ（3翼）
    const prop = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.2, 12), M.bronze);
    hub.rotation.z = Math.PI / 2;
    prop.add(hub);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M.bronze);
      blade.scale.set(0.1, 1.45, 0.62);
      const ang = (b / 3) * Math.PI * 2;
      blade.position.set(0, Math.cos(ang) * 1.35, Math.sin(ang) * 1.35);
      blade.rotation.x = ang;
      blade.rotation.y = 0.5; // ピッチ
      prop.add(blade);
    }
    prop.position.set(s.x, s.y, s.z);
    // 常時回転アニメーション用（シャフトは X 軸方向 → 回転軸は rotation.x）
    // 左右舷で回転方向を逆転（外回り）、内軸はやや高速
    prop.userData.spinDir = s.z > 0 ? 1 : -1;
    prop.userData.spinSpeed = Math.abs(s.z) > 5 ? 11 : 13; // rad/s（外軸/内軸）
    propellers.push(prop);
    g.add(prop);
  }
  g.userData.propellers = propellers;

  // 主舵＋副舵（中心線上）
  const mainRudder = new THREE.Mesh(new THREE.BoxGeometry(4.6, 6.2, 0.55), M.hull);
  mainRudder.position.set(-119, -4.6, 0);
  const auxRudder = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.6, 0.5), M.hull);
  auxRudder.position.set(-110, -5.4, 0);
  // 舵は艦底色 → 専用に dark を使用
  mainRudder.material = auxRudder.material = M.dark;
  g.add(mainRudder, auxRudder);

  // ビルジキール
  for (const side of [1, -1]) {
    const bk = new THREE.Mesh(new THREE.BoxGeometry(85, 0.3, 1.4), M.dark);
    bk.position.set(-5, -8.6, side * 17.2);
    bk.rotation.x = side * 0.7;
    g.add(bk);
  }
  return g;
}

/* ================= 組立 ================= */

export function buildHull(M) {
  const g = new THREE.Group();

  g.add(buildHullMesh(M));

  // 木甲板（全通）
  g.add(buildDeckStrip(M, M.deck, -HALF + 1.5, HALF - 0.8, 0.35, 0, 150));

  // 艦尾の航空作業甲板（鉄甲板を木甲板の上に重ねる）
  g.add(buildDeckStrip(M, M.steelDark, -126.5, -73, 0.5, 0.05, 50));

  // バルバスバウ（球状艦首）
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), M.hull);
  bulb.scale.set(4.2, 2.0, 1.7);
  bulb.position.set(127.5, -6.8, 0);
  bulb.material = M.dark;
  g.add(bulb);

  // 波除け（前甲板の V 字型ブレークウォーター）
  for (const side of [1, -1]) {
    const bw = new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.15, 0.18), M.steel);
    const a = V(83, 0, 0), b = V(74.5, 0, side * 5.6);
    bw.position.set((a.x + b.x) / 2, deckAt(79) + 0.78, (a.z + b.z) / 2);
    bw.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    g.add(bw);
  }

  const propulsion = buildPropulsion(M);
  g.add(propulsion);
  g.userData.propellers = propulsion.userData.propellers; // アニメーション用参照
  return g;
}
