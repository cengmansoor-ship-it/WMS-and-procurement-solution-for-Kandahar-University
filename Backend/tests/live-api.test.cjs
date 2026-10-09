const test = require('node:test');
const assert = require('node:assert/strict');
const { issueSessionToken } = require('../dist/security/sessionToken.js');

const baseUrl = process.env.WMS_TEST_BASE_URL || 'http://127.0.0.1:3001';

test('public health endpoint is online', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
});

test('protected inventory endpoint rejects anonymous access', async () => {
  const response = await fetch(`${baseUrl}/api/inventory/items`);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.code, 'SESSION_REQUIRED');
});

test('signed warehouse session can read inventory and request workflow', async () => {
  const token = issueSessionToken({
    sub: '4',
    email: 'warehouse@ku.edu.af',
    name: 'Warehouse Test',
    role: 'Warehouse Director',
    kind: 'user',
  });
  const headers = { Cookie: `wms_session=${encodeURIComponent(token)}` };
  const [items, request] = await Promise.all([
    fetch(`${baseUrl}/api/inventory/items`, { headers }),
    fetch(`${baseUrl}/api/requests/34`, { headers }),
  ]);
  assert.equal(items.status, 200);
  assert.equal(request.status, 200);
});

test('server-side role policy denies warehouse access to backups', async () => {
  const token = issueSessionToken({
    sub: '4',
    email: 'warehouse@ku.edu.af',
    name: 'Warehouse Test',
    role: 'Warehouse Director',
    kind: 'user',
  });
  const response = await fetch(`${baseUrl}/api/backup/create`, {
    method: 'POST',
    headers: { Cookie: `wms_session=${encodeURIComponent(token)}` },
  });
  assert.equal(response.status, 403);
});
