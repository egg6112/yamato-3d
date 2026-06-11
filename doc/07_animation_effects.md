# 設計書 07 — 砲塔アニメーション・煙エフェクト設計

対象ファイル: `js/animation.js` / `js/smoke.js` / `js/yamato/turrets.js`（userData 登録）

---

## 1. オブジェクト構造（アニメーション対応）

```
砲塔 Group（rotation.y = 旋回）          ← turrets.js の buildTurret() 戻り値
 ├── 砲室・測距儀・天蓋ディテール
 └── 砲身ピボット Group × 3（rotation.z = 俯仰）
      ├── 砲身（CylinderGeometry, +X 方向）
      ├── 砲口段差
      └── 防水布バッグ
```

- 砲塔 5 基（主砲 3 + 副砲 2）は `buildTurrets()` が `group.userData.turrets` に配列登録し、`yamato/index.js` が `ship.userData.turrets` へ引き上げる
- 各砲塔は `userData` に以下を保持:

| キー | 内容 |
|------|------|
| `baseRotY` | 基準旋回角（前部 0 / 後部 π） |
| `baseElev` | 初期俯仰角（主砲 0.07 rad / 副砲 0.1 rad） |
| `pivots` | 砲身ピボット Group × 3 の配列 |

### 俯仰軸について

要件では `rotation.x` と表記されているが、本モデルの砲身はピボットローカルの **+X 方向**を向くため、俯仰（上下角変更）に対応する回転軸は **`rotation.z`** である。+Z 回転で砲口が上を向く。旋回（`rotation.y`）とは軸が独立しており、両者は干渉しない。

---

## 2. アニメーター（animation.js）

`createAnimator(yamato)` が `update(dt)` / `setTurretAnim(on)` / `setBarrelAnim(on)` を返す。

### 2.1 砲塔旋回

| パラメータ | 値 |
|-----------|-----|
| 旋回範囲 | `baseRotY ± 150°` |
| 速度 | 9〜14 °/s（砲塔ごとに変化、一定速度） |
| 動作 | ピンポン（端点で反転） |
| 初期方向 | 砲塔インデックス偶数 = 右、奇数 = 左（バラつき演出） |

```javascript
s.yaw += s.yawDir * s.yawSpeed * dt;
if (s.yaw >= s.yawMax) { s.yaw = s.yawMax; s.yawDir = -1; }
else if (s.yaw <= s.yawMin) { s.yaw = s.yawMin; s.yawDir = 1; }
s.obj.rotation.y = s.yaw;
```

### 2.2 砲身俯仰

| パラメータ | 値 |
|-----------|-----|
| 俯仰範囲 | −5° 〜 +45° |
| 速度 | 6〜9.6 °/s（砲塔ごとに変化） |
| 動作 | ピンポン。砲塔内の 3 砲身は同期 |

### 2.3 ON/OFF 仕様

- 状態はフラグのみ。OFF にすると `update()` が角度を書き換えなくなり、**現在の角度で停止**する
- 再度 ON にすると停止角度から続行（ジャンプしない）
- 旋回と俯仰は完全に独立したフラグ・速度で制御

---

## 3. 煙突の煙（smoke.js）

`createSmoke()` が `{ points, update(dt) }` を返す。`points` は艦 Group の子として追加され、動揺に追従する。

### 3.1 実装方式

- `THREE.Points` + `ShaderMaterial`（パーティクル 240 個）
- スプライト: Canvas 放射グラデーション（64px、外周透明）
- 頂点属性: `position` / `aAlpha`（透明度） / `aSize`（ワールドサイズ m）
- `gl_PointSize = aSize × uPxScale / 距離`（遠近スケーリング、FOV 45° 基準）
- `transparent: true` / `depthWrite: false` / `renderOrder = 5`
- `frustumCulled = false`（煙柱がエミッタから大きく離れるため）

### 3.2 パーティクル寿命サイクル

| フェーズ | 内容 |
|---------|------|
| 放出 | 煙突頂部 (−12.9, 27.2, 0) の楕円口（2.3 × 1.5 m）からランダム放出 |
| 初速 | 上昇 2.6〜5.0 m/s ／ 後方 −1.2〜−2.6 m/s（後傾煙突 + 風） ／ 横 ±0.45 m/s |
| 寿命 | 5〜9 秒（個体差） |
| 透明度 | 出現時 0.12 寿命でフェードイン → `(1−life)^1.35 × 0.55` で減衰 |
| サイズ | 2.4 m → 12.9 m へ線形膨張 |
| 風 | `vel.x −= 0.25·dt`（後方へ加速し続ける） |
| 再生成 | 寿命満了で煙突口へ戻る（リングバッファ方式） |

初期化時は `life` をランダム散布し、起動直後から定常状態の煙柱が立つ。

### 3.3 表示制御

- リアルモードのみ表示。`controls.js` の `setMode()` が `smoke.points.visible = !wire` を設定
- `update()` は `visible === false` のとき早期 return（CPU 節約）
- `Points` は `isMesh` ではないため、ワイヤーフレームのマテリアル差し替え対象外（構造的に安全）

---

## 4. UI（index.html / controls.js）

| ボタン | id | 動作 |
|--------|----|----|
| 砲塔旋回 | `#btn-turret` | `animator.setTurretAnim()` トグル |
| 砲身俯仰 | `#btn-barrel` | `animator.setBarrelAnim()` トグル |

いずれもトグルのみ（角度スライダー等はなし）。アクティブ時は `.active` クラスで点灯表示。

---

## 5. ループ統合（main.js）

```javascript
env.update(dt);        // 海面
animator.update(dt);   // 砲塔・砲身
smoke.update(dt);      // 煙パーティクル
```

デバッグフック: `window.__yamato.animator` / `window.__yamato.smoke` からコンソール操作可能。
