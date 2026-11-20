import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, Connect } from 'vite';

interface CacheMeta {
  slug: string;
  contentType: string;
  ext: string;
  sourceUrl?: string;
  attribution?: string;
  cachedAt: string;
  bytes: number;
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB safety cap
const FETCH_TIMEOUT_MS = 10_000;

function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 110);
  return cleaned || 'default';
}

function extFromContentType(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('svg')) return 'svg';
  if (lower.includes('gif')) return 'gif';
  if (lower.includes('avif')) return 'avif';
  return 'jpg';
}

function isAllowedRemoteUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_IMAGE_BYTES * 1.4) {
      throw new Error('Payload too large');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function attachBgCacheMiddleware(
  middlewares: Connect.Server,
  rootDir: string
): void {
  const cacheDir = path.resolve(rootDir, 'cache', 'backgrounds');

  const ensureDir = async (): Promise<void> => {
    await fs.mkdir(cacheDir, { recursive: true });
  };

  middlewares.use('/api/bg-cache', async (req, res, next) => {
    try {
      const reqUrl = new URL(req.url ?? '/', 'http://localhost');
      const pathname = reqUrl.pathname.replace(/\/+$/, '') || '/';

      // List cached slugs: GET /api/bg-cache/list
      if (req.method === 'GET' && pathname === '/list') {
        await ensureDir();
        const files = await fs.readdir(cacheDir);
        const slugs = files
          .filter((f) => f.endsWith('.meta.json'))
          .map((f) => f.replace(/\.meta\.json$/, ''));
        sendJson(res, 200, { count: slugs.length, slugs });
        return;
      }

      // Serve cached image: GET /api/bg-cache?slug=<slug>
      if (req.method === 'GET' && pathname === '/') {
        const rawSlug = reqUrl.searchParams.get('slug');
        if (!rawSlug) {
          sendJson(res, 400, { ok: false, error: 'Missing slug query parameter' });
          return;
        }
        const safeSlug = sanitizeSlug(rawSlug);
        const metaPath = path.join(cacheDir, `${safeSlug}.meta.json`);
        try {
          const metaRaw = await fs.readFile(metaPath, 'utf8');
          const meta = JSON.parse(metaRaw) as CacheMeta;
          const imgPath = path.join(cacheDir, `${safeSlug}.${meta.ext}`);
          const bytes = await fs.readFile(imgPath);

          if (reqUrl.searchParams.get('meta') === '1') {
            sendJson(res, 200, {
              hit: true,
              slug: safeSlug,
              localUrl: `/api/bg-cache?slug=${encodeURIComponent(safeSlug)}`,
              contentType: meta.contentType,
              attribution: meta.attribution ?? '',
              sourceUrl: meta.sourceUrl ?? '',
              cachedAt: meta.cachedAt,
              bytes: meta.bytes,
            });
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', meta.contentType || 'image/jpeg');
          res.setHeader('Content-Length', String(bytes.length));
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('X-BG-Cache', 'HIT');
          if (meta.attribution) {
            res.setHeader('X-BG-Attribution', encodeURIComponent(meta.attribution));
          }
          if (meta.sourceUrl) {
            res.setHeader('X-BG-Source-Url', encodeURIComponent(meta.sourceUrl));
          }
          res.end(bytes);
          return;
        } catch {
          sendJson(res, 404, { hit: false, slug: safeSlug });
          return;
        }
      }

      // Cache image from remote URL or dataUrl: POST /api/bg-cache
      if (req.method === 'POST' && pathname === '/') {
        await ensureDir();
        const body = await readJsonBody(req);
        const rawSlug = typeof body.slug === 'string' ? body.slug : '';
        if (!rawSlug) {
          sendJson(res, 400, { ok: false, error: 'Missing slug in request body' });
          return;
        }
        const safeSlug = sanitizeSlug(rawSlug);
        const attribution = typeof body.attribution === 'string' ? body.attribution : '';

        let imgBuffer: Buffer | null = null;
        let contentType = 'image/jpeg';
        let sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl : '';

        if (typeof body.dataUrl === 'string' && body.dataUrl.startsWith('data:image/')) {
          const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(body.dataUrl);
          if (!match) {
            sendJson(res, 400, { ok: false, error: 'Invalid base64 image dataUrl' });
            return;
          }
          contentType = match[1];
          imgBuffer = Buffer.from(match[2], 'base64');
        } else if (typeof body.remoteUrl === 'string') {
          const remoteUrl = body.remoteUrl.trim();
          if (!isAllowedRemoteUrl(remoteUrl)) {
            sendJson(res, 400, { ok: false, error: 'Invalid or disallowed remoteUrl' });
            return;
          }
          sourceUrl = remoteUrl;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          try {
            const upstream = await fetch(remoteUrl, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'CM0102-Season2627/1.0 (Local Football Manager Media Cache)',
                Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
              },
            });
            if (!upstream.ok) {
              sendJson(res, 502, {
                ok: false,
                error: `Upstream image fetch failed with status ${upstream.status}`,
              });
              return;
            }
            const upstreamType = upstream.headers.get('content-type') || '';
            if (!upstreamType.toLowerCase().startsWith('image/')) {
              sendJson(res, 415, {
                ok: false,
                error: `Upstream returned non-image content-type: ${upstreamType}`,
              });
              return;
            }
            contentType = upstreamType.split(';')[0].trim();
            const arrBuf = await upstream.arrayBuffer();
            if (arrBuf.byteLength === 0 || arrBuf.byteLength > MAX_IMAGE_BYTES) {
              sendJson(res, 413, { ok: false, error: 'Image size out of bounds' });
              return;
            }
            imgBuffer = Buffer.from(arrBuf);
          } finally {
            clearTimeout(timer);
          }
        } else {
          sendJson(res, 400, {
            ok: false,
            error: 'Provide either remoteUrl or dataUrl in request body',
          });
          return;
        }

        const ext = extFromContentType(contentType);
        const imgPath = path.join(cacheDir, `${safeSlug}.${ext}`);
        const metaPath = path.join(cacheDir, `${safeSlug}.meta.json`);
        const meta: CacheMeta = {
          slug: safeSlug,
          contentType,
          ext,
          sourceUrl,
          attribution,
          cachedAt: new Date().toISOString(),
          bytes: imgBuffer.length,
        };

        await fs.writeFile(imgPath, imgBuffer);
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');

        sendJson(res, 200, {
          ok: true,
          slug: safeSlug,
          localUrl: `/api/bg-cache?slug=${encodeURIComponent(safeSlug)}`,
          contentType,
          bytes: imgBuffer.length,
          attribution,
          sourceUrl,
        });
        return;
      }

      // Clear single slug or full cache: DELETE /api/bg-cache[?slug=...]
      if (req.method === 'DELETE' && pathname === '/') {
        await ensureDir();
        const rawSlug = reqUrl.searchParams.get('slug');
        if (rawSlug) {
          const safeSlug = sanitizeSlug(rawSlug);
          const files = await fs.readdir(cacheDir);
          await Promise.all(
            files
              .filter((f) => f.startsWith(`${safeSlug}.`))
              .map((f) => fs.unlink(path.join(cacheDir, f)).catch(() => undefined))
          );
          sendJson(res, 200, { ok: true, cleared: safeSlug });
          return;
        }
        const files = await fs.readdir(cacheDir);
        await Promise.all(
          files.map((f) => fs.unlink(path.join(cacheDir, f)).catch(() => undefined))
        );
        sendJson(res, 200, { ok: true, cleared: 'all', count: files.length });
        return;
      }

      next();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown cache middleware error';
      sendJson(res, 500, { ok: false, error: msg });
    }
  });
}

export function bgCachePlugin(): Plugin {
  return {
    name: 'cm0102-bg-cache-middleware',
    configureServer(server) {
      attachBgCacheMiddleware(server.middlewares, server.config.root);
    },
    configurePreviewServer(server) {
      attachBgCacheMiddleware(server.middlewares, server.config.root);
    },
  };
}
