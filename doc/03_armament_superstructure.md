# 設計書 03 — 兵装・上構・艤装設計

対象ファイル: `js/yamato/turrets.js` / `js/yamato/superstructure.js` / `js/yamato/details.js`

---

## 1. 主砲塔・副砲塔（turrets.js）

### 1.1 砲塔形状 `turretShape(Lf, Lr, Wf, Wr)`

Three.js `Shape` で砲塔の平面輪郭を定義。

```
Lr ─────────────────── Lf (前方・丸み)
 |                       |
Wr (後部幅広)          Wf (前部幅狭)
```

- 前縁: 二次ベジェ曲線で砲口へ向かって丸まった船首形
- 後縁: 矩形（測距儀マウント側）
- この Shape を `ExtrudeGeometry` で押し出し → 砲室ボリューム

### 1.2 砲塔パラメータ定義

#### 46cm 三連装主砲塔（MAIN_OPT）

| パラメータ | 値 | 意味 |
|-----------|----|----|
| Lf | 8.5 m | 前部長さ |
| Lr | −7.2 m | 後部長さ |
| Wf | 3.0 m | 前部半幅 |
| Wr | 6.3 m | 後部半幅 |
| houseH | 2.7 m | 砲室高さ |
| bevel | 1.0 m | 傾斜装甲（ベベル） |
| barrelLen | 20.7 m | 砲身長 |
| barrelR | 0.62 m | 砲身半径 |
| spacing | 3.05 m | 砲身間隔 |
| elev | 0.07 rad | 砲身初期仰角 |

#### 15.5cm 三連装副砲塔（SEC_OPT）

| パラメータ | 値 |
|-----------|-----|
| Lf | 4.6 m |
| barrelLen | 9.3 m |
| barrelR | 0.26 m |
| spacing | 1.35 m |
| houseH | 1.7 m |

### 1.3 `buildTurret()` 構成要素

```
砲室（ExtrudeGeometry + Bevel）
  └─ 天蓋ディテール（ハッチ, ペリスコープ）
  └─ 測距儀（水平円柱 + 両端フード）  ※ rangefinder: true の場合
  └─ 砲身 × 3（CylinderGeometry、中央は recess 分後退）
       └─ ピボットグループ（elev 角度で回転）
            └─ 砲口段差（muzzle step）
            └─ 防水布バッグ（SphereGeometry × 2.1）
```

### 1.4 主砲塔配置

| 番号 | x 座標 | バーベット高さ | 向き |
|------|--------|------------|------|
| 1 番（前部） | +63 m | 1.0 m | 0° |
| 2 番（背負い式） | +40 m | 3.4 m | 0° |
| 3 番（後部） | −63 m | 1.0 m | 180° |

バーベット（旋回台）: `CylinderGeometry(6.3, 6.5, h, 36)`  
砲塔底面 Y = `deckAt(x) + barbH`

### 1.5 副砲塔配置

| 位置 | x | y | 向き |
|------|---|---|------|
| 前副砲 | +20 m | 14.0 m | 0° |
| 後副砲 | −42 m | 14.0 m | 180° |

---

## 2. 上構・艦橋（superstructure.js）

### 2.1 上構甲板室 `roundedHouse()`

`ExtrudeGeometry` で両端を丸めた甲板室を生成する共通関数。

```javascript
Shape: 角丸矩形（半径 r = min(hw, 7)）
ExtrudeGeometry({ depth: h, bevelEnabled: false })
rotateX(−π/2)   // 押し出し +Z → +Y（上方向）
```

#### 配置

| 構造物 | x 範囲 | 半幅 | 高さ | Y 底 |
|--------|--------|------|------|------|
| 第一上構 | −52〜+30 m | 12.5 m | 2.8 m | 8.62 m |
| 第二上構 | −46〜+24 m | 9.5 m | 2.6 m | 11.4 m |
| 第二上構天面（リノリウム） | −45.7〜+23.7 m | 9.3 m | 0.06 m | 14.0 m |

### 2.2 塔型艦橋（パゴダ）`buildBridgeTower()`

原点 = 艦橋中心 x=+6, y=14（第二上構天面）

#### 垂直構成（下から）

