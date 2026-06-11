# 設計書 05 — レンダリング・環境設計

対象ファイル: `js/environment.js` / `js/main.js`

---

## 1. レンダラ設定

```javascript
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));   // 高 DPI だが上限 2×
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.4;   // やや暗め（空・水面の白飛び防止）
renderer.shadowMap.enabled  = true;
renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
```

| 設定 | 値 | 理由 |
|------|----|----|
| antialias | true | MSAA で edges を滑らかに |
| pixelRatio 上限 | 2 | 4K 以上のデバイスでの過負荷防止 |
| ToneMapping | ACES Filmic | ハイライトが自然にロールオフする映画的な色再現 |
| 露出 | 0.4 | 大気散乱 + 水面反射の白飛びを抑制 |
| Shadow type | PCFSoft | ソフトシャドウ（16 サンプル補間） |

---

## 2. カメラ設定

```javascript
new THREE.PerspectiveCamera(45, aspect, 0.5, 30000)
camera.position.set(175, 55, 235)  // 初期位置: 艦右舷斜め前上方
```

| パラメータ | 値 | 説明 |
|-----------|----|----|
| FOV | 45° | 標準〜望遠（歪みが少なく艦船に適する） |
| near | 0.5 m | 主砲塔近接時のクリッピング防止 |
| far | 30,000 m | 遠景霞＋水平線まで描画 |

---

## 3. 大気散乱（Sky）

Three.js `Sky` アドオン（Preetham モデル）を使用。

```javascript
const sky = new Sky();
sky.scale.setScalar(20000);   // スカイボックスサイズ（far の 0.67 倍）

sky.material.uniforms.turbidity.value      = 3.5;   // 大気濁度（霞の強さ）
sky.material.uniforms.rayleigh.value       = 3.0;   // Rayleigh 散乱（青空の強さ）
sky.material.uniforms.mieCoefficient.value = 0.003; // Mie 散乱（靄・太陽周りの輝き）
sky.material.uniforms.mieDirectionalG.value = 0.85; // 前方散乱指数
sky.material.uniforms.sunPosition.value    = sunVec; // 太陽位置ベクトル
```

### 太陽位置

球座標系で設定:

```javascript
// 仰角 25°、方位 132°（南南東）
sun.setFromSphericalCoords(
  1,
  THREE.MathUtils.degToRad(90 − 25),   // 天頂角
  THREE.MathUtils.degToRad(132),        // 方位角
)
```

午前中の太陽高度を想定。順光気味で艦体をよく照らす方位。

---

## 4. 環境マップ（PMREM）

Sky シーンを事前統合（PMREM）して環境マップを生成し、金属材料の反射に使用する。

```javascript
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(sky);                              // Sky のみのシーンを
scene.environment = pmrem.fromScene(envScene).texture;  // PMREMで積分
scene.add(sky);   // PMREM 後に本シーンへ戻す
```

`metalness` が高いマテリアル（bronze, barrel, glass 等）が空の色を反射する。

---

## 5. 海面（Water）

Three.js `Water` アドオン（フレネル反射 + FFT 波）を使用。

```javascript
const water = new Water(new THREE.PlaneGeometry(14000, 14000), {
  textureWidth:    1024,
  textureHeight:   1024,
  waterNormals:    makeWaterNormals(),   // 手続き生成の法線マップ
  sunDirection:    sun.clone(),
  sunColor:        0xffffff,
  waterColor:      0x06343c,            // 深海色（濃い青緑）
  distortionScale: 2.2,                 // 波の歪み量
  fog:             true,
});
water.rotation.x = -Math.PI / 2;
water.material.uniforms.size.value = 0.8;  // 波のUVスケール（大きめのうねり）
```

### 5.1 海面法線マップ `makeWaterNormals(size=512)`

CDN 外部画像に依存せず、Canvas で手続き生成する。

#### アルゴリズム

1. 24 本の正弦波を定義:
   - 周波数ベクトル `(a, b)`: 整数乱数（−14〜14 の範囲）
   - **整数周波数により C0 連続性を保証**（タイル境界でシームが生じない）
   - 振幅 = `1 / f^1.3` で高周波ほど減衰（Pierson-Moskowitz スペクトル近似）
   - 位相: ランダム

2. 高さ場 `h(x, y)` = 各正弦波の線形和

