import { worldToScreen, type Camera, type Size } from "./camera";
import { STREET_TILE_SIZE, streetTiles } from "./geo";

/** Dark streets for a dark map; without canvas filters (older Safari) they stay light. */
export const DARK_STREETS = "invert(1) hue-rotate(180deg)";
/** How strongly the streets show, from nothing (0) to full (1): the plan stays what you read. */
export const STREETS_STRENGTH = 0.55;
const tileURL = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
/** Decoded street tiles kept for panning back: about 60 MB. */
const MOST_KEPT = 240;
/** Downloads at once; the rest are asked for again as these land. */
const MOST_LOADING = 8;
/** A tile that failed, offline say, is tried again after this long. */
const RETRY_MS = 10_000;
/** How many zooms up a loaded tile fills in, enlarged, while a sharper one loads. */
const FALLBACK_ZOOMS = 5;
interface Entry {
  bitmap?: ImageBitmap;
  failed?: number;
  used: number;
}
const key = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

/** OpenStreetMap's streets, fetched as the screen needs them. Only tiles the
 * person looks at are downloaded, as the tile usage policy asks: none ahead. */
export class StreetTiles {
  private tiles = new Map<string, Entry>();
  private loading = 0;
  private controller = new AbortController();
  constructor(private onLoad: () => void) {}
  /** Paints the screen's tiles; `view` takes Mercator to screen pixels. */
  draw(ctx: CanvasRenderingContext2D, view: Camera, viewport: Size, dpr: number) {
    const { z, tiles } = streetTiles(view, viewport),
      n = 2 ** z,
      now = performance.now(),
      k = view.scale / n / STREET_TILE_SIZE,
      c = Math.cos(view.rotation ?? 0) * k * dpr,
      s = Math.sin(view.rotation ?? 0) * k * dpr;
    for (const { x, y } of tiles) {
      this.want(z, x, y, now);
      // Until it loads, the nearest loaded tile above it fills in, enlarged.
      let depth = 0, entry = this.tiles.get(key(z, x, y));
      while (!entry?.bitmap && depth < Math.min(z, FALLBACK_ZOOMS)) {
        depth++;
        entry = this.tiles.get(key(z - depth, x >> depth, y >> depth));
      }
      if (!entry?.bitmap) continue;
      entry.used = now;
      const size = STREET_TILE_SIZE / 2 ** depth,
        origin = worldToScreen(view, { x: x / n, y: y / n });
      // Each tile is placed from its own corner, worked out in doubles: a
      // transform for the whole world would lose sub-pixel precision at street zooms.
      ctx.setTransform(c, s, -s, c, origin.x * dpr, origin.y * dpr);
      // Half a pixel over each edge hides the seams between neighbours.
      ctx.drawImage(entry.bitmap, (x - ((x >> depth) << depth)) * size, (y - ((y >> depth) << depth)) * size,
        size, size, 0, 0, STREET_TILE_SIZE + 0.5, STREET_TILE_SIZE + 0.5);
    }
    this.evict();
  }
  private want(z: number, x: number, y: number, now: number) {
    const id = key(z, x, y), entry = this.tiles.get(id);
    if (entry) {
      entry.used = now;
      if (!entry.failed || now - entry.failed < RETRY_MS) return;
    }
    if (this.loading >= MOST_LOADING) return;
    const loading: Entry = { used: now };
    this.tiles.set(id, loading);
    this.loading++;
    fetch(tileURL(z, x, y), { signal: this.controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        if (this.tiles.get(id) !== loading) return bitmap.close();
        loading.bitmap = bitmap;
      })
      .catch(() => {
        loading.failed = performance.now();
      })
      .finally(() => {
        this.loading--;
        if (!this.controller.signal.aborted) this.onLoad();
      });
  }
  private evict() {
    if (this.tiles.size <= MOST_KEPT) return;
    const oldest = [...this.tiles].filter(([, entry]) => entry.bitmap || entry.failed)
      .sort(([, a], [, b]) => a.used - b.used)
      .slice(0, this.tiles.size - MOST_KEPT);
    for (const [id, entry] of oldest) {
      entry.bitmap?.close();
      this.tiles.delete(id);
    }
  }
  dispose() {
    this.controller.abort();
    for (const entry of this.tiles.values()) entry.bitmap?.close();
    this.tiles.clear();
  }
}
