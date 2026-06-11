# 設計書 — 戦艦大和 3D インタラクティブビューア

## 設計書一覧

| ファイル | タイトル | 対象ファイル |
|---------|---------|------------|
| [01_overview.md](01_overview.md) | システム概要・アーキテクチャ | プロジェクト全体 |
| [02_hull_geometry.md](02_hull_geometry.md) | 船体ジオメトリ設計 | `js/yamato/hull.js` |
| [03_armament_superstructure.md](03_armament_superstructure.md) | 兵装・上構・艤装設計 | `js/yamato/turrets.js` `superstructure.js` `details.js` |
| [04_materials_textures.md](04_materials_textures.md) | マテリアル・テクスチャ設計 | `js/materials.js` |
| [05_rendering_environment.md](05_rendering_environment.md) | レンダリング・環境設計 | `js/environment.js` `js/main.js` |
| [06_ui_controls.md](06_ui_controls.md) | UI・カメラ制御設計 | `js/controls.js` `index.html` `css/style.css` |
| [07_animation_effects.md](07_animation_effects.md) | 砲塔アニメーション・煙エフェクト設計 | `js/animation.js` `js/smoke.js` |

---

## 設計書の読み方

初めて読む場合は **01 → 02 → 05 → 04 → 03 → 06** の順が理解しやすい。

- **01**: プロジェクト全体の方針・技術選定を把握する
- **02**: 船体プロファイル関数と頂点生成の数式を理解する
- **05**: 光・影・海面・空の描画パイプラインを把握する
- **04**: マテリアルとテクスチャのパラメータ一覧を参照する
- **03**: 兵装・上構各パーツの寸法・配置を確認する
- **06**: UI 操作・カメラ設定を確認する
