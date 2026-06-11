// animation.js — 砲塔旋回・砲身俯仰の自動アニメーション
// 砲塔: rotation.y を基準角 ±sweep の範囲で一定速度ピンポン旋回
// 砲身: ピボット（砲塔の子）を elevMin〜elevMax で周期俯仰
//       ※砲身は +X 方向を向くため、俯仰の回転軸はピボットの rotation.z
//
// めり込み防止: 旋回範囲・俯仰範囲は砲塔ごとに turrets.js が userData.limits で
// 指定する射界制限（艦首シア・隣接砲塔・上構などとの干渉を回避した角度）に従う。
import * as THREE from 'three';

const D2R = THREE.MathUtils.degToRad;
const DEFAULT_LIMITS = { sweep: 150, elevMin: -5, elevMax: 45 };

export function createAnimator(yamato) {
  // 砲塔ごとの状態（速度を少しずつ変えて自然なバラつきを出す）
  const turrets = (yamato.userData.turrets ?? []).map((t, i) => {
    const lim = t.userData.limits ?? DEFAULT_LIMITS;
    return {
      obj: t,
      pivots: t.userData.pivots ?? [],
      yaw: t.userData.baseRotY,
      yawMin: t.userData.baseRotY - D2R(lim.sweep),
      yawMax: t.userData.baseRotY + D2R(lim.sweep),
      yawDir: i % 2 ? -1 : 1,
      yawSpeed: D2R(9 + (i % 3) * 2.5),    // 9〜14 °/s
      elev: THREE.MathUtils.clamp(t.userData.baseElev, D2R(lim.elevMin), D2R(lim.elevMax)),
      elevMin: D2R(lim.elevMin),
      elevMax: D2R(lim.elevMax),
      elevDir: 1,
      elevSpeed: D2R(6 + (i % 3) * 1.8),   // 6〜9.6 °/s
    };
  });

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
        if (s.elev >= s.elevMax) { s.elev = s.elevMax; s.elevDir = -1; }
        else if (s.elev <= s.elevMin) { s.elev = s.elevMin; s.elevDir = 1; }
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
