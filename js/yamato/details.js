// details.js — 対空兵装・探照灯・カタパルト・クレーン・錨・手すり・紋章
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { V, tube, tubeGeometry, barGeometry, mergeToMesh } from './utils.js';
import { deckAt, halfBeamAt, HALF } from './hull.js';
import { chrysanthemumTexture } from '../materials.js';

/* ================= 12.7cm 連装高角砲 ================= */

function buildHAMount(M, shielded) {
  const g = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.55, 18), M.steelDark);
  base.position.y = 0.28;
  g.add(base);

  if (shielded) {
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.95, 2.1, 20), M.steel);
    shield.position.y = 1.6;
    g.add(shield);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.steel);
    dome.scale.set(1, 0.55, 1);
    dome.position.y = 2.65;
    g.add(dome);
  } else {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 1.2, 14), M.steel);
    ped.position.y = 1.1;
    g.add(ped);
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.6), M.steel);
    cradle.position.y = 1.9;
    g.add(cradle);
    for (const s of [1, -1]) { // 照準手席
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), M.steelDark);
      seat.position.set(-0.6, 1.6, s * 1.05);
      g.add(seat);
    }
  }

  // 連装砲身（高角 30°）。ピボットは俯仰アニメーション用に userData へ登録
  const pivots = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.35, shielded ? 2.0 : 1.95, s * 0.42);
    pivot.rotation.z = 0.5;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.13, 5.0, 10), M.barrel);
    b.rotation.z = -Math.PI / 2;
    b.position.x = 2.5;
    pivot.add(b);
    g.add(pivot);
    pivots.push(pivot);
  }
  g.userData.pivots = pivots;
  g.userData.baseElev = 0.5;
  return g;
}

/* ================= 25mm 三連装機銃（結合instancing） ================= */

function buildTripleAAGeometry() {
  const geos = [];
  const add = (geo, x, y, z, rz = 0) => {
    if (rz) geo.rotateZ(rz);
    geo.translate(x, y, z);
    geos.push(geo);
  };
  add(new THREE.CylinderGeometry(0.5, 0.62, 0.85, 12), 0, 0.42, 0);       // 銃座
  add(new THREE.BoxGeometry(1.0, 0.55, 1.05), 0, 1.1, 0);                  // 旋回部
  for (const off of [-0.26, 0, 0.26]) {                                    // 銃身 ×3（仰角 15°）
    const b = new THREE.CylinderGeometry(0.045, 0.06, 3.1, 8);
    b.rotateZ(-Math.PI / 2 + 0.26);
    b.translate(1.5, 1.75, off);
    geos.push(b);
  }
  add(new THREE.BoxGeometry(0.5, 0.32, 0.9), 0.25, 1.55, 0);              // 弾倉
  for (const s of [1, -1]) {                                               // 射手席
    add(new THREE.BoxGeometry(0.42, 0.4, 0.34), -0.62, 0.95, s * 0.55);
  }
  return BufferGeometryUtils.mergeGeometries(geos, false);
}

function buildAA(M) {
  const g = new THREE.Group();
  const haMounts = []; // 旋回・俯仰アニメーション対象

  // ---- 12.7cm 高角砲（防盾付き6基・露天6基）----
  const haList = [
    { x: 14, shield: true }, { x: -2, shield: true }, { x: -18, shield: true },
    { x: 6, shield: false }, { x: -10, shield: false }, { x: -26, shield: false },
  ];
  let k = 0;
  for (const ha of haList) {
    for (const side of [1, -1]) {
      const m = buildHAMount(M, ha.shield);
      m.position.set(ha.x, 11.45, side * 10.6);
      m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; // 舷外へ向ける
      m.userData.baseRotY = m.rotation.y;
      // 射界制限: 内舷側（|旋回|>90°）へ向くときは砲身を上げて上構との干渉を避ける
      m.userData.limits = { sweep: 120, elevMin: -5, elevMax: 75, inboardElevMin: 10 };
      m.userData.animSpeed = { yaw: 16 + (k % 4) * 3, elev: 12 + (k % 3) * 4 };
      g.add(m);
      haMounts.push(m);
      k++;
    }
  }
  g.userData.haMounts = haMounts;

  // ---- 25mm 三連装機銃 ----
  const tripleGeo = buildTripleAAGeometry();
  const positions = [
    [98, deckAt(98) + 0.25, 0, 0],
    [72, deckAt(72) + 0.25, 6, -0.6], [72, deckAt(72) + 0.25, -6, 0.6],
    [38.5, 15.85, 2.6, -0.9], [38.5, 15.85, -2.6, 0.9],   // 二番主砲塔天蓋
    [22, 14.25, 8.2, -1.3], [22, 14.25, -8.2, 1.3],
    [2, 14.25, 8.6, -1.57], [2, 14.25, -8.6, 1.57],
    [-14, 14.25, 8.6, -1.57], [-14, 14.25, -8.6, 1.57],
    [-34, 14.25, 8.2, -1.8], [-34, 14.25, -8.2, 1.8],
    [26, 11.65, 11.2, -1.57], [26, 11.65, -11.2, 1.57],
    [-32, 11.65, 11.0, -1.57], [-32, 11.65, -11.0, 1.57],
    [-72, deckAt(-72) + 0.3, 8, -2.0], [-72, deckAt(-72) + 0.3, -8, 2.0],
    [-84, deckAt(-84) + 0.3, 6.5, -2.2], [-84, deckAt(-84) + 0.3, -6.5, 2.2],
    [-112, deckAt(-112) + 0.3, 0, Math.PI],
  ];
  for (const [x, y, z, ry] of positions) {
    const m = new THREE.Mesh(tripleGeo, M.dark);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
  }
  return g;
}