| 要素 | 高さ | サイズ | 内容 |
|------|------|--------|------|
| 司令塔 | 0〜4.5 m | R=2.7〜3.0 m 円柱 | 厚装甲（CylinderGeometry, r24） |
| 第 1 層 | 0〜4 m | 10×9 m | 箱型 |
| 第 2 層 | 4〜8 m | 8.6×8.2 m | 絞り込み |
| 第 3 層 | 8〜12 m | 7.6×7.4 m | さらに絞り込み |
| 羅針艦橋 | 12〜14.6 m | 7.2×7.8 m | ガラス窓帯付き |
| 見張所 | 14.9〜17.9 m | 5.6×5.6 m | |
| 防空指揮所 | 17.9〜19.2 m | 6.0×6.0 m | オープントップ（開放型パラペット） |
| 15m 測距儀 | 21.3〜21.5 m | L=15 m 水平円柱 | CapX2 + フード |
| 21 号電探 | 23.3 m | 4.6×2.5 m 格子 | `buildRadar21()` |
| 前檣 | 22.3〜31 m | R=0.22 m ポール | 信号桁 2 本付き |

### 2.3 21 号電探（対空レーダー）`buildRadar21()`

5×8 格子のラチスアンテナを `mergeToMesh()` で 1 ドローコールに結合。

```
外枠: 4 本の tube  (W=2.3, H=1.25, r=0.05)
横桁: 3 本  (r=0.03)
縦桁: 7 本  (r=0.03)
合計: 14 本のジオメトリを結合
```

### 2.4 煙突 `buildFunnel()`

原点 = x=−9, y=14

```
本体:   CylinderGeometry(3.6, 4.5, 13.5, 32) + scale(1, 1, 0.66)  // 楕円断面
傾き:   rotation.z = 0.3 rad（後傾）
頂部:   黒マテリアル + 雨除けグリル（5 本の tube）
蒸気捨て管: 3 本（後面沿い）
探照灯プラットフォーム: 両舷 × 1
```

### 2.5 後部三脚マスト `buildMainmast()`

原点 = x=−20, y=14

```
主柱:   tube R=0.42, 高さ 27 m（わずかに後傾）
脚柱:   後左右 × 2（V 字型）
横桁:   2 本（高さ 19 m, 22.5 m）
見張所: CylinderGeometry R=1.0
13 号電探（はしご状アンテナ）: 7 本横桁 + 2 本縦桁 → mergeToMesh
```

### 2.6 後部艦橋 `buildAftTower()`

原点 = x=−30, y=14

```
基部:    BoxGeometry(6.4, 4.2, 5.4)
中段:    BoxGeometry(5.2, 3.4, 4.4) + ガラス窓帯
頂部フード: BoxGeometry(2.6, 1.6, 2.6)
10m 測距儀: CylinderGeometry R=0.45, L=10 m 水平 + 両端キャップ
```

---

## 3. 対空兵装・艤装（details.js）

### 3.1 12.7cm 連装高角砲 `buildHAMount()`

| 型式 | 基数 | 配置 |
|------|------|------|
| 防盾付き | 6 基（port + starboard） | x = +14, −2, −18 |
| 露天型 | 6 基（port + starboard） | x = +6, −10, −26 |

- Y = 11.45 m、Z = ±10.6 m
- 砲身仰角: 0.5 rad（約 30°）

### 3.2 25mm 三連装機銃 `buildTripleAAGeometry()`

1 基分を `BufferGeometryUtils.mergeGeometries()` で 1 ジオメトリに結合し、同じジオメトリを 22 箇所のメッシュが共有する。

```
銃座:    CylinderGeometry(0.5, 0.62, 0.85, 12)
旋回部:  BoxGeometry(1.0, 0.55, 1.05)
銃身×3: CylinderGeometry(0.045, 0.06, 3.1, 8) × 3  仰角 15°（0.26 rad）
弾倉:   BoxGeometry(0.5, 0.32, 0.9)
射手席: BoxGeometry(0.42, 0.4, 0.34) × 2
```

#### 配置（22 基）

| エリア | 基数 |
|--------|------|
| 艦首甲板 | 1 基 |
| 前甲板（左右） | 2 基 |
| 二番主砲塔天蓋 | 2 基 |
| 上構天面（左右） | 8 基 |
| 第一上構舷側（左右） | 4 基 |
| 後甲板（左右） | 4 基 |
| 艦尾 | 1 基 |

### 3.3 110cm 探照灯 `buildSearchlights()`

煙突脇プラットフォーム上に 4 基配置（port 2 + starboard 2）。

```
台座:   CylinderGeometry(0.22, 0.3, 1.1, 10)
ドラム: CylinderGeometry(0.62, 0.62, 0.75, 18)  rotation.x = π/2（横向き）
レンズ: CircleGeometry(0.56, 18)  マテリアル lens（emissive 付き）
```