3. 法線マップ化（中心差分）:
   ```
   dx = (h(x+1, y) − h(x−1, y)) × S    // S = 22（傾きスケール）
   dy = (h(x, y+1) − h(x, y−1)) × S
   N = normalize(−dx, −dy, 1)           // 接空間法線
   R = N × 0.5 + 0.5                    // [0,1] にエンコード
   ```

4. 各ピクセル `(R, G, B, 255)` に書き込み → `CanvasTexture`

### 5.2 水面反射率パッチ

Three.js Water シェーダのデフォルト実装はベース反射率を 0.3（30%）に固定しており、海面が白くなりすぎる問題がある。

```javascript
// シェーダのソース文字列を実行時にパッチ
water.material.fragmentShader =
  water.material.fragmentShader.replace('rf0 = 0.3', 'rf0 = 0.1');
water.material.needsUpdate = true;
```

`rf0 = 0.1` とすることでフレネル反射がより控えめになり、深い海色が表現できる。

---

## 6. ライティング

### 6.1 DirectionalLight（太陽光）

```javascript
const sunLight = new THREE.DirectionalLight(0xfff1da, 2.8);
sunLight.position.copy(sun).multiplyScalar(1200);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(4096, 4096);
```

#### シャドウカメラ設定

```javascript
sc.left = -180; sc.right = 180;   // 艦体全長 263m をカバー
sc.top  = 120;  sc.bottom = -60;
sc.near = 600;  sc.far   = 2200;
sunLight.shadow.bias       = -0.0002;  // ピーターパン現象を抑制
sunLight.shadow.normalBias =  0.6;     // 自己シャドウのアーティファクト低減
```

| 設定 | 値 | 理由 |
|------|----|----|
| 色温度 | `0xfff1da`（暖色） | 太陽光の黄みを表現 |
| 強度 | 2.8 | ACES + 露出 0.4 で適切な明るさ |
| シャドウマップ | 4096 × 4096 px | 高精細な影（主砲塔・手すりの影まで） |

### 6.2 HemisphereLight（天空光）

```javascript
new THREE.HemisphereLight(
  0xbed3e4,  // 空色（上から）
  0x16242e,  // 海色（下から）
  0.5,       // 強度
)
```

空からの拡散光をシミュレート。金属材料の影部分に自然な青みを与える。

---

## 7. 霧（Fog）

```javascript
scene.fog = new THREE.Fog(0xaec6d8, 2400, 13000);
```

| 設定 | 値 | 説明 |
|------|----|----|
| 色 | `0xaec6d8`（水色） | 遠景の霞色 |
| 開始距離 | 2,400 m | カメラから 2.4 km 付近から霞み始める |
| 終了距離 | 13,000 m | 水平線は霞で完全に消える |

ワイヤーフレームモード時は `scene.fog = null` で無効化。

---

## 8. アニメーションループ

```javascript
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  const t  = clock.elapsedTime;

  env.update(dt);                        // 水面タイム更新
  water.material.uniforms.time.value += dt * 0.55;

  // 停泊中の艦体動揺（微小な sin 波）
  yamato.position.y = Math.sin(t × 0.5)  × 0.16;  // ヒービング
  yamato.rotation.x = Math.sin(t × 0.38) × 0.0035; // ピッチング
  yamato.rotation.z = Math.sin(t × 0.31) × 0.005;  // ローリング

  controls.update();                     // OrbitControls ダンピング
  renderer.render(scene, camera);
});
```

### 動揺パラメータ

| 運動 | 振幅 | 周期（秒） |
|------|------|---------|
| ヒービング（上下） | 0.16 m | 12.6 s |
| ピッチング（前後傾） | 0.0035 rad | 16.5 s |
| ローリング（左右傾） | 0.005 rad | 20.3 s |

周期は互いに素で、周期的パターンの繰り返しを防ぐ。

---

## 9. 初回フレーム処理

```javascript
if (firstFrame) {
  firstFrame = false;
  document.getElementById('loading').classList.add('hidden');
  stat.textContent = `三角形数: ${renderer.info.render.triangles.toLocaleString()}`;
}
```

最初のフレームが描画された直後にローディング画面を非表示にし、三角形数を表示する。

---

## 10. リサイズ対応

```javascript
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```
