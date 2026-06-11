// yamato/index.js — 戦艦大和モデルの統合
import * as THREE from 'three';
import { buildHull } from './hull.js';
import { buildTurrets } from './turrets.js';
import { buildSuperstructure } from './superstructure.js';
import { buildDetails } from './details.js';

export function buildYamato(M) {
  const ship = new THREE.Group();
  ship.name = 'IJN_YAMATO';

  const hull = buildHull(M);
  ship.add(hull);
  ship.userData.propellers = hull.userData.propellers; // スクリュー回転用参照
  const turrets = buildTurrets(M);
  ship.add(turrets);
  ship.userData.turrets = turrets.userData.turrets; // アニメーション用参照
  ship.add(buildSuperstructure(M));
  const details = buildDetails(M);
  ship.add(details);
  ship.userData.haMounts = details.userData.haMounts; // 高角砲アニメーション用参照

  // 影の設定を一括適用
  ship.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return ship;
}
