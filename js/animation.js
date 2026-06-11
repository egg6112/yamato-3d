// animation.js — 砲塔旋回・砲身俯仰・スクリュー回転の自動アニメーション
// 対象: 主砲 3 基・副砲 2 基（userData.turrets）＋ 12.7cm 高角砲 12 基（userData.haMounts）
//       ＋ 4 軸スクリュー（userData.propellers — 常時回転・トグル対象外）
// 砲塔: rotation.y を基準角 ±sweep の範囲で一定速度ピンポン旋回
// 砲身: ピボット（砲塔の子）を elevMin〜elevMax で周期俯仰
//       ※砲身は +X 方向を向くため、俯仰の回転軸はピボットの rotation.z
//
// めり込み防止:
//  - 旋回範囲・俯仰範囲は各砲の userData.limits（射界制限）に従う
//  - limits.inboardElevMin がある砲（高角砲）は、内舷側（基準角から 90° 超）へ
//    旋回したとき俯角下限を滑らかに引き上げ、上構への砲身めり込みを回避する
import * as THREE from 'three';

const D2R = THREE.MathUtils.degToRad;
const DEFAULT_LIMITS = { sweep: 150, elevMin: -5, elevMax: 45 };

export function createAnimator(yamato) {
  const sources = [
    ...(yamato.userData.turrets ?? []),
    ...(yamato.userData.haMounts ?? []),
  ];

  // 砲ごとの状態（速度を少しずつ変えて自然なバラつきを出す）
  const guns = sources.map((t, i) => {
    const lim = t.userData.limits ?? DEFAULT_LIMITS;
    const spd = t.userData.animSpeed
      ?? { yaw: 9 + (i % 3) * 2.5, elev: 6 + (i % 3) * 1.8 }; // 主砲・副砲の既定速度
    return {
      obj: t,
      pivots: t.userData.pivots ?? [],
      baseRotY: t.userData.baseRotY,
      yaw: t.userData.baseRotY,
      yawMin: t.userData.baseRotY - D2R(lim.sweep),
      yawMax: t.userData.baseRotY + D2R(lim.sweep),
      yawDir: i % 2 ? -1 : 1,
      yawSpeed: D2R(spd.yaw),
      elev: THREE.MathUtils.clamp(t.userData.baseElev, D2R(lim.elevMin), D2R(lim.elevMax)),
      elevMin: D2R(lim.elevMin),
      elevMax: D2R(lim.elevMax),
      elevDir: 1,
      elevSpeed: D2R(spd.elev),
      inboardElevMin: lim.inboardElevMin != null ? D2R(lim.inboardElevMin) : null,
    };
  });

  // スクリュー（常時回転・前進走航の表現）
  const propellers = yamato.userData.propellers ?? [];

  let turretOn = false;
  let barrelOn = false;

  /** 内舷補正を加味した俯仰角をピボットへ適用 */
  function applyElev(s) {
    let shown = s.elev;
    if (s.inboardElevMin !== null) {
      const rel = Math.abs(s.yaw - s.baseRotY); // 外舷正面からの旋回量
      // 75°→105° の間で俯角下限を滑らかに引き上げる（角度ジャンプ防止）
      const k = THREE.MathUtils.smoothstep(rel, D2R(75), D2R(105));
      const floor = s.elevMin + (s.inboardElevMin - s.elevMin) * k;
      shown = Math.max(s.elev, floor);
    }
    for (const p of s.pivots) p.rotation.z = shown;
  }

  function update(dt) {
    // スクリューは UI トグルに関係なく常時回転
    for (const p of propellers) {
      p.rotation.x += p.userData.spinDir * p.userData.spinSpeed * dt;
    }

    if (!turretOn && !barrelOn) return;
    for (const s of guns) {
      if (turretOn) {
        s.yaw += s.yawDir * s.yawSpeed * dt;
        if (s.yaw >= s.yawMax) { s.yaw = s.yawMax; s.yawDir = -1; }
        else if (s.yaw <= s.yawMin) { s.yaw = s.yawMin; s.yawDir = 1; }
        s.obj.rotation.y = s.yaw;
      }
      if (barrelOn) {
        s.elev += s.elevDir * s.elevSpeed * dt;
        if (s.elev >= s.elevMax) { s.elev = s.elevMax; s.elevDir = -1; }
        else if (s.elev <= s.elevMin) { s.elev = s.elevMin; s.elevDir = 1; }
      }
      // 俯仰 OFF でも旋回中は内舷補正を効かせ続ける（低俯角のまま内舷へ向かないように）
      if (barrelOn || (turretOn && s.inboardElevMin !== null)) applyElev(s);
    }
  }

  return {
    update,
    setTurretAnim(on) { turretOn = on; },  // OFF 時は現在角度のまま停止
    setBarrelAnim(on) { barrelOn = on; },
  };
}
