// utils.js — パイプ・梁・ジオメトリ結合のヘルパー
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** 2点間を結ぶ円柱ジオメトリ（変換適用済み）を返す */
export function tubeGeometry(a, b, r, radialSeg = 8) {
  _dir.subVectors(b, a);
  const len = _dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, radialSeg, 1);
  _quat.setFromUnitVectors(Y_AXIS, _dir.normalize());
  g.applyQuaternion(_quat);
  _mid.addVectors(a, b).multiplyScalar(0.5);
  g.translate(_mid.x, _mid.y, _mid.z);
  return g;
}

/** 2点間を結ぶ角材（断面 w×h）のジオメトリを返す */
export function barGeometry(a, b, w, h) {
  _dir.subVectors(b, a);
  const len = _dir.length();
  const g = new THREE.BoxGeometry(len, h, w);
  _quat.setFromUnitVectors(X_AXIS, _dir.normalize());
  g.applyQuaternion(_quat);
  _mid.addVectors(a, b).multiplyScalar(0.5);
  g.translate(_mid.x, _mid.y, _mid.z);
  return g;
}

/** 2点間パイプの Mesh を返す */
export function tube(a, b, r, mat, radialSeg = 8) {
  return new THREE.Mesh(tubeGeometry(a, b, r, radialSeg), mat);
}

/** 2点間角材の Mesh を返す */
export function bar(a, b, w, h, mat) {
  return new THREE.Mesh(barGeometry(a, b, w, h), mat);
}

/** ジオメトリ配列を 1 メッシュへ結合（ドローコール削減） */
export function mergeToMesh(geometries, mat) {
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  geometries.forEach((g) => g.dispose());
  return new THREE.Mesh(merged, mat);
}

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
