const test = require('node:test');
const assert = require('node:assert/strict');
const {
  issueSessionToken,
  verifySessionToken,
} = require('../dist/security/sessionToken.js');
const {
  authorizeApiRequest,
} = require('../dist/middleware/apiSecurity.js');

const claims = (role) => ({
  sub: '1',
  email: 'test@ku.edu.af',
  name: 'Test User',
  role,
  kind: 'user',
});

const policyResult = (path, method, role) => {
  let nextCalled = false;
  const req = { path, method, query: {}, wmsAuth: { ...claims(role), iat: 1, exp: 9999999999 } };
  const result = { status: 200, body: null };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  authorizeApiRequest(req, res, () => {
    nextCalled = true;
  });
  return { ...result, nextCalled };
};

test('session token round-trips signed claims', () => {
  const token = issueSessionToken(claims('Warehouse Director'));
  const decoded = verifySessionToken(token);
  assert.equal(decoded.sub, '1');
  assert.equal(decoded.role, 'Warehouse Director');
  assert.ok(decoded.exp > decoded.iat);
});

test('tampered session token is rejected', () => {
  const token = issueSessionToken(claims('Super Admin'));
  const [payload, signature] = token.split('.');
  const tampered = `${payload.slice(0, -1)}A.${signature}`;
  assert.throws(() => verifySessionToken(tampered));
});

test('only Super Admin can access backup API', () => {
  assert.equal(policyResult('/backup/list', 'GET', 'Super Admin').nextCalled, true);
  assert.equal(policyResult('/backup/list', 'GET', 'Admin').status, 403);
});

test('only a signed-in Super Admin can delete users', () => {
  assert.equal(policyResult('/users/12', 'DELETE', 'Super Admin').nextCalled, true);
  assert.equal(policyResult('/users/12', 'DELETE', 'Admin').status, 403);
});

test('stock-out rejects entry role but allows warehouse director', () => {
  assert.equal(
    policyResult('/inventory/stock-out', 'POST', 'Warehouse Director').nextCalled,
    true,
  );
  assert.equal(
    policyResult('/inventory/stock-out', 'POST', 'Warehouse Entry Person').status,
    403,
  );
});

test('request workflow stays available to authenticated requester', () => {
  assert.equal(policyResult('/requests/34/status', 'PUT', 'Requester').nextCalled, true);
});
