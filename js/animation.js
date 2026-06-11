// animation.js — 砲塔旋回・砲身俯仰の自動アニメーション
// 砲塔: rotation.y を基準角 ±150° の範囲で一定速度ピンポン旋回
// 砲身: ピボット（砲塔の子）を -5°〜+45° で周期俯仰
//       ※砲身は +X 方向を向くため、俯仰の回転軸はピボットの rotation.z
import * as THREE from 'three';

const D2R = THREE.MathUtils.degToRad;
const SWEEP = D2R(150);      // 旋回範囲 ±150°
const ELEV_MIN = D2R(-5);    // 俯角
const ELEV_MAX = D2R(45);    // 仰角

export function createAnimator(yamato) {
  // 砲塔ごとの状態（速度を少しずつ変えて自然なバラつきを出す）
  const turrets = (yamato.userData.turrets ?? []).map((t, i) => ({
    obj: t,
    pivots: t.userData.pivots ?? [],
    yaw: t.userData.baseRotY,
    yawMin: t.userData.baseRotY - SWEEP,
    yawMax: t.userData.baseRotY + SWEEP,
    yawDir: i % 2 ? -1 : 1,
    yawSpeed: D2R(9 + (i % 3) * 2.5),    // 9〜14 °/s
    elev: t.userData.baseElev,
    elevDir: 1,
    elevSpeed: D2R(6 + (i % 3) * 1.8),   // 6〜9.6 °/s
  }));

  let turretOn = false;
  let barrelOn = false;

  function update(dt) {
    if (!turretOn && !barrelOn) return;
    for (const s of turrets) {
      if (turretOn) {
        s.yaw += s.yawDir * s.yawSpeed * dt;
        if (s.yaw >= s.yawMax) { s.yaw = s.yawMax; s.yawDir = -1; }
        else if (s.yaw <= s.yawMin) { s.yaw = s.yawMin; s.yawDir = 1; }
        s.obj.rotation.y = s.yaw;
      }
      if (barrelOn) {
        s.elev += s.elevDir * s.elevSpeed * dt;
        if (s.elev >= ELEV_MAX) { s.elev = ELEV_MAX; s.elevDir = -1; }
        else if (s.elev <= ELEV_MIN) { s.elev = ELEV_MIN; s.elevDir = 1; }
        for (const p of s.pivots) p.rotation.z = s.elev;
      }
    }
  }

  return {
    update,
    setTurretAnim(on) { turretOn = on; },  // OFF 時は現在角度のまま停止
    setBarrelAnim(on) { barrelOn = on; },
  };
}