/* ================= 110cm 探照灯 ================= */

function buildSearchlights(M) {
  const g = new THREE.Group();
  const make = () => {
    const sl = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.1, 10), M.steelDark);
    ped.position.y = 0.55;
    sl.add(ped);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.75, 18), M.dark);
    drum.rotation.x = Math.PI / 2;
    drum.position.y = 1.35;
    sl.add(drum);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.56, 18), M.lens);
    lens.position.set(0, 1.35, 0.39);
    sl.add(lens);
    return sl;
  };
  // 煙突脇プラットフォーム上 ×4
  const spots = [
    [-8, 20.2, 4.6], [-8, 20.2, -4.6],
    [-13, 20.2, 4.2], [-13, 20.2, -4.2],
  ];
  for (const [x, y, z] of spots) {
    const sl = make();
    sl.position.set(x, y, z);
    sl.rotation.y = z > 0 ? 0 : Math.PI;
    g.add(sl);
  }
  return g;
}

/* ================= カタパルト＆クレーン ================= */

function buildCatapult(M) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.6, 16), M.steelDark);
  base.position.y = 0.3;
  g.add(base);

  const geos = [];
  const L = 19.5, gauge = 0.62, h = 0.95;
  // 上下レール＋トラス
  for (const s of [1, -1]) {
    geos.push(barGeometry(V(-4, h, s * gauge), V(L - 4, h, s * gauge), 0.24, 0.3));
    geos.push(barGeometry(V(-4, h - 0.7, s * gauge), V(L - 4, h - 0.7, s * gauge), 0.2, 0.22));
  }
  for (let x = -4; x <= L - 4; x += 1.55) {
    geos.push(tubeGeometry(V(x, h - 0.7, -gauge), V(x + 0.8, h, gauge), 0.05, 6));
    geos.push(tubeGeometry(V(x, h - 0.7, gauge), V(x + 0.8, h, -gauge), 0.05, 6));
    geos.push(tubeGeometry(V(x, h, -gauge), V(x, h, gauge), 0.05, 6));
  }
  g.add(mergeToMesh(geos, M.steelDark));
  return g;
}

function buildCrane(M) {
  const g = new THREE.Group(); // 原点 = 艦尾クレーン基部
  g.add(tube(V(0, 0, 0), V(0, 8.8, 0), 0.45, M.steelDark, 12));

  // ラチスブーム（三弦トラス）
  const tip = V(-14.5, 4.5, 0);
  const top = V(-0.6, 8.4, 0);
  const geos = [];
  const chords = [V(0, 0.45, 0), V(0, -0.2, 0.42), V(0, -0.2, -0.42)];
  for (const c of chords) {
    geos.push(tubeGeometry(
      V(top.x + c.x, top.y + c.y, top.z + c.z),
      V(tip.x + c.x * 0.3, tip.y + c.y * 0.3, tip.z + c.z * 0.3), 0.09));
  }
  for (let t = 0.08; t < 1; t += 0.11) {
    const px = top.x + (tip.x - top.x) * t;
    const py = top.y + (tip.y - top.y) * t;
    const w = 0.42 * (1 - t * 0.7);
    geos.push(tubeGeometry(V(px, py + 0.45 * (1 - t * 0.7), 0), V(px, py - 0.2, w), 0.04, 6));
    geos.push(tubeGeometry(V(px, py + 0.45 * (1 - t * 0.7), 0), V(px, py - 0.2, -w), 0.04, 6));
    geos.push(tubeGeometry(V(px, py - 0.2, w), V(px, py - 0.2, -w), 0.04, 6));
  }
  g.add(mergeToMesh(geos, M.steelDark));

  // 吊りワイヤー＋フック
  g.add(tube(V(0, 8.8, 0), tip, 0.03, M.dark, 6));
  const hook = tube(tip, V(tip.x, tip.y - 2.2, tip.z), 0.03, M.dark, 6);
  g.add(hook);
  return g;
}

/* ================= 内火艇・カッター ================= */

function buildBoats(M) {
  const g = new THREE.Group();
  const make = (len) => {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), M.woodBoat);
    hull.scale.set(len / 2, 0.85, 1.05);
    b.add(hull);
    const deck = new THREE.Mesh(new THREE.CircleGeometry(1, 18), M.linoleum);
    deck.scale.set(len / 2 * 0.94, 0.98, 1);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.32;
    b.add(deck);
    return b;
  };
  const spots = [
    [-50, 8.95, 11.2, 9], [-56, 8.95, 11.2, 8],
    [-50, 8.95, -11.2, 9], [-56, 8.95, -11.2, 8],
  ];
  for (const [x, y, z, len] of spots) {
    const b = make(len);
    b.position.set(x, y + 0.5, z);
    g.add(b);
  }
  return g;
}

