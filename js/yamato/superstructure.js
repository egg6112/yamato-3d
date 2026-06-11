// superstructure.js — 上構甲板・塔型艦橋・煙突・マスト・後部艦橋
import * as THREE from 'three';
import { V, tube, tubeGeometry, mergeToMesh } from './utils.js';

/** 角丸の甲板室を押し出しで生成 */
function roundedHouse(M, x0, x1, hw, h, mat) {
  const r = Math.min(hw, 7);
  const s = new THREE.Shape();
  s.moveTo(x1 - r, -hw);
  s.lineTo(x0 + r, -hw);
  s.quadraticCurveTo(x0, -hw, x0, 0);
  s.quadraticCurveTo(x0, hw, x0 + r, hw);
  s.lineTo(x1 - r, hw);
  s.quadraticCurveTo(x1, hw, x1, 0);
  s.quadraticCurveTo(x1, -hw, x1 - r, -hw);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // 押し出し +Z → +Y（上方向）
  return new THREE.Mesh(g, mat ?? M.steel);
}

/* ================= 塔型艦橋（パゴダ） ================= */

function buildBridgeTower(M) {
  const g = new THREE.Group(); // 原点 = 艦橋中心 x=6, y=14（第二上構天面）

  const lvl = (w, h, d, y, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), mat ?? M.steel);
    m.position.y = y + h / 2;
    g.add(m);
    return m;
  };

  // 司令塔（基部の円柱・厚装甲）
  const ct = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.0, 4.5, 24), M.steel);
  ct.position.set(2.5, 2.25, 0);
  g.add(ct);

  // 塔本体（上に向かって絞る）
  lvl(9.0, 4.0, 10.0, 0);          // 0–4
  lvl(8.2, 4.0, 8.6, 4);           // 4–8
  lvl(7.4, 4.0, 7.6, 8);           // 8–12 (絶対 22–26)
  // 羅針艦橋（窓帯付き）
  lvl(7.8, 2.6, 7.2, 12);
  const win = new THREE.Mesh(new THREE.BoxGeometry(7.35, 0.85, 7.95), M.glass);
  win.position.set(0, 13.7, 0);
  g.add(win);
  // 張り出しデッキ
  const balc = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.1, 0.25, 28), M.steelDark);
  balc.position.set(0, 14.75, 0);
  g.add(balc);
  // 上部見張所
  lvl(5.6, 3.0, 5.6, 14.9);
  // 防空指揮所（オープントップ）
  lvl(6.0, 1.3, 6.0, 17.9, M.steelDark);
  const parapet = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 1.1, 24, 1, true), M.steel);
  parapet.position.set(0, 19.7, 0);
  g.add(parapet);

  // 15m 測距儀（最頂部・横倒し円柱＋中央フード）
  const rfHood = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 3.4), M.steel);
  rfHood.position.set(0, 21.3, 0);
  g.add(rfHood);
  const rf15 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 15, 16), M.steel);
  rf15.rotation.x = Math.PI / 2;
  rf15.position.set(0, 21.5, 0);
  g.add(rf15);
  for (const side of [1, -1]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.1), M.steel);
    cap.position.set(0, 21.5, side * 7.0);
    g.add(cap);
  }

  // 21号電探（対空レーダー・マットレスアンテナ）を測距儀フード上に
  g.add(buildRadar21(M, V(0, 23.3, 0)));

  // 前檣（ポールマスト＋信号桁）
  g.add(tube(V(-1.5, 22.3, 0), V(-1.5, 31, 0), 0.22, M.dark));
  g.add(tube(V(-1.5, 28.5, -5.5), V(-1.5, 28.5, 5.5), 0.09, M.dark));
  g.add(tube(V(-1.5, 26.6, -3.4), V(-3.8, 25.2, 0), 0.07, M.dark));
  g.add(tube(V(-1.5, 26.6, 3.4), V(-3.8, 25.2, 0), 0.07, M.dark));

  // 側面の双眼鏡座・小プラットフォーム
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 1.6), M.steelDark);
    wing.position.set(1.5, 12.3, side * 4.6);
    g.add(wing);
    const bino = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.0, 8), M.dark);
    bino.position.set(1.5, 12.95, side * 4.6);
    g.add(bino);
  }

  g.add(...buildBridgeDetails(M));
  return g;
}

