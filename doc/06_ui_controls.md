# 設計書 06 — UI・カメラ制御設計

対象ファイル: `js/controls.js` / `index.html` / `css/style.css`

---

## 1. カメラ操作（OrbitControls）

`setupControls(camera, dom)` で OrbitControls を初期化する。

```javascript
c.target.set(0, 9, 0);       // 注視点：艦体中央の水線上 9 m
c.enableDamping  = true;
c.dampingFactor  = 0.06;     // 慣性（小さいほど粘り強い）
c.minDistance    = 18;       // 最近接（艦体へのめり込み防止）
c.maxDistance    = 1500;     // 最遠（全景を俯瞰可能）
c.maxPolarAngle  = 1.54;     // 約 88°（海面下へ潜り込まない）
c.autoRotateSpeed = 0.6;     // 自動回転速度（°/フレーム）
```

### 操作マッピング

| 操作 | 動作 |
|------|------|
| 左ドラッグ | 回転（Orbit） |
| 右ドラッグ | 平行移動（Pan） |
| マウスホイール | 拡大縮小（Dolly） |
| タッチ: 1 本指 | 回転 |
| タッチ: 2 本指ピンチ | 拡大縮小 |
| タッチ: 2 本指スライド | 移動 |

---

## 2. 描画モード切替（Wireframe / Real）

`setupUI({ scene, yamato, env, controls, grid })` で UI を初期化する。

### 2.1 モード状態管理

```javascript
let wireframe = false;  // 現在のモード（false = リアル）
```

### 2.2 切替処理 `setMode(wire)`

```
1. wire が現在モードと同じならスキップ
2. yamato グループを traverse でメッシュ全走査
   - wire = true:  userData.realMaterial に元マテリアルを退避 → wireMat へ差し替え
   - wire = false: userData.realMaterial を復元
3. 環境表示の切替
   - wire = true:  sky.visible = false, water.visible = false, fog = null
                   scene.background = 暗色（#071520）, grid.visible = true
   - wire = false: sky.visible = true, water.visible = true, fog = 元の fog
                   scene.background = null, grid.visible = false
4. ボタンのアクティブクラス更新
```

### 2.3 ワイヤーフレームマテリアル

```javascript
const wireMat = new THREE.MeshBasicMaterial({
  wireframe:  true,
  color:      0x4fd2ff,  // 設計図的な青シアン
  transparent: true,
  opacity:    0.5,
  depthWrite: false,     // 後ろのワイヤーも透けて見える
});
```

### 2.4 グリッド（ワイヤーフレームモード用）

```javascript
new THREE.GridHelper(800, 80, 0x1c4e6e, 0x0e2c42)
// 800m × 800m、80 分割（10m ピッチ）
// 艦長 263m に対して十分な範囲
```

---

## 3. イベントバインディング

```javascript
btnReal.addEventListener  ('click', () => setMode(false));
btnWire.addEventListener  ('click', () => setMode(true));
window.addEventListener   ('keydown', (e) => {
  if (e.key === 'w' || e.key === 'W') setMode(!wireframe);
});
btnRotate.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  btnRotate.classList.toggle('active', controls.autoRotate);
});
```

| トリガー | 動作 |
|---------|------|
| `#btn-real` クリック | リアルモードへ |
| `#btn-wire` クリック | ワイヤーフレームモードへ |
| `W` / `w` キー | 現在モードをトグル |
| `#btn-rotate` クリック | 自動回転 ON/OFF トグル |

---

## 4. HTML マークアップ（UI 要素）

```html
<!-- ローディング画面 -->
<div id="loading">
  <div class="spinner"></div>
  <p>大和 建造中…</p>
</div>

<!-- ブランドタイトル -->
<div id="brand">⚓ 戦艦大和</div>

<!-- 描画モードパネル -->
<div id="mode-panel">
  <button id="btn-real"   class="active">リアル</button>
  <button id="btn-wire">ワイヤー</button>
  <button id="btn-rotate">自動回転</button>
</div>

<!-- ヘルプバー -->
<div id="help">左ドラッグ: 回転 ／ 右ドラッグ: 移動 ／ ホイール: ズーム ／ W: 切替</div>

<!-- 三角形カウンタ（初回フレームで更新） -->
<span id="stat"></span>
```

---

## 5. CSS スタイル設計

### 5.1 基本レイアウト

```css
body { margin: 0; overflow: hidden; background: #000; }
canvas { display: block; }
```

WebGL Canvas がウィンドウ全面を占有。

### 5.2 グラスモーフィズム UI

```css
#mode-panel {
  backdrop-filter: blur(12px);
  background: rgba(8, 18, 30, 0.68);
  border: 1px solid rgba(120, 160, 210, 0.2);
  border-radius: 10px;
  padding: 8px 10px;
  gap: 6px;
}
```

3D シーンの上に半透明ガラス風でオーバーレイ。

### 5.3 アクティブボタン

```css
button.active {
  background: rgba(79, 150, 220, 0.35);
  border-color: rgba(130, 190, 255, 0.5);
  color: #c8e4ff;
}
```

### 5.4 ローディングスピナー

```css
.spinner {
  width: 48px; height: 48px;
  border: 4px solid rgba(255,255,255,0.15);
  border-top-color: #5baee8;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

---

## 6. デバッグフック

```javascript
window.__yamato = { camera, controls, scene, renderer, yamato };
```

ブラウザの開発者コンソールから各オブジェクトへ直接アクセス可能。

例:
```javascript
// コンソールでカメラ位置を確認
window.__yamato.camera.position

// 艦体を非表示にする
window.__yamato.yamato.visible = false

// ワイヤーフレームの三角形数
window.__yamato.renderer.info.render.triangles
```
