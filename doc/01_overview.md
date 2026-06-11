# 設計書 01 — システム概要・アーキテクチャ

## Fable5への初期の指示
あなたは 3D モデリングエンジニアとして行動してください。

目的：
戦艦大和の 3D モデルを作成し、以下の条件を満たすプロジェクトを構築すること。

要件：
1. 戦艦大和の外観を、実写に近いリアルな質感で再現すること。
2. モデルを自由に回転・移動・拡大縮小できるインタラクティブビューアを実装すること。
3. 「リアル描画」と「ワイヤーフレーム描画」をワンタッチで切り替えられる UI を用意すること。
4. Web ブラウザで動作する形でプロジェクトを構築すること。
5. 使用技術は Three.js を基本とし、必要に応じてテクスチャ・マテリアル・ライトを設定すること。
6. プロジェクト構成、ファイル構造、必要なアセット、コードをすべて生成すること。
7. 生成前に、実装方針とファイル構成の計画を提示し、私の承認を待つこと。

出力形式：
- まず「実装計画」を提示する
- 私が OK を出したら、コード生成とプロジェクト構築を開始する


## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | 戦艦大和 3D インタラクティブビューア |
| 公開 URL | https://egg6112.github.io/yamato-3d/ |
| リポジトリ | https://github.com/egg6112/yamato-3d |
| レンダラ | Three.js r160（CDN / importmap） |
| 動作環境 | モダンブラウザ（Chrome / Edge / Firefox / Safari） |
| 実行形態 | 静的 HTML ファイル — ビルドステップなし |
| スケール | 1 unit = 1 m（実艦原寸） |
| 三角形数 | 68,392（モデル実数。シャドウパス込みの描画カウントは約 13.4 万） |

## 2. 設計方針

### 2.1 アセット完全自己完結

外部 3D モデル（.glb / .obj）・画像テクスチャを一切使わない。

- **船体・艤装ジオメトリ** — JavaScript コードでプロシージャル生成
- **鋼板・木甲板テクスチャ** — Canvas 2D API でランタイム生成
- **海面法線マップ** — 整数周波数正弦波合成でランタイム生成
- **Three.js 本体** のみ CDN（jsDelivr）から取得

### 2.2 ES Modules + importmap（ビルド不要）

```html
<script type="importmap">
{
  "imports": {
    "three":         "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}
</script>
```

モジュールバンドラー不要。`git push` → GitHub Pages で即公開。

### 2.3 高精細・高品質優先

パフォーマンスより外観品質を優先する。主な指標:

| 要素 | 設定値 |
|------|--------|
| 船体ステーション数 | 170 × 53 リング頂点 |
| シャドウマップ | 4096 × 4096 px（PCFSoftShadow） |
| テクスチャ異方性フィルタ | 8× |
| ACES フィルミックトーンマッピング | 露出 0.4 |
| アンチエイリアス | WebGL MSAA（antialias: true） |

---

## 3. ファイル構成

```
yamato-3d/
├── index.html              # エントリポイント / importmap / UI マークアップ
├── css/
│   └── style.css           # フルスクリーン Canvas / グラスモーフィズム UI
├── js/
│   ├── main.js             # レンダラ・シーン・ループ統括
│   ├── controls.js         # OrbitControls / 描画モード切替 UI
│   ├── materials.js        # PBR マテリアル + Canvas テクスチャ生成
│   ├── environment.js      # 空・海・太陽光・環境マップ
│   ├── animation.js        # 砲塔旋回・砲身俯仰・スクリュー回転
│   ├── smoke.js            # 煙突の煙パーティクル
│   ├── wake.js             # 航跡・スクリュー気泡・艦首波
│   └── yamato/
│       ├── index.js        # 大和モデル統合エントリ
│       ├── hull.js         # 船体ロフト・甲板・推進器・舵
│       ├── superstructure.js  # 艦橋・煙突・後部マスト
│       ├── turrets.js      # 主砲塔・副砲塔
│       ├── details.js      # 対空兵装・艤装ディテール
│       └── utils.js        # ジオメトリ生成ヘルパー
└── doc/                    # 本設計書群
```

---

## 4. モジュール依存関係

```
main.js
  ├── materials.js          (createMaterials)
  ├── environment.js        (createEnvironment)
  │     └── three/addons/objects/Sky.js
  │     └── three/addons/objects/Water.js
  ├── yamato/index.js       (buildYamato)
  │     ├── yamato/hull.js
  │     │     └── yamato/utils.js
  │     ├── yamato/superstructure.js
  │     │     └── yamato/utils.js
  │     ├── yamato/turrets.js
  │     │     └── yamato/hull.js (deckAt)
  │     └── yamato/details.js
  │           ├── yamato/utils.js
  │           ├── yamato/hull.js (deckAt, halfBeamAt, HALF)
  │           └── materials.js (chrysanthemumTexture)
  └── controls.js
        └── three/addons/controls/OrbitControls.js
```

---

## 5. レンダリングパイプライン概略

```
レンダラ初期化（WebGL, antialias, ACES ToneMapping）
       ↓
シーン構築
  ├── 大気散乱 Sky（Rayleigh/Mie）
  ├── PMREMGenerator → 環境マップ（金属反射用）
  ├── Water シェーダ（海面波 + 反射/屈折）
  ├── DirectionalLight（太陽光・影付き）
  ├── HemisphereLight（空の拡散光）
  └── 大和モデル（Group の階層）
       ↓
アニメーションループ
  ├── env.update(dt)   … 水面タイムカウント
  ├── 船体揺動         … sin 波による微小動揺
  ├── OrbitControls.update()
  └── renderer.render(scene, camera)
```

---

## 6. 描画モード

| モード | 説明 |
|--------|------|
| リアル | PBR マテリアル + 空 + 海 + 太陽光 + 影 |
| ワイヤーフレーム | 青緑ワイヤー + 暗背景 + グリッド。空・海・霧を非表示 |

切替は UI ボタン または `W` キーで即時反映。
ワイヤーフレーム切替時はメッシュの `material` を swap し、元のマテリアルを `userData.realMaterial` に退避する。

---

## 7. 外部ライブラリ

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| three | r160 | 3D レンダラ本体 |
| three/addons/objects/Sky.js | r160 | 大気散乱シェーダ |
| three/addons/objects/Water.js | r160 | 海面シェーダ |
| three/addons/controls/OrbitControls.js | r160 | カメラ操作 |
| three/addons/utils/BufferGeometryUtils.js | r160 | ジオメトリ結合 |