/* ---------- 艦橋ディテール（窓枠・手すり・電探・ラッタル・張線） ---------- */

/** 支柱列に上段・中段の手すりを張る。pts は支柱基部の点列 */
function railAlong(geos, pts, h) {
  let prevTop = null, prevMid = null;
  for (const p of pts) {
    const top = V(p.x, p.y + h, p.z);
    const mid = V(p.x, p.y + h * 0.55, p.z);
    geos.push(tubeGeometry(p, top, 0.025, 4));
    if (prevTop) {
      geos.push(tubeGeometry(prevTop, top, 0.02, 4));
      geos.push(tubeGeometry(prevMid, mid, 0.018, 4));
    }
    prevTop = top; prevMid = mid;
  }
}

/** 円形デッキ用の支柱基部点列 */
function circlePts(cx, y, cz, r, segs) {
  const pts = [];
  for (let k = 0; k <= segs; k++) {
    const a = (k / segs) * Math.PI * 2;
    pts.push(V(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
  }
  return pts;
}

function buildBridgeDetails(M) {
  const meshes = [];
  const railGeos = [];  // 手すり・光学機器筒 → steelDark
  const darkGeos = [];  // 窓枠・ラッタル・張線・双眼鏡 → dark

  // ---- 羅針艦橋の窓枠（マリオン）----
  // 前面（x=+3.68）: 縦桟 14 本
  for (let z = -3.9; z <= 3.91; z += 0.6) {
    darkGeos.push(tubeGeometry(V(3.7, 13.27, z), V(3.7, 14.13, z), 0.035, 4));
  }
  // 側面（z=±3.99）: 縦桟 各 11 本
  for (const s of [1, -1]) {
    for (let x = -3.5; x <= 3.51; x += 0.7) {
      darkGeos.push(tubeGeometry(V(x, 13.27, s * 4.0), V(x, 14.13, s * 4.0), 0.035, 4));
    }
    // 窓帯の上下トリム
    darkGeos.push(tubeGeometry(V(-3.7, 13.27, s * 4.0), V(3.7, 13.27, s * 4.0), 0.03, 4));
    darkGeos.push(tubeGeometry(V(-3.7, 14.13, s * 4.0), V(3.7, 14.13, s * 4.0), 0.03, 4));
  }
  darkGeos.push(tubeGeometry(V(3.72, 13.27, -3.9), V(3.72, 13.27, 3.9), 0.03, 4));
  darkGeos.push(tubeGeometry(V(3.72, 14.13, -3.9), V(3.72, 14.13, 3.9), 0.03, 4));

  // ---- 手すり ----
  railAlong(railGeos, circlePts(0, 14.88, 0, 5.05, 26), 1.0);   // 張り出しデッキ縁
  railAlong(railGeos, circlePts(0, 20.25, 0, 3.32, 18), 0.85);  // 防空指揮所パラペット上端
  for (const s of [1, -1]) {                                     // ウィング外縁（コの字）
    railAlong(railGeos, [
      V(0.3, 12.42, s * 4.0), V(0.3, 12.42, s * 5.35),
      V(1.5, 12.42, s * 5.35), V(2.7, 12.42, s * 5.35), V(2.7, 12.42, s * 4.0),
    ], 0.95);
  }

  // ---- 防空指揮所の双眼鏡座 ×4 ----
  for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const px = ax * 1.8, pz = az * 1.8;
    darkGeos.push(tubeGeometry(V(px, 19.2, pz), V(px, 20.0, pz), 0.07, 6));         // ペデスタル
    darkGeos.push(tubeGeometry(V(px - 0.25, 20.08, pz), V(px + 0.25, 20.08, pz), 0.13, 6)); // 双眼鏡
  }

  // ---- 後面ラッタル（昇降はしご・3 段）----
  const ladderSpecs = [
    { x: -5.07, y0: 0.3, y1: 3.9 },   // 第 1 層後面
    { x: -4.37, y0: 4.0, y1: 7.9 },   // 第 2 層後面
    { x: -3.87, y0: 8.0, y1: 11.9 },  // 第 3 層後面
  ];
  for (const L of ladderSpecs) {
    for (const s of [1, -1]) {
      darkGeos.push(tubeGeometry(V(L.x, L.y0, s * 0.3), V(L.x, L.y1, s * 0.3), 0.035, 4));
    }
    for (let y = L.y0 + 0.2; y < L.y1; y += 0.5) {
      darkGeos.push(tubeGeometry(V(L.x, y, -0.3), V(L.x, y, 0.3), 0.022, 4));
    }
  }

  // ---- 22 号電探（ラッパ型ホーンアンテナ・左右）----
  for (const s of [1, -1]) {
    darkGeos.push(tubeGeometry(V(1.5, 17.0, s * 2.8), V(1.5, 17.0, s * 3.55), 0.06, 5)); // ブラケット
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.18, 1.1, 12), M.steel);
    horn.rotation.x = s * Math.PI / 2; // 開口を舷外へ
    horn.position.set(1.5, 17.0, s * 4.1);
    meshes.push(horn);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.5), M.steelDark);
    back.position.set(1.5, 17.0, s * 3.6);
    meshes.push(back);
  }

  // ---- 15m 測距儀の光学副筒・前面スリットフード ----
  railGeos.push(tubeGeometry(V(0.6, 21.0, -6.8), V(0.6, 21.0, 6.8), 0.16, 8));
  railGeos.push(tubeGeometry(V(-0.6, 21.0, -6.8), V(-0.6, 21.0, 6.8), 0.16, 8));
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 2.4), M.steel);
  slit.position.set(1.75, 21.6, 0);
  meshes.push(slit);

  // ---- 張線（後支索・信号旗ハリヤード）----
  for (const s of [1, -1]) {
    darkGeos.push(tubeGeometry(V(-1.5, 31, 0), V(-3.5, 20.4, s * 2.4), 0.018, 4));  // バックステー
    darkGeos.push(tubeGeometry(V(-1.5, 28.5, s * 5.5), V(1.6, 15.3, s * 4.3), 0.015, 4)); // ハリヤード
  }

  meshes.push(mergeToMesh(railGeos, M.steelDark));
  meshes.push(mergeToMesh(darkGeos, M.dark));
  return meshes;
}