/* ================= 錨・錨鎖・キャプスタン ================= */

function buildGroundTackle(M) {
  const g = new THREE.Group();

  for (const side of [1, -1]) {
    // 主錨（ホールス型・船体側面に格納）
    const anchor = new THREE.Group();
    const shank = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.0, 0.5), M.dark);
    anchor.add(shank);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 1.9), M.dark);
    crown.position.y = -1.6;
    anchor.add(crown);
    for (const fs of [1, -1]) {
      const fluke = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.7, 0.75), M.dark);
      fluke.position.set(0, -1.1, fs * 0.85);
      fluke.rotation.x = fs * -0.25;
      anchor.add(fluke);
    }
    anchor.position.set(118, 10.6, side * 4.0);
    anchor.rotation.x = side * 0.18;
    g.add(anchor);

    // 錨鎖（甲板上をホースパイプ→キャプスタンへ）
    const linkGeos = [];
    const a = V(115.5, deckAt(115.5) + 0.32, side * 2.9);
    const b = V(104, deckAt(104) + 0.32, side * 2.3);
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      const link = new THREE.TorusGeometry(0.17, 0.05, 6, 10);
      link.rotateY(Math.PI / 2 * (i % 2));      // 交互に 90°
      link.rotateZ(Math.PI / 2);
      link.rotateY(Math.atan2(-(b.z - a.z), b.x - a.x) + Math.PI / 2);
      link.translate(p.x, p.y, p.z);
      linkGeos.push(link);
    }
    g.add(mergeToMesh(linkGeos, M.dark));

    // キャプスタン（揚錨機）
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.8, 14), M.steelDark);
    cap.position.set(103, deckAt(103) + 0.55, side * 2.3);
    g.add(cap);
  }
  return g;
}

/* ================= 舷側手すり（結合ジオメトリ） ================= */

function buildRailings(M) {
  const geos = [];
  const STEP = 4.4, H = 1.05;
  for (const side of [1, -1]) {
    let prevTop = null, prevMid = null;
    for (let x = -127; x <= 128; x += STEP) {
      const z = side * Math.max(halfBeamAt(x) - 0.45, 0.1);
      const yBase = deckAt(x) - 0.04;
      const top = V(x, yBase + H, z);
      const mid = V(x, yBase + H * 0.55, z);
      geos.push(tubeGeometry(V(x, yBase, z), top, 0.035, 5)); // 支柱
      if (prevTop) {
        geos.push(tubeGeometry(prevTop, top, 0.024, 5));      // 上段手すり
        geos.push(tubeGeometry(prevMid, mid, 0.02, 5));       // 中段
      }
      prevTop = top; prevMid = mid;
    }
  }
  return mergeToMesh(geos, M.steelDark);
}

/* ================= 菊花紋章・旗竿 ================= */

function buildBowCrest(M) {
  const crest = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 32),
    new THREE.MeshStandardMaterial({
      map: chrysanthemumTexture(),
      transparent: true,
      metalness: 0.85,
      roughness: 0.3,
    }),
  );
  crest.position.set(130.6, 13.4, 0);
  crest.rotation.y = Math.PI / 2 - 0.06; // 艦首正面へ
  return crest;
}

function buildStaffs(M) {
  const g = new THREE.Group();
  g.add(tube(V(129.8, deckAt(129.8), 0), V(129.8, deckAt(129.8) + 4.2, 0), 0.06, M.dark, 6)); // 旗竿（艦首）
  g.add(tube(V(-129.5, deckAt(-129.5), 0), V(-129.5, deckAt(-129.5) + 5.0, 0), 0.06, M.dark, 6)); // 軍艦旗竿（艦尾）
  return g;
}

/* ================= 組立 ================= */

export function buildDetails(M) {
  const g = new THREE.Group();

  const aa = buildAA(M);
  g.add(aa);
  g.userData.haMounts = aa.userData.haMounts;
  g.add(buildSearchlights(M));
  g.add(buildBoats(M));
  g.add(buildGroundTackle(M));
  g.add(buildRailings(M));
  g.add(buildBowCrest(M));
  g.add(buildStaffs(M));

  // カタパルト ×2（艦尾両舷・斜め後外方へ）
  for (const side of [1, -1]) {
    const cat = buildCatapult(M);
    cat.position.set(-96, deckAt(-96) + 0.1, side * 7.2);
    cat.rotation.y = Math.PI + side * 0.45;
    g.add(cat);
  }

  // 艦尾クレーン
  const crane = buildCrane(M);
  crane.position.set(-114, deckAt(-114), 0);
  crane.rotation.y = Math.PI; // ブームを艦尾方向へ
  g.add(crane);

  return g;
}
