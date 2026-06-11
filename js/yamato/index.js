// yamato/index.js — 戦艦大和モデルの統合
import * as THREE from 'three';
import { buildHull } from './hull.js';
import { buildTurrets } from './turrets.js';
import { buildSuperstructure } from './superstructure.js';
import { buildDetails } from './details.js';

export function buildYamato(M) {
  const ship = new THREE.Group();
  ship.name = 'IJN_YAMATO';

  ship.add(buildHull(M));
  const turrets = buildTurrets(M);
  ship.add(turrets);
  ship.userData.turrets = turrets.userData.turrets; // アニメーション用参照
  ship.add(buildSuperstructure(M));
  ship.add(buildDetails(M));

  // 影の設定を一括適用
  ship.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return ship;
}