/** 21号電探（格子状アンテナ） */
function buildRadar21(M, at) {
  const geos = [];
  const W = 2.3, H = 1.25, r = 0.05;
  // 枠
  geos.push(tubeGeometry(V(0, -H, -W), V(0, -H, W), r));
  geos.push(tubeGeometry(V(0, H, -W), V(0, H, W), r));
  geos.push(tubeGeometry(V(0, -H, -W), V(0, H, -W), r));
  geos.push(tubeGeometry(V(0, -H, W), V(0, H, W), r));
  // 格子
  for (let i = 1; i < 4; i++) {
    const y = -H + (2 * H * i) / 4;
    geos.push(tubeGeometry(V(0, y, -W), V(0, y, W), 0.03));
  }
  for (let i = 1; i < 8; i++) {
    const z = -W + (2 * W * i) / 8;
    geos.push(tubeGeometry(V(0, -H, z), V(0, H, z), 0.03));
  }
  const mesh = mergeToMesh(geos, M.dark);
  mesh.position.copy(at);
  return mesh;
}

/* ================= 煙突 ================= */

function buildFunnel(M) {
  const g = new THREE.Group(); // 原点 = x=-9, y=14

  const RAKE = 0.3; // 後傾

  const body = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.5, 13.5, 32), M.steel);
  body.geometry.scale(1, 1, 0.66); // 楕円断面
  body.rotation.z = RAKE;
  body.position.y = 6.4;
  g.add(body);

  // 頂部（黒）＋雨除けグリル
  const top = new THREE.Mesh(new THREE.CylinderGeometry(3.65, 3.65, 1.6, 32), M.funnelTop);
  top.geometry.scale(1, 1, 0.66);
  top.rotation.z = RAKE;
  top.position.set(-Math.sin(RAKE) * 12.6, 12.55, 0);
  g.add(top);
  const grillGeos = [];
  const topC = V(-Math.sin(RAKE) * 13.3, 13.25, 0);
  for (let i = -2; i <= 2; i++) {
    grillGeos.push(tubeGeometry(
      V(topC.x - 3.3, topC.y, i * 0.95), V(topC.x + 3.3, topC.y, i * 0.95), 0.07));
  }
  g.add(mergeToMesh(grillGeos, M.funnelTop));

  // 蒸気捨て管（後面に沿わせる）
  for (const off of [-1.4, 0, 1.4]) {
    const p = tube(V(-4.6, 0.5, off), V(-7.6, 12.4, off * 0.7), 0.17, M.steelDark);
    g.add(p);
  }

  // 探照灯プラットフォーム（左右）
  for (const side of [1, -1]) {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.22, 2.4), M.steelDark);
    plat.position.set(-1.5, 6.2, side * 4.1);
    g.add(plat);
  }

  return g;
}

