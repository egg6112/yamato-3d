// turrets.js — 46cm 三連装主砲塔 ×3 / 15.5cm 三連装副砲塔 ×2
import * as THREE from 'three';
import { deckAt } from './hull.js';

/** 砲塔の平面形状（前方が丸く、後方へ広がる） */
function turretShape(Lf, Lr, Wf, Wr) {
  const s = new THREE.Shape();
  s.moveTo(Lr, -Wr);
  s.lineTo(Lr, Wr);
  s.lineTo(Lf * 0.25, Wr);
  s.lineTo(Lf, Wf);
  s.quadraticCurveTo(Lf + Wf * 0.85, 0, Lf, -Wf);
  s.lineTo(Lf * 0.25, -Wr);
  s.closePath();
  return s;
}

/**
 * 砲塔ビルダー
 * opt: { houseL前/後, houseW前/後, houseH, bevel, barrelLen, barrelR, spacing, elev }
 */
function buildTurret(M, opt) {
  const g = new THREE.Group();

  // 砲室（傾斜装甲はベベルで表現）
  const geo = new THREE.ExtrudeGeometry(
    turretShape(opt.Lf, opt.Lr, opt.Wf, opt.Wr),
    {
      depth: opt.houseH,
      bevelEnabled: true,
      bevelThickness: opt.bevel,
      bevelSize: opt.bevel,
      bevelSegments: 3,
      steps: 1,
    },
  );
  geo.rotateX(-Math.PI / 2); // XY 平面 → 水平へ（押し出しが +Y に）
  const house = new THREE.Mesh(geo, M.steel);
  house.position.y = opt.bevel;
  g.add(house);

  const roofY = opt.bevel + opt.houseH;

  // 測距儀（後部の左右に突き出す「耳」）
  if (opt.rangefinder) {
    const rf = new THREE.Mesh(
      new THREE.CylinderGeometry(opt.Wr * 0.085, opt.Wr * 0.085, opt.Wr * 2 + 2.4, 12),
      M.steel,
    );
    rf.rotation.x = Math.PI / 2;
    rf.position.set(opt.Lr + 1.6, roofY - 0.6, 0);
    g.add(rf);
    for (const side of [1, -1]) {
      const hood = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.9, 1.0), M.steel);
      hood.position.set(opt.Lr + 1.6, roofY - 0.6, side * (opt.Wr + 0.9));
      g.add(hood);
    }
  }

  // 天蓋のディテール（ハッチ・ペリスコープ）
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 1.0), M.steelDark);
  hatch.position.set(opt.Lr * 0.5, roofY + 0.05, opt.Wr * 0.4);
  g.add(hatch);
  const peri = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 8), M.steelDark);
  peri.position.set(opt.Lf * 0.3, roofY + 0.3, -opt.Wr * 0.3);
  g.add(peri);

  // 砲身 ×3（中央はわずかに後退）
  const trunnionY = opt.houseH * 0.42;
  for (let i = -1; i <= 1; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(opt.Lf - 0.5 + (i === 0 ? -opt.recess : 0), trunnionY, i * opt.spacing);
    pivot.rotation.z = opt.elev;

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(opt.barrelR * 0.72, opt.barrelR, opt.barrelLen, 14),
      M.barrel,
    );
    barrel.rotation.z = -Math.PI / 2;             // +X 方向へ
    barrel.position.x = opt.barrelLen / 2;
    pivot.add(barrel);

    // 砲口の段差
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(opt.barrelR * 0.82, opt.barrelR * 0.82, opt.barrelLen * 0.06, 14),
      M.barrel,
    );
    muzzle.rotation.z = -Math.PI / 2;
    muzzle.position.x = opt.barrelLen * 0.97;
    pivot.add(muzzle);

    // 防水布（バッグ）
    const bag = new THREE.Mesh(new THREE.SphereGeometry(opt.barrelR * 2.1, 12, 10), M.canvas);
    bag.scale.set(1.35, 1, 1);
    pivot.add(bag);

    g.add(pivot);
  }
  return g;
}

const MAIN_OPT = {
  Lf: 8.5, Lr: -7.2, Wf: 3.0, Wr: 6.3,
  houseH: 2.7, bevel: 1.0,
  barrelLen: 20.7, barrelR: 0.62, spacing: 3.05, recess: 0.7,
  elev: 0.07, rangefinder: true,
};
const SEC_OPT = {
  Lf: 4.6, Lr: -3.8, Wf: 1.7, Wr: 3.0,
  houseH: 1.7, bevel: 0.6,
  barrelLen: 9.3, barrelR: 0.26, spacing: 1.35, recess: 0.35,
  elev: 0.1, rangefinder: true,
};

export function buildTurrets(M) {
  const g = new THREE.Group();

  // ---- 主砲バーベット＋砲塔 ----
  // 一番（前部・甲板レベル）／二番（背負い式・嵩上げ）／三番（後部）
  const mains = [
    { x: 63, barbH: 1.0, rotY: 0 },
    { x: 40, barbH: 3.4, rotY: 0 },
    { x: -63, barbH: 1.0, rotY: Math.PI },
  ];
  for (const m of mains) {
    const deck = deckAt(m.x);
    const barb = new THREE.Mesh(
      new THREE.CylinderGeometry(6.3, 6.5, m.barbH + 0.6, 36), M.steel);
    barb.position.set(m.x, deck + (m.barbH + 0.6) / 2 - 0.3, 0);
    g.add(barb);

    const t = buildTurret(M, MAIN_OPT);
    t.position.set(m.x, deck + m.barbH, 0);
    t.rotation.y = m.rotY;
    g.add(t);
  }

  // ---- 副砲（前後の上構上・背負い式） ----
  const secs = [
    { x: 20, y: 14.0, barbH: 1.2, rotY: 0 },
    { x: -42, y: 14.0, barbH: 1.2, rotY: Math.PI },
  ];
  for (const s of secs) {
    const barb = new THREE.Mesh(
      new THREE.CylinderGeometry(2.9, 3.1, s.barbH + 0.4, 28), M.steel);
    barb.position.set(s.x, s.y + (s.barbH + 0.4) / 2 - 0.2, 0);
    g.add(barb);

    const t = buildTurret(M, SEC_OPT);
    t.position.set(s.x, s.y + s.barbH, 0);
    t.rotation.y = s.rotY;
    g.add(t);
  }

  return g;
}
