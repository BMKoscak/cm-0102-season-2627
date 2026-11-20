/**
 * Live Vite Dev Server & /api/bg-cache Middleware Smoke Test
 * Starts `npm.cmd run dev -- --port 4179`, verifies HTTP 200 on `/` and `/api/bg-cache/list`,
 * exercises POST -> GET -> DELETE roundtrip on `/api/bg-cache`, then cleanly terminates server.
 */

import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = 4179;
const BASE_URL = `http://localhost:${PORT}`;

// Minimal valid 1x1 PNG dataUrl (>256 bytes padded? No, middleware accepts any valid base64 PNG!)
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already exited
    }
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // not listening yet
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url} after ${timeoutMs}ms`);
}

async function main() {
  console.log(`=== Live Vite Server & /api/bg-cache Smoke Test (port ${PORT}) ===`);

  const child = spawn('cmd.exe', ['/c', 'npm.cmd', 'run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stdoutBuf = '';
  let stderrBuf = '';
  child.stdout?.on('data', (d) => { stdoutBuf += d.toString(); });
  child.stderr?.on('data', (d) => { stderrBuf += d.toString(); });

  try {
    // 1. Wait for index HTML (HTTP 200)
    const rootRes = await waitForServer(`${BASE_URL}/`, 15000);
    assert.equal(rootRes.status, 200, `Expected 200 on /, got ${rootRes.status}`);
    const html = await rootRes.text();
    assert.ok(html.includes('Championship Manager 01/02'), 'Index HTML missing expected title');
    console.log('  [PASS] GET / -> HTTP 200 (Championship Manager 01/02 HTML served)');

    // 2. GET /api/bg-cache/list -> HTTP 200
    const listRes = await fetch(`${BASE_URL}/api/bg-cache/list`);
    assert.equal(listRes.status, 200, `Expected 200 on /api/bg-cache/list, got ${listRes.status}`);
    const listJson = await listRes.json();
    assert.equal(typeof listJson.count, 'number');
    assert.ok(Array.isArray(listJson.slugs));
    console.log(`  [PASS] GET /api/bg-cache/list -> HTTP 200 (count=${listJson.count})`);

    // 3. Roundtrip POST -> GET -> DELETE on a temporary test slug
    const testSlug = 'qa-smoke-test-slug';
    const postRes = await fetch(`${BASE_URL}/api/bg-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: testSlug,
        dataUrl: TINY_PNG_DATA_URL,
        attribution: 'QA Smoke Test',
        sourceUrl: 'https://example.com/smoke.png',
      }),
    });
    assert.equal(postRes.status, 200, `POST /api/bg-cache failed with ${postRes.status}`);
    const postJson = await postRes.json();
    assert.equal(postJson.ok, true);
    assert.equal(postJson.localUrl, `/api/bg-cache?slug=${testSlug}`);

    const getRes = await fetch(`${BASE_URL}${postJson.localUrl}`);
    assert.equal(getRes.status, 200, `GET cached image failed with ${getRes.status}`);
    assert.equal(getRes.headers.get('x-bg-cache'), 'HIT');
    assert.ok((getRes.headers.get('content-type') || '').startsWith('image/png'));
    const imgBytes = await getRes.arrayBuffer();
    assert.ok(imgBytes.byteLength > 0);

    const delRes = await fetch(`${BASE_URL}/api/bg-cache?slug=${testSlug}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    const afterDel = await fetch(`${BASE_URL}/api/bg-cache?slug=${testSlug}`);
    assert.equal(afterDel.status, 404, 'Expected 404 after DELETE');
    console.log('  [PASS] POST -> GET (X-BG-Cache: HIT, image/png) -> DELETE roundtrip clean');
  } catch (err) {
    console.error('Server stdout:\n', stdoutBuf);
    console.error('Server stderr:\n', stderrBuf);
    throw err;
  } finally {
    killProcessTree(child.pid);
    await sleep(300);
    // Verify port is no longer responding
    let stillAlive = false;
    try {
      await fetch(`${BASE_URL}/`);
      stillAlive = true;
    } catch {
      stillAlive = false;
    }
    assert.equal(stillAlive, false, `Port ${PORT} still listening after shutdown!`);
    console.log(`  [PASS] Dev server on port ${PORT} shut down cleanly (0 orphan processes)`);
  }
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