### 3.4 カタパルト `buildCatapult()`

艦尾両舷に 2 基。回転台 + トラスレール（全長 19.5 m）。

```
回転台:   CylinderGeometry(1.5, 1.7, 0.6, 16)
上レール: barGeometry × 2（gauge = ±0.62 m）
下レール: barGeometry × 2
X ブレース: tubeGeometry、ピッチ 1.55 m でループ
→ mergeToMesh で 1 ドローコール
```

配置:
- x = −96, z = ±7.2
- 回転角: π ± 0.45 rad（艦尾斜め外方）

### 3.5 クレーン `buildCrane()`

艦尾中央に 1 基。

```
垂直マスト: tube R=0.45, H=8.8 m
ラチスブーム（14.5 m + 仰角）:
  三弦トラス（3 コード + 横補剛材）→ mergeToMesh
吊りワイヤー: tube R=0.03（マスト頂部 → ブーム先端）
フック:       tube（垂下）
```

### 3.6 内火艇・カッター `buildBoats()`

4 艇（左右 × 2 種）を甲板上 y=8.95 m, x=−50/−56 に格納。

```
船体: SphereGeometry(1, 18, 12) + scale(len/2, 0.85, 1.05)
甲板: CircleGeometry(1, 18) rotation.x=−π/2, y=+0.32 m
材料: woodBoat（木製）/ linoleum（甲板）
```

### 3.7 錨・錨鎖・キャプスタン `buildGroundTackle()`

port / starboard 各 1 組。

#### 主錨（ホールス型）

```
シャンク:  BoxGeometry(0.3, 3.0, 0.5)
クラウン:  BoxGeometry(0.5, 0.7, 1.9)
フルーク:  BoxGeometry(0.22, 1.7, 0.75) × 2  rotation.x = ±0.25 rad
配置: x=118, y=10.6, z=±4.0
```

#### 錨鎖（30 リンク）

```
各リンク: TorusGeometry(0.17, 0.05, 6, 10)
配置: A(115.5, deck+0.32, ±2.9) → B(104, deck+0.32, ±2.3)
方向: 交互に 90° 回転（実物の chain link を再現）
→ mergeToMesh で 1 ドローコール
```

#### キャプスタン（揚錨機）

`CylinderGeometry(0.55, 0.4, 0.8, 14)` at x=103

### 3.8 舷側手すり `buildRailings()`

全通（x = −127 〜 +128 m）を port / starboard に生成。

```
ピッチ:   4.4 m ごとに支柱 1 本
高さ:     1.05 m
断面:
  支柱 R=0.035（tubeGeometry）
  上段手すり R=0.024（隣接支柱頂部を連結）
  中段手すり R=0.020（高さ 0.55 H）
→ 全部 mergeToMesh（port + starboard で 1 メッシュ）
```

### 3.9 菊花紋章 `buildBowCrest()`

```
CircleGeometry(1.15, 32)
position: (130.6, 13.4, 0)  // 艦首正面
rotation.y: π/2 − 0.06 rad  // 正面へ向ける
material: MeshStandardMaterial
  map: chrysanthemumTexture()（16 弁・金色）
  metalness: 0.85, roughness: 0.3
```

### 3.10 旗竿 `buildStaffs()`

| 旗竿 | x | 長さ |
|------|---|------|
| 艦首旗竿 | +129.8 | 4.2 m |
| 艦尾軍艦旗竿 | −129.5 | 5.0 m |

---

## 4. ジオメトリヘルパー（utils.js）

### 4.1 `tubeGeometry(a, b, r, radialSeg=8)`

2 点間を結ぶ円柱ジオメトリを生成し、変換を適用済みで返す。

```javascript
len = |b − a|
g = CylinderGeometry(r, r, len, radialSeg, 1)
g.applyQuaternion(   // Y 軸 → (b−a) 方向へ回転
  Quaternion.fromUnitVectors(Y_AXIS, dir.normalize()))
g.translate(midpoint)
```

### 4.2 `barGeometry(a, b, w, h)`

2 点間を結ぶ矩形断面梁。X 軸 → (b−a) 方向へ回転。

### 4.3 `mergeToMesh(geometries, mat)`

`BufferGeometryUtils.mergeGeometries()` で結合し、ソースジオメトリを `dispose()` してメッシュを返す。ドローコール削減が主目的。
