// materials.js — PBR マテリアルと Canvas 動的テクスチャ生成
import * as THREE from 'three';

function canvasTexture(draw, w = 512, h = 512, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 鋼板テクスチャ（板継ぎ目・リベット・ウェザリング） */
function platingTexture(seamStrength = 1) {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#cfcfcf';
    ctx.fillRect(0, 0, w, h);

    // ノイズ斑
    for (let i = 0; i < 9000; i++) {
      const v = 190 + Math.random() * 50;
      ctx.fillStyle = `rgba(${v},${v},${v},0.16)`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // 縦方向のウェザリング（雨垂れ・錆流れ）
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w, y0 = Math.random() * h;
      const len = 30 + Math.random() * 150;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
      g.addColorStop(0, 'rgba(80,72,64,0.10)');
      g.addColorStop(1, 'rgba(80,72,64,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y0, 1.5 + Math.random() * 2, len);
    }
    // 板継ぎ目（横）
    ctx.strokeStyle = `rgba(60,60,62,${0.32 * seamStrength})`;
    ctx.lineWidth = 1.4;
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }
    // 板継ぎ目（縦・千鳥配置）
    ctx.strokeStyle = `rgba(70,70,72,${0.2 * seamStrength})`;
    for (let y = 0; y < h; y += 64) {
      const off = (y / 64) % 2 ? 64 : 0;
      for (let x = off; x < w; x += 128) {
        ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + 64); ctx.stroke();
      }
    }
    // リベット
    ctx.fillStyle = 'rgba(90,90,92,0.45)';
    for (let y = 4; y < h; y += 64) {
      for (let x = 3; x < w; x += 9) ctx.fillRect(x, y, 1.6, 1.6);
    }
  });
}

/** 木甲板テクスチャ（檜の板目・コーキング・継ぎ目） */
function woodDeckTexture() {
  return canvasTexture((ctx, w, h) => {
    const plankW = 32; // 512px ÷ 16枚 → 1枚 ≒ 20cm 相当
    for (let px = 0; px < w; px += plankW) {
      const hue = 36 + Math.random() * 8;
      const sat = 18 + Math.random() * 14;
      const lit = 60 + Math.random() * 10;
      ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
      ctx.fillRect(px, 0, plankW, h);

      // 木目
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `hsla(${hue - 6},${sat + 10}%,${lit - 18}%,${0.05 + Math.random() * 0.08})`;
        ctx.lineWidth = 0.7 + Math.random();
        const gx = px + Math.random() * plankW;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.bezierCurveTo(gx + 4, h * 0.3, gx - 4, h * 0.6, gx + 2, h);
        ctx.stroke();
      }
      // 板の突き合わせ継ぎ目（千鳥）
      const joint = (Math.floor(px / plankW) % 4) * (h / 4) + Math.random() * 30;
      ctx.fillStyle = 'rgba(40,32,24,0.55)';
      ctx.fillRect(px, joint, plankW, 2);

      // コーキング（黒い目地）
      ctx.fillStyle = 'rgba(30,26,22,0.85)';
      ctx.fillRect(px, 0, 1.6, h);
    }
    // 全体の使用感
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = `rgba(70,60,46,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 3, 8);
    }
  });
}

/** 菊花紋章テクスチャ（艦首用・16弁） */
export function chrysanthemumTexture() {
  return canvasTexture((ctx, w, h) => {
    const cx = w / 2, cy = h / 2, R = w * 0.46;
    ctx.clearRect(0, 0, w, h);
    // 花弁
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, R, 0);
      g.addColorStop(0, '#e8c44a');
      g.addColorStop(0.7, '#d4a92f');
      g.addColorStop(1, '#a87f1d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(R * 0.18, 0);
      ctx.quadraticCurveTo(R * 0.55, R * 0.13, R, 0);
      ctx.quadraticCurveTo(R * 0.55, -R * 0.13, R * 0.18, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,20,0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
    // 中心
    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.2);
    g2.addColorStop(0, '#f0d060');
    g2.addColorStop(1, '#c89c28');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.18, 0, Math.PI * 2); ctx.fill();
  }, 256, 256);
}

export function createMaterials() {
  const plate = platingTexture(1.0);
  const noise = platingTexture(0.35);
  const wood = woodDeckTexture();

  const M = {
    /** 船体（頂点カラーで 軍艦色／黒帯／艦底色 を塗り分け） */
    hull: new THREE.MeshStandardMaterial({
      map: plate, bumpMap: plate, bumpScale: 0.05,
      vertexColors: true, roughness: 0.58, metalness: 0.34,
    }),
    /** 木甲板 */
    deck: new THREE.MeshStandardMaterial({
      map: wood, bumpMap: wood, bumpScale: 0.02,
      color: 0xf0e2c4, roughness: 0.88, metalness: 0.04,
    }),
    /** 上部構造の鋼（呉海軍工廠グレー） */
    steel: new THREE.MeshStandardMaterial({
      map: noise, color: 0x7c8288, roughness: 0.56, metalness: 0.44,
    }),
    /** 暗めの鋼（甲板上の鉄板・基部） */
    steelDark: new THREE.MeshStandardMaterial({
      map: noise, color: 0x5a6066, roughness: 0.6, metalness: 0.42,
    }),
    /** 砲身 */
    barrel: new THREE.MeshStandardMaterial({
      color: 0x4b5054, roughness: 0.42, metalness: 0.66,
    }),
    /** 黒鉄（機銃・錨・煙突頂部など） */
    dark: new THREE.MeshStandardMaterial({
      color: 0x26292c, roughness: 0.58, metalness: 0.52,
    }),
    /** 煙突頂部 */
    funnelTop: new THREE.MeshStandardMaterial({
      color: 0x141517, roughness: 0.5, metalness: 0.6,
    }),
    /** スクリュー（マンガン青銅） */
    bronze: new THREE.MeshStandardMaterial({
      color: 0x9a7a42, roughness: 0.38, metalness: 1.0,
    }),
    /** 真鍮・金 */
    brass: new THREE.MeshStandardMaterial({
      color: 0xd9b13b, roughness: 0.28, metalness: 1.0,
    }),
    /** 防水布（砲身基部の防水カバー等） */
    canvas: new THREE.MeshStandardMaterial({
      color: 0xcfc8b6, roughness: 0.95, metalness: 0.0,
    }),
    /** 内火艇の木部 */
    woodBoat: new THREE.MeshStandardMaterial({
      color: 0x8a6f4d, roughness: 0.8, metalness: 0.05,
    }),
    /** 探照灯レンズ */
    lens: new THREE.MeshStandardMaterial({
      color: 0xcfe4f0, roughness: 0.12, metalness: 0.9,
      emissive: 0x223844, emissiveIntensity: 0.4,
    }),
    /** 艦橋窓ガラス帯 */
    glass: new THREE.MeshStandardMaterial({
      color: 0x10181f, roughness: 0.15, metalness: 0.85,
    }),
    /** リノリウム甲板 */
    linoleum: new THREE.MeshStandardMaterial({
      color: 0x6e5747, roughness: 0.9, metalness: 0.02,
    }),
  };

  return M;
}