/* ================= 後檣（三脚マスト） ================= */

function buildMainmast(M) {
  const g = new THREE.Group(); // 原点 = x=-20, y=14

  g.add(tube(V(0, 0, 0), V(-1.2, 27, 0), 0.42, M.dark, 10));       // 主柱
  g.add(tube(V(-6.5, 0, 3.6), V(-1.55, 19, 0.25), 0.24, M.dark));  // 脚（後左右）
  g.add(tube(V(-6.5, 0, -3.6), V(-1.55, 19, -0.25), 0.24, M.dark));
  // 横桁
  g.add(tube(V(-1.95, 22.5, -8.5), V(-1.95, 22.5, 8.5), 0.11, M.dark));
  g.add(tube(V(-1.75, 19.0, -5.0), V(-1.75, 19.0, 5.0), 0.09, M.dark));
  // 見張所
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.4, 12), M.steel);
  top.position.set(-1.35, 20.6, 0);
  g.add(top);
  // 13号電探（はしご状アンテナ）
  const geos = [];
  for (let i = 0; i <= 6; i++) {
    geos.push(tubeGeometry(V(0.4, 23.5 + i * 0.55, -0.55), V(0.4, 23.5 + i * 0.55, 0.55), 0.035));
  }
  geos.push(tubeGeometry(V(0.4, 23.4, -0.55), V(0.4, 26.9, -0.55), 0.045));
  geos.push(tubeGeometry(V(0.4, 23.4, 0.55), V(0.4, 26.9, 0.55), 0.045));
  g.add(mergeToMesh(geos, M.dark));

  return g;
}

/* ================= 後部艦橋 ================= */

function buildAftTower(M) {
  const g = new THREE.Group(); // 原点 = x=-30, y=14

  const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.2, 5.4), M.steel);
  base.position.y = 2.1;
  g.add(base);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 4.4), M.steel);
  mid.position.y = 5.9;
  g.add(mid);
  const winB = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.7, 4.55), M.glass);
  winB.position.y = 6.9;
  g.add(winB);

  // 予備射撃指揮所＋10m 測距儀
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.6), M.steel);
  hood.position.y = 8.4;
  g.add(hood);
  const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 10, 14), M.steel);
  rf.rotation.x = Math.PI / 2;
  rf.position.y = 8.6;
  g.add(rf);
  for (const side of [1, -1]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.9), M.steel);
    cap.position.set(0, 8.6, side * 4.6);
    g.add(cap);
  }
  return g;
}

/* ================= 組立 ================= */

export function buildSuperstructure(M) {
  const g = new THREE.Group();

  // 第一上構（主甲板上）／第二上構
  const h1 = roundedHouse(M, -52, 30, 12.5, 2.8);
  h1.position.y = 8.62;
  g.add(h1);
  const h2 = roundedHouse(M, -46, 24, 9.5, 2.6);
  h2.position.y = 11.4;
  g.add(h2);

  // 第二上構天面はリノリウム風
  const h2top = roundedHouse(M, -45.7, 23.7, 9.3, 0.06, M.linoleum);
  h2top.position.y = 14.0;
  g.add(h2top);

  const bridge = buildBridgeTower(M);
  bridge.position.set(6, 14, 0);
  g.add(bridge);

  const funnel = buildFunnel(M);
  funnel.position.set(-9, 14, 0);
  g.add(funnel);

  const mast = buildMainmast(M);
  mast.position.set(-20, 14, 0);
  g.add(mast);

  const aft = buildAftTower(M);
  aft.position.set(-30, 14, 0);
  g.add(aft);

  return g;
}
