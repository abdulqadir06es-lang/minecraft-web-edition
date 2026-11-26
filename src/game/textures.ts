import * as THREE from 'three';
import { TILE } from './blocks';

/**
 * Procedurally generates the whole block texture atlas on a canvas.
 * 16x16 grid of 16x16 pixel tiles => 256x256 texture. NearestFilter keeps it crisp.
 */

const ATLAS_TILES = 16;
const TILE_PX = 16;
const ATLAS_PX = ATLAS_TILES * TILE_PX;

type RNG = () => number;
function makeRng(seed: number): RNG {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

type Pixel = [number, number, number, number];

class TilePainter {
  private data: ImageData;
  constructor(
    private ctx: CanvasRenderingContext2D,
    private ox: number,
    private oy: number,
    public rng: RNG
  ) {
    this.data = ctx.createImageData(TILE_PX, TILE_PX);
  }
  px(x: number, y: number, c: Pixel) {
    if (x < 0 || x >= TILE_PX || y < 0 || y >= TILE_PX) return;
    const i = (y * TILE_PX + x) * 4;
    this.data.data[i] = c[0];
    this.data.data[i + 1] = c[1];
    this.data.data[i + 2] = c[2];
    this.data.data[i + 3] = c[3];
  }
  fill(base: Pixel, noise = 0.12) {
    for (let y = 0; y < TILE_PX; y++)
      for (let x = 0; x < TILE_PX; x++) {
        const s = 1 - noise / 2 + this.rng() * noise;
        this.px(x, y, [base[0] * s, base[1] * s, base[2] * s, base[3]]);
      }
  }
  speckle(count: number, c: Pixel) {
    for (let i = 0; i < count; i++) this.px(Math.floor(this.rng() * TILE_PX), Math.floor(this.rng() * TILE_PX), c);
  }
  hline(y: number, c: Pixel, from = 0, to = TILE_PX) {
    for (let x = from; x < to; x++) this.px(x, y, c);
  }
  vline(x: number, c: Pixel, from = 0, to = TILE_PX) {
    for (let y = from; y < to; y++) this.px(x, y, c);
  }
  rect(x: number, y: number, w: number, h: number, c: Pixel) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }
  /** Draws a blob of 2x2-ish mineral specks, like Minecraft ores. */
  oreBlobs(color: Pixel, blobs = 5) {
    for (let b = 0; b < blobs; b++) {
      const x = 1 + Math.floor(this.rng() * 12);
      const y = 1 + Math.floor(this.rng() * 12);
      const s = 0.8 + this.rng() * 0.4;
      const c: Pixel = [color[0] * s, color[1] * s, color[2] * s, 255];
      this.px(x, y, c);
      this.px(x + 1, y, c);
      this.px(x, y + 1, c);
      if (this.rng() > 0.5) this.px(x + 1, y + 1, c);
      if (this.rng() > 0.7) this.px(x - 1, y, c);
    }
  }
  commit() {
    this.ctx.putImageData(this.data, this.ox, this.oy);
  }
}

function shade(c: Pixel, s: number): Pixel {
  return [Math.min(255, c[0] * s), Math.min(255, c[1] * s), Math.min(255, c[2] * s), c[3]];
}

