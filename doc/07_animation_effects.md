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
| 旋回範囲 | `baseRotY ± sweep`（砲塔ごとの射界制限、下表参照） |
| 速度 | 9〜14 °/s（砲塔ごとに変化、一定速度） |
| 動作 | ピンポン（端点で反転） |
| 初期方向 | 砲塔インデックス偶数 = 右、奇数 = 左（バラつき演出） |

### 2.1.1 射界制限（めり込み防止）

砲塔ごとに `userData.limits = { sweep, elevMin, elevMax }`（deg）を定義し、
旋回・俯仰がこの範囲を超えないようクランプする。値は砲身先端の到達位置を
艦首シア・隣接砲塔・上構の干渉条件から逆算して決定した。

| 砲塔 | sweep | elevMin | elevMax | 制限理由 |
|------|-------|---------|---------|---------|
| 主砲 1 番（x=63） | ±150° | 0° | +45° | 俯角で砲身先端が艦首シア甲板（最大 y≈10.4m）に接触 |
| 主砲 2 番（x=40） | ±135° | +3° | +45° | 背負い式: 前方射撃時に一番砲塔天蓋(y≈13.5m)を越える仰角が必要。±150° では第二上構(y14.0)に砲身が接触 |
| 主砲 3 番（x=−63） | ±120° | −2° | +45° | 前方旋回時に第一上構(x −52..30)へ砲身が進入。俯角は艦尾甲板と接触 |
| 副砲 前部（x=20） | ±135° | −5° | +45° | 後方旋回時に艦橋塔（x 1..11, 半幅 5m）へ接近 |
| 副砲 後部（x=−42） | ±150° | −5° | +45° | 後部艦橋(z±2.7)との最接近でも 1m 以上のクリアランスあり |

### 2.1.2 ピボット位置の調整

砲身ピボット（俯仰回転中心）を砲室内部 `Lf − 0.5` から **砲室前面（砲門）位置
`Lf + bevel × 0.4`** へ前進させた。回転中心が前面にあるため、最大仰角 +45° でも
砲身根元が天蓋・前面装甲を突き抜けない。

```javascript
s.yaw += s.yawDir * s.yawSpeed * dt;
if (s.yaw >= s.yawMax) { s.yaw = s.yawMax; s.yawDir = -1; }
else if (s.yaw <= s.yawMin) { s.yaw = s.yawMin; s.yawDir = 1; }
s.obj.rotation.y = s.yaw;
```

### 2.2 砲身俯仰

| パラメータ | 値 |
|-----------|-----|
| 俯仰範囲 | `elevMin` 〜 `elevMax`（砲塔ごと、上表参照。基準 −5°〜+45°） |
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

前進走航しているように見せるため、上昇ベクトルと艦尾方向（−X）への
後方流ベクトルを合成して各パーティクルを駆動する。

| フェーズ | 内容 |
|---------|------|
| 放出 | 煙突頂部 (−12.9, 27.2, 0) の楕円口（2.3 × 1.5 m）からランダム放出 |
| 初速 | 上昇 3.0〜5.2 m/s ／ 後方 −3.2〜−5.6 m/s（前進走航の相対風） ／ 横 ±0.4 m/s |
| 寿命 | 5〜9 秒（個体差） |
| 透明度 | 出現時 0.12 寿命でフェードイン → `(1−life)^1.35 × 0.55` で減衰 |
| サイズ | 2.4 m → 12.9 m へ線形膨張 |
| 風 | `vel.x −= 0.55·dt`（後方へ加速し続け、煙柱が艦尾へ寝ていく） |
| 再生成 | 寿命満了で煙突口へ戻る（リングバッファ方式） |

初期化時は `life` をランダム散布し、起動直後から定常状態の煙柱が立つ。

### 3.3 表示制御

- リアルモードのみ表示。`controls.js` の `setMode()` が `smoke.points.visible = !wire` を設定
- `update()` は `visible === false` のとき早期 return（CPU 節約）
- `Points` は `isMesh` ではないため、ワイヤーフレームのマテリアル差し替え対象外（構造的に安全）

---

## 4. UI（index.html / controls.js）

| ボタン | id | 動作 | 初期状態 |
|--------|----|----|---------|
| ワイヤーフレーム | `#btn-wire` | 描画モード切替 | **ON** |
| 自動回転 | `#btn-rotate` | カメラ自動旋回 | **ON** |
| 砲塔旋回 | `#btn-turret` | `animator.setTurretAnim()` トグル | **ON** |
| 砲身俯仰 | `#btn-barrel` | `animator.setBarrelAnim()` トグル | **ON** |

いずれもトグルのみ（角度スライダー等はなし）。アクティブ時は `.active` クラスで点灯表示。
初期状態は `setupUI()` 末尾で一括設定する（ワイヤーフレーム起動のため、煙は初期非表示）。

---

## 5. ループ統合（main.js）

```javascript
env.update(dt);        // 海面
animator.update(dt);   // 砲塔・砲身
smoke.update(dt);      // 煙パーティクル
```

デバッグフック: `window.__yamato.animator` / `window.__yamato.smoke` からコンソール操作可能。
