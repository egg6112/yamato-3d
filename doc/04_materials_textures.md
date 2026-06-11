# 設計書 04 — マテリアル・テクスチャ設計

対象ファイル: `js/materials.js`

---

## 1. 設計方針

- **PBR マテリアル** (`MeshStandardMaterial`) のみ使用
- **テクスチャはランタイム生成** — Canvas 2D API で描画し `CanvasTexture` に変換
- 外部画像ファイル不要（完全自己完結）
- 異方性フィルタリング 8× を全テクスチャに適用

---

## 2. テクスチャ生成基盤 `canvasTexture(draw, w, h, srgb)`

```javascript
function canvasTexture(draw, w=512, h=512, srgb=true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;  // タイル状に繰り返し
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
```

| 引数 | デフォルト | 説明 |
|------|----------|------|
| draw | — | `(ctx, w, h) => void` 形式の描画コールバック |
| w, h | 512 | テクスチャ解像度（px） |
| srgb | true | カラースペース指定（カラーテクスチャ向け） |

---

## 3. 鋼板テクスチャ `platingTexture(seamStrength)`

解像度: 512 × 512 px

### 描画レイヤー（重ね順）

1. **ベース** — `#cfcfcf` 灰色の矩形塗りつぶし
2. **ノイズ斑** — 9,000 点のランダムピクセル（明度 190〜240、不透明度 16%）
3. **ウェザリング縦縞** — 90 本の雨垂れ・錆流れ（グラデーション線、長さ 30〜180 px）
4. **横継ぎ目** — 64 px ピッチで水平線（不透明度 × seamStrength）
5. **縦継ぎ目（千鳥配置）** — 128 px ピッチ × 交互オフセット（不透明度 × seamStrength）
6. **リベット** — 9 px ピッチで 1.6 × 1.6 px の点列（継ぎ目線上）

### 使用箇所

| マテリアル | seamStrength | 用途 |
|-----------|-------------|------|
| `hull` | 1.0 | 船体（継ぎ目・リベットを強く） |
| `steel`, `steelDark` | 0.35 | 上構（控えめ） |

---

## 4. 木甲板テクスチャ `woodDeckTexture()`

解像度: 512 × 512 px

### 描画手順

1. **板幅定義**: 32 px = 約 20 cm 相当（512 px ÷ 16 枚）
2. **各板の基本色**: `hsl(36〜44°, 18〜32%, 60〜70%)` でランダムな個性
3. **木目**: 板ごとに 26 本のベジェ曲線（不透明度 5〜13%）
4. **突き合わせ継ぎ目**: 板の長さ方向に千鳥配置で暗色帯（2 px 幅）
5. **コーキング（目地）**: 各板の左端に黒線（1.6 px 幅、不透明度 85%）
6. **使用感**: 2,200 点の茶色ノイズ（ストライプ形状）

---

## 5. 菊花紋章テクスチャ `chrysanthemumTexture()`

解像度: 256 × 256 px（`canvasTexture()` で `srgb=true`）

### 描画手順

1. **花弁 × 16**: 22.5° 間隔で回転し、二次ベジェ曲線で楕円形花弁を描画
   - グラデーション: `#e8c44a → #d4a92f → #a87f1d`（金色系）
   - 輪郭: `rgba(120,90,20,0.7)` 1.2 px のストローク
2. **中心円**: 半径 R×0.18 の放射グラデーション（`#f0d060 → #c89c28`）

マテリアル `MeshStandardMaterial` は別途 `details.js` 内で組み立て  
（metalness=0.85, roughness=0.3, transparent=true）

---

## 6. マテリアル一覧

### 6.1 `hull` — 船体外板

```javascript
MeshStandardMaterial({
  map:          platingTexture(1.0),  // 512px 鋼板テクスチャ
  bumpMap:      platingTexture(1.0),  // バンプ（法線擬似）
  bumpScale:    0.05,
  vertexColors: true,                 // 頂点カラーで塗り分け
  roughness:    0.58,
  metalness:    0.34,
})
```

### 6.2 `deck` — 木甲板

```javascript
MeshStandardMaterial({
  map:       woodDeckTexture(),
  bumpMap:   woodDeckTexture(),
  bumpScale: 0.02,
  color:     0xf0e2c4,     // 全体を少し黄みにシフト
  roughness: 0.88,
  metalness: 0.04,
})
```

### 6.3 `steel` — 上構鋼（呉海軍工廠グレー）

```javascript
MeshStandardMaterial({
  map:      platingTexture(0.35),
  color:    0x7c8288,
  roughness: 0.56,
  metalness: 0.44,
})
```

### 6.4 `steelDark` — 暗鋼（甲板上構造物・基部）

```javascript
MeshStandardMaterial({
  map:      platingTexture(0.35),
  color:    0x5a6066,
  roughness: 0.60,
  metalness: 0.42,
})
```

### 6.5 `barrel` — 砲身

```javascript
MeshStandardMaterial({
  color:    0x4b5054,
  roughness: 0.42,
  metalness: 0.66,   // 高い金属感
})
```

### 6.6 `dark` — 黒鉄（機銃・錨・煙突頂部）

```javascript
MeshStandardMaterial({ color: 0x26292c, roughness: 0.58, metalness: 0.52 })
```

### 6.7 `funnelTop` — 煙突頂部

```javascript
MeshStandardMaterial({ color: 0x141517, roughness: 0.50, metalness: 0.60 })
```

### 6.8 `bronze` — プロペラ（マンガン青銅）

```javascript
MeshStandardMaterial({ color: 0x9a7a42, roughness: 0.38, metalness: 1.0 })
```

### 6.9 `brass` — 真鍮・金

```javascript
MeshStandardMaterial({ color: 0xd9b13b, roughness: 0.28, metalness: 1.0 })
```

### 6.10 `canvas` — 防水布（砲身基部カバー）

```javascript
MeshStandardMaterial({ color: 0xcfc8b6, roughness: 0.95, metalness: 0.0 })
```

### 6.11 `woodBoat` — 内火艇外板

```javascript
MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.80, metalness: 0.05 })
```

### 6.12 `lens` — 110cm 探照灯レンズ

```javascript
MeshStandardMaterial({
  color:             0xcfe4f0,
  roughness:         0.12,
  metalness:         0.90,
  emissive:          0x223844,
  emissiveIntensity: 0.4,      // 微弱な自発光（点灯感）
})
```

### 6.13 `glass` — 艦橋窓ガラス帯

```javascript
MeshStandardMaterial({ color: 0x10181f, roughness: 0.15, metalness: 0.85 })
```

### 6.14 `linoleum` — リノリウム甲板（第二上構天面・艇甲板）

```javascript
MeshStandardMaterial({ color: 0x6e5747, roughness: 0.90, metalness: 0.02 })
```

---

## 7. テクスチャ再利用

```
platingTexture(1.0)  → hull の map + bumpMap（同一インスタンス）
platingTexture(0.35) → noise として steel + steelDark が共有
woodDeckTexture()    → deck の map + bumpMap（同一インスタンス）
```

bumpMap と map に同じテクスチャを使うことで、鋼板の継ぎ目・リベットが法線変化として現れ立体感が増す。

---

## 8. ワイヤーフレームマテリアル（controls.js 内）

```javascript
new THREE.MeshBasicMaterial({
  wireframe:   true,
  color:       0x4fd2ff,  // シアン青（設計図イメージ）
  transparent: true,
  opacity:     0.5,
  depthWrite:  false,
})
```

切替時は各メッシュの `material` をこれに置き換え、元のマテリアルを `userData.realMaterial` に退避する。