/** Atlas must be a power-of-two-friendly canvas; we draw tiles first, then text tiles last with 2D calls. */
export function generateAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_PX;
  canvas.height = ATLAS_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, ATLAS_PX, ATLAS_PX);

  const seed = 1337;
  let tileIndex = 0;
  const painter = (draw: (p: TilePainter, rng: RNG) => void) => {
    const tx = tileIndex % ATLAS_TILES;
    const ty = Math.floor(tileIndex / ATLAS_TILES);
    tileIndex++;
    const rng = makeRng(seed + tileIndex * 7919);
    const p = new TilePainter(ctx, tx * TILE_PX, ty * TILE_PX, rng);
    draw(p, rng);
    p.commit();
    return [tx, ty] as const;
  };

  const DIRT: Pixel = [134, 96, 67, 255];
  const GRASS: Pixel = [94, 157, 52, 255];
  const STONE: Pixel = [125, 125, 125, 255];
  const WOOD: Pixel = [104, 82, 50, 255];
  const LEAF: Pixel = [60, 120, 40, 255];
  const SAND: Pixel = [219, 207, 163, 255];

  // 0: grass top
  painter((p) => {
    p.fill(GRASS, 0.22);
    p.speckle(40, shade(GRASS, 0.8));
    p.speckle(30, shade(GRASS, 1.15));
  });

  // 1: grass side (dirt with grass overhang)
  painter((p, rng) => {
    p.fill(DIRT, 0.2);
    p.speckle(30, shade(DIRT, 0.8));
    for (let x = 0; x < 16; x++) {
      const h = 3 + Math.floor(rng() * 3);
      for (let y = 0; y < h; y++) p.px(x, y, shade(GRASS, 0.85 + rng() * 0.3));
    }
  });

  // 2: dirt
  painter((p) => {
    p.fill(DIRT, 0.2);
    p.speckle(60, shade(DIRT, 0.78));
    p.speckle(40, shade(DIRT, 1.12));
  });

  // 3: stone
  const stonePainter = painter((p) => {
    p.fill(STONE, 0.16);
    p.speckle(50, shade(STONE, 0.82));
    p.speckle(30, shade(STONE, 1.1));
    for (let i = 0; i < 3; i++) {
      let x = Math.floor(p.rng() * 12);
      let y = Math.floor(p.rng() * 12);
      for (let j = 0; j < 5; j++) {
        p.px(x, y, shade(STONE, 0.7));
        x += Math.floor(p.rng() * 2);
        y += Math.floor(p.rng() * 2);
      }
    }
  });

  // 4: cobblestone (rounded grey stones with dark mortar)
  painter((p, rng) => {
    p.fill(shade(STONE, 0.6), 0.1);
    const stones: Array<[number, number, number, number]> = [
      [0, 0, 5, 4],
      [6, 0, 6, 3],
      [13, 0, 3, 5],
      [0, 5, 4, 5],
      [5, 4, 5, 6],
      [11, 6, 5, 4],
      [0, 11, 6, 4],
      [7, 11, 5, 4],
      [12, 11, 4, 5],
    ];
    for (const [sx, sy, sw, sh] of stones) {
      const s = 0.85 + rng() * 0.35;
      for (let y = sy + 1; y < sy + sh; y++)
        for (let x = sx + 1; x < sx + sw; x++) p.px(x, y, shade(STONE, s));
    }
  });

  // 5: oak log side (bark)
  painter((p, rng) => {
    p.fill(WOOD, 0.18);
    for (let x = 0; x < 16; x += 3 + Math.floor(rng() * 2)) {
      const c = shade(WOOD, 0.72);
      for (let y = 0; y < 16; y++) if (rng() > 0.25) p.px(x, y, c);
    }
  });

  // 6: oak log top (rings)
  painter((p) => {
    p.fill(shade(WOOD, 1.35), 0.12);
    const c = shade(WOOD, 0.75);
    p.rect(3, 3, 10, 10, c);
    p.rect(5, 5, 6, 6, shade(WOOD, 1.3));
    p.rect(7, 7, 2, 2, c);
  });

  // 7: oak planks (horizontal boards with seams)
  painter((p, rng) => {
    const PLANK: Pixel = [162, 130, 78, 255];
    p.fill(PLANK, 0.14);
    for (let y = 0; y < 16; y += 4) {
      p.hline(y, shade(PLANK, 0.6));
      for (let x = 0; x < 16; x++) if (rng() > 0.85) p.px(x, y + 2, shade(PLANK, 0.85));
    }
    p.px(4, 2, shade(PLANK, 0.6));
    p.px(4, 3, shade(PLANK, 0.6));
    p.px(11, 6, shade(PLANK, 0.6));
    p.px(11, 7, shade(PLANK, 0.6));
    p.px(6, 10, shade(PLANK, 0.6));
    p.px(6, 11, shade(PLANK, 0.6));
    p.px(13, 14, shade(PLANK, 0.6));
  });

  // 8: oak leaves (holes -> alpha)
  painter((p, rng) => {
    p.fill(LEAF, 0.3);
    p.speckle(50, shade(LEAF, 0.7));
    p.speckle(40, shade(LEAF, 1.25));
    for (let i = 0; i < 14; i++) p.px(Math.floor(rng() * 16), Math.floor(rng() * 16), [0, 0, 0, 0]);
  });

  // 9: sand
  painter((p) => {
    p.fill(SAND, 0.1);
    p.speckle(50, shade(SAND, 0.92));
    p.speckle(30, shade(SAND, 1.06));
  });

  // 10: sandstone top
  painter((p) => {
    p.fill(shade(SAND, 0.97), 0.08);
    p.speckle(25, shade(SAND, 0.9));
  });

  // 11: sandstone side (banded)
  painter((p) => {
    p.fill(SAND, 0.08);
    p.hline(4, shade(SAND, 0.88));
    p.hline(5, shade(SAND, 0.88));
    p.hline(10, shade(SAND, 0.9));
    p.hline(11, shade(SAND, 0.9));
    p.rect(0, 0, 16, 1, shade(SAND, 1.05));
    p.rect(0, 15, 16, 1, shade(SAND, 0.85));
  });

  // 12: gravel (mixed grey/brown pebbles)
  painter((p) => {
    p.fill([136, 126, 126, 255], 0.2);
    p.speckle(45, [104, 96, 96, 255]);
    p.speckle(35, [160, 150, 148, 255]);
    p.speckle(15, [120, 108, 98, 255]);
  });

  // 13: glass (mostly transparent with border + streaks)
  painter((p) => {
    const GLASS: Pixel = [200, 230, 240, 255];
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const edge = x === 0 || y === 0 || x === 15 || y === 15;
        p.px(x, y, edge ? [210, 235, 245, 255] : [230, 245, 250, 26]);
      }
    // diagonal streaks
    for (let i = 2; i < 8; i++) p.px(i, 10 - i, [255, 255, 255, 110]);
    for (let i = 4; i < 9; i++) p.px(i + 4, 16 - i, [255, 255, 255, 70]);
    void GLASS;
  });

  // 14: bricks
  painter((p, rng) => {
    const MORTAR: Pixel = [150, 145, 140, 255];
    const BRICK: Pixel = [150, 70, 55, 255];
    p.fill(MORTAR, 0.08);
    const drawBrick = (x: number, y: number, w: number) => {
      for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + w; xx++) p.px(xx, yy, shade(BRICK, 0.85 + rng() * 0.3));
    };
    for (let row = 0; row < 4; row++) {
      const y = row * 4;
      const offset = row % 2 === 0 ? 0 : -4;
      for (let b = 0; b < 3; b++) drawBrick(offset + b * 8, y, 7);
      if (row % 2 === 1) drawBrick(12, y, 4);
    }
  });

  // 15: bedrock
  painter((p, rng) => {
    p.fill([70, 70, 70, 255], 0.25);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rng() * 15);
      const y = Math.floor(rng() * 15);
      const c: Pixel = rng() > 0.5 ? [40, 40, 40, 255] : [110, 110, 110, 255];
      p.rect(x, y, 2, 2, c);
    }
  });

  // 16: water
  painter((p, rng) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const s = 0.85 + rng() * 0.3;
        p.px(x, y, [52 * s, 110 * s, 200 * s, 170]);
      }
    for (let i = 0; i < 8; i++) p.hline(Math.floor(rng() * 16), [120, 170, 230, 160], 0, 4 + Math.floor(rng() * 8));
  });

  // 17-21: ores (stone background + mineral blobs)
  const oreColors: Array<[number, number, number]> = [
    [35, 35, 35], // coal
    [205, 160, 120], // iron
    [250, 215, 60], // gold
    [90, 230, 230], // diamond
    [230, 40, 30], // redstone
  ];
  for (const oc of oreColors) {
    painter((p) => {
      p.fill(STONE, 0.16);
      p.speckle(30, shade(STONE, 0.85));
      p.oreBlobs([oc[0], oc[1], oc[2], 255], 6);
    });
  }

  // 22: snow
  painter((p) => {
    p.fill([245, 250, 252, 255], 0.04);
    p.speckle(15, [235, 242, 248, 255]);
  });

  // 23: ice (translucent blue with cracks)
  painter((p, rng) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const s = 0.9 + rng() * 0.2;
        p.px(x, y, [150 * s, 200 * s, 240 * s, 200]);
      }
    for (let i = 0; i < 4; i++) {
      let x = Math.floor(rng() * 14);
      let y = Math.floor(rng() * 14);
      for (let j = 0; j < 6; j++) {
        p.px(x, y, [220, 240, 255, 255]);
        x += Math.floor(rng() * 2);
        y += Math.floor(rng() * 2);
      }
    }
  });

  // 24: obsidian (deep purple-black sheen)
  painter((p) => {
    p.fill([24, 18, 38, 255], 0.25);
    p.speckle(20, [50, 38, 80, 255]);
    p.speckle(10, [90, 70, 140, 255]);
  });

  // 25: TNT side — red with white band (label drawn via 2D text below)
  const tntSidePos = painter((p) => {
    p.fill([190, 40, 35, 255], 0.12);
    p.rect(0, 5, 16, 6, [230, 220, 200, 255]);
    p.speckle(14, shade([190, 40, 35, 255], 0.8));
  });

  // 26: TNT top (red with darker cross)
  painter((p) => {
    p.fill([170, 35, 30, 255], 0.1);
    p.rect(6, 0, 4, 16, [60, 45, 40, 255]);
    p.rect(0, 6, 16, 4, [60, 45, 40, 255]);
  });

  // 27: crafting table top (grid)
  painter((p) => {
    p.fill([140, 105, 60, 255], 0.12);
    p.rect(1, 1, 14, 14, [170, 130, 75, 255]);
    p.hline(5, [100, 75, 45, 255], 1, 15);
    p.hline(10, [100, 75, 45, 255], 1, 15);
    for (let y = 0; y < 16; y += 5) p.vline(y, [100, 75, 45, 255], 1, 15);
    for (let x = 0; x < 16; x += 5) p.vline(x, [100, 75, 45, 255], 1, 15);
    p.rect(0, 0, 16, 1, [110, 82, 48, 255]);
    p.rect(0, 15, 16, 1, [110, 82, 48, 255]);
  });

  // 28: crafting table side (planks with tool print)
  painter((p, rng) => {
    const PLANK: Pixel = [162, 130, 78, 255];
    p.fill(PLANK, 0.14);
    p.rect(2, 3, 5, 4, [120, 90, 55, 255]);
    p.rect(9, 3, 5, 4, [120, 90, 55, 255]);
    p.rect(3, 4, 3, 2, [200, 170, 120, 255]);
    p.rect(10, 4, 3, 2, [200, 170, 120, 255]);
    p.hline(8, shade(PLANK, 0.6));
    for (let x = 0; x < 16; x++) if (rng() > 0.8) p.px(x, 12, shade(PLANK, 0.8));
  });

  // 29: bookshelf (planks frame + colorful book spines)
  painter((p, rng) => {
    const PLANK: Pixel = [162, 130, 78, 255];
    p.fill(PLANK, 0.12);
    const spineColors: Pixel[] = [
      [160, 50, 45, 255],
      [60, 90, 160, 255],
      [70, 130, 60, 255],
      [180, 160, 60, 255],
      [130, 70, 150, 255],
      [200, 200, 190, 255],
    ];
    const drawRow = (y: number) => {
      let x = 1;
      while (x < 15) {
        const w = 1 + Math.floor(rng() * 2);
        const c = spineColors[Math.floor(rng() * spineColors.length)];
        for (let xx = x; xx < Math.min(x + w, 15); xx++)
          for (let yy = y; yy < y + 5; yy++) p.px(xx, yy, shade(c, 0.85 + rng() * 0.3));
        x += w;
      }
      p.hline(y + 5, shade(PLANK, 0.7), 0, 16);
    };
    drawRow(1);
    drawRow(8);
    p.rect(0, 0, 16, 1, shade(PLANK, 0.8));
    p.rect(0, 15, 16, 1, shade(PLANK, 0.8));
  });

  // 30: sponge (yellow porous)
  painter((p, rng) => {
    p.fill([196, 180, 70, 255], 0.14);
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(rng() * 15);
      const y = Math.floor(rng() * 15);
      p.rect(x, y, 2, 1, [140, 125, 45, 255]);
      if (rng() > 0.6) p.rect(x, y, 1, 2, [140, 125, 45, 255]);
    }
  });

  // 31: pumpkin side (orange ribs)
  painter((p) => {
    p.fill([225, 120, 30, 255], 0.1);
    for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) p.px(x, y, [180, 90, 20, 255]);
    for (let x = 2; x < 16; x += 4) for (let y = 0; y < 16; y++) if (y % 3) p.px(x, y, [200, 105, 25, 255]);
  });

  // 32: pumpkin top (stem + rings)
  painter((p) => {
    p.fill([200, 105, 25, 255], 0.1);
    p.rect(6, 6, 4, 4, [90, 110, 40, 255]);
    p.rect(7, 7, 2, 2, [120, 140, 50, 255]);
  });

  // 33: pumpkin face (carved jack-o-lantern)
  painter((p) => {
    p.fill([225, 120, 30, 255], 0.08);
    const CARVE: Pixel = [255, 220, 100, 255];
    // triangle eyes
    p.rect(3, 4, 3, 2, CARVE);
    p.px(4, 3, CARVE);
    p.rect(10, 4, 3, 2, CARVE);
    p.px(11, 3, CARVE);
    // jagged mouth
    p.rect(3, 10, 10, 2, CARVE);
    p.px(4, 12, CARVE);
    p.px(7, 12, CARVE);
    p.px(8, 12, CARVE);
    p.px(11, 12, CARVE);
    p.px(5, 9, CARVE);
    p.px(10, 9, CARVE);
  });

  // 34: melon side (green stripes)
  painter((p, rng) => {
    for (let x = 0; x < 16; x++) {
      const stripe = x % 4 < 2;
      for (let y = 0; y < 16; y++) {
        const s = 0.9 + rng() * 0.2;
        const c: Pixel = stripe ? [90 * s, 160 * s, 40 * s, 255] : [140 * s, 190 * s, 70 * s, 255];
        p.px(x, y, c);
      }
    }
  });

  // 35: melon top
  painter((p, rng) => {
    p.fill([110, 170, 50, 255], 0.14);
    p.speckle(25, shade([90, 150, 40, 255], 1));
    p.rect(6, 6, 4, 4, [140, 190, 70, 255]);
  });

  // 36: clay (light grey-blue)
  painter((p) => {
    p.fill([160, 166, 178, 255], 0.08);
    p.speckle(20, shade([160, 166, 178, 255], 0.92));
  });

  // 37: netherrack (dark red blotches)
  painter((p, rng) => {
    p.fill([110, 40, 40, 255], 0.25);
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(rng() * 14);
      const y = Math.floor(rng() * 14);
      const c: Pixel = rng() > 0.5 ? [80, 25, 25, 255] : [140, 55, 55, 255];
      p.rect(x, y, 2, 2, c);
    }
  });

  // 38-43: wools (soft noisy fabric)
  const woolColors: Array<[number, number, number]> = [
    [235, 235, 235], // white
    [180, 50, 45], // red
    [55, 75, 180], // blue
    [225, 200, 60], // yellow
    [70, 130, 55], // green
    [35, 35, 38], // black
  ];
  for (const wc of woolColors) {
    painter((p) => {
      p.fill([wc[0], wc[1], wc[2], 255], 0.1);
      p.speckle(35, shade([wc[0], wc[1], wc[2], 255], 0.88));
      p.speckle(20, shade([wc[0], wc[1], wc[2], 255], 1.08));
    });
  }

  // 44: glowstone (warm yellow blobs)
  painter((p, rng) => {
    p.fill([150, 120, 70, 255], 0.18);
    for (let i = 0; i < 9; i++) {
      const x = 1 + Math.floor(rng() * 13);
      const y = 1 + Math.floor(rng() * 13);
      p.rect(x, y, 2, 2, [255, 230, 140, 255]);
      p.px(x + (rng() > 0.5 ? 2 : -1), y, [255, 245, 190, 255]);
    }
    p.speckle(12, [255, 240, 170, 255]);
  });

  // --- text-drawn tiles via 2D API (after pixel tiles) ---
  // TNT label on the white band of the TNT side tile
  const drawLabel = (tile: number, text: string, color: string, fontPx = 7) => {
    const tx = tile % ATLAS_TILES;
    const ty = Math.floor(tile / ATLAS_TILES);
    ctx.save();
    ctx.translate(tx * TILE_PX, ty * TILE_PX);
    ctx.fillStyle = color;
    ctx.font = `bold ${fontPx}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, TILE_PX / 2, TILE_PX / 2 + 0.5);
    ctx.restore();
  };
  drawLabel(TILE.tntSide, 'TNT', '#8a1512');

  void stonePainter;
  return canvas;
}

export function createAtlasTexture(): THREE.Texture {
  const tex = new THREE.CanvasTexture(generateAtlasCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** UV rect for tile index in the 16x16 grid (v flipped for three.js), with bleed inset. */
export function tileUV(tile: number): { u0: number; v0: number; u1: number; v1: number } {
  const col = tile % ATLAS_TILES;
  const row = Math.floor(tile / ATLAS_TILES);
  const e = 0.001;
  const u0 = (col + e) / ATLAS_TILES;
  const u1 = (col + 1 - e) / ATLAS_TILES;
  const v1 = 1 - (row + e) / ATLAS_TILES;
  const v0 = 1 - (row + 1 - e) / ATLAS_TILES;
  return { u0, v0, u1, v1 };
}

export { TILE_PX, ATLAS_TILES };
