import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { installNetworkGuard, allowedHosts, BlockedNetworkAccess } from '../src/netguard.ts';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

describe('network guard', () => {
  it('allows only the ClickUp API', () => {
    assert.deepEqual(allowedHosts(), ['api.clickup.com']);
  });

  it('refuses any other destination once installed', async () => {
    installNetworkGuard();
    await assert.rejects(
      fetch('https://example.com/anything'),
      (error: unknown) => error instanceof BlockedNetworkAccess,
    );
    await assert.rejects(fetch('http://169.254.169.254/latest/meta-data'), BlockedNetworkAccess);
    await assert.rejects(fetch('not a url'), BlockedNetworkAccess);
  });

  it('refuses subdomain and lookalike hosts', async () => {
    installNetworkGuard();
    await assert.rejects(fetch('https://api.clickup.com.evil.example/'), BlockedNetworkAccess);
    await assert.rejects(fetch('https://evil-api.clickup.com.example/'), BlockedNetworkAccess);
  });
});

/**
 * Tripwire: the security posture is "one fetch call site, no other outbound
 * primitives anywhere". If a future change adds one, this fails the build and
 * forces the conversation, rather than the promise silently eroding.
 */
describe('network surface of the source tree', () => {
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts'));

  it('has exactly one daemon-side fetch call site, in clickup.ts', () => {
    // ui.ts is exempt: its fetch runs in the *browser* against the loopback
    // server, and the page's CSP pins it there (asserted below).
    const sites: string[] = [];
    for (const file of files) {
      if (file === 'netguard.ts' || file === 'ui.ts') continue;
      const text = fs.readFileSync(path.join(srcDir, file), 'utf8');
      for (const line of text.split('\n')) {
        if (/\bawait fetch\(|\breturn fetch\(|= fetch\(/.test(line)) {
          sites.push(`${file}: ${line.trim()}`);
        }
      }
    }
    assert.equal(sites.length, 1, `unexpected fetch call sites:\n${sites.join('\n')}`);
    assert.match(sites[0]!, /^clickup\.ts/);
  });

  it('serves the review page with a CSP that blocks external connections', () => {
    const serverText = fs.readFileSync(path.join(srcDir, 'server.ts'), 'utf8');
    assert.match(serverText, /Content-Security-Policy/);
    assert.match(serverText, /connect-src 'self'/);
    assert.match(serverText, /default-src 'none'/);
  });

  it('imports no low-level network modules', () => {
    // The guard wraps fetch; these would bypass it. The review server's
    // node:http is inbound-only and allowed in server.ts alone.
    const banned = /from 'node:(net|dgram|tls|http2)'|require\('node:(net|dgram|tls|http2)'\)/;
    for (const file of files) {
      const text = fs.readFileSync(path.join(srcDir, file), 'utf8');
      assert.ok(!banned.test(text), `${file} imports a low-level network module`);
    }
  });

  it('uses node:http only in the loopback review server', () => {
    for (const file of files) {
      const text = fs.readFileSync(path.join(srcDir, file), 'utf8');
      if (/from 'node:https?'/.test(text)) {
        assert.equal(file, 'server.ts', `${file} imports node:http`);
      }
    }
  });

  it('references no external host other than the ClickUp API', () => {
    // Any URL literal in the daemon must be loopback or ClickUp. app.clickup.com
    // appears only inside regex patterns and constructed task links.
    const allowed = /(127\.0\.0\.1|localhost|api\.clickup\.com|app\.clickup\.com)/;
    for (const file of files) {
      const text = fs.readFileSync(path.join(srcDir, file), 'utf8');
      for (const match of text.matchAll(/https?:\/\/[A-Za-z0-9.-]+/g)) {
        assert.ok(allowed.test(match[0]), `${file} references ${match[0]}`);
      }
    }
  });
});
