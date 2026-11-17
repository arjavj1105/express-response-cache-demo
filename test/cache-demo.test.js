const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { app, resetState } = require('../src/server');

describe('Consumer Demo — express-response-cache-middleware Integration Tests', () => {
  let server;
  let baseUrl;

  beforeEach((t, done) => {
    resetState();
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterEach((t, done) => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(
        url,
        {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : {}
        },
        (res) => {
          let rawData = '';
          res.on('data', chunk => rawData += chunk);
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: rawData ? JSON.parse(rawData) : null
            });
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  it('A. First GET request returns Cache MISS and executes database query', async () => {
    const res = await request('GET', '/api/products');

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-cache'], 'MISS', 'Expected X-Cache: MISS on initial fetch');
    assert.strictEqual(res.body.databaseQueryCount, 1, 'Database query should execute once on MISS');
    assert.strictEqual(res.body.data.length, 3, 'Should return 3 initial products');
  });

  it('B. Repeated GET request returns Cache HIT and avoids database query', async () => {
    // 1. First fetch (MISS)
    const firstRes = await request('GET', '/api/products');
    assert.strictEqual(firstRes.headers['x-cache'], 'MISS');
    assert.strictEqual(firstRes.body.databaseQueryCount, 1);

    // 2. Second fetch (HIT)
    const secondRes = await request('GET', '/api/products');
    assert.strictEqual(secondRes.statusCode, 200);
    assert.strictEqual(secondRes.headers['x-cache'], 'HIT', 'Expected X-Cache: HIT on repeated fetch');
    assert.ok(secondRes.headers['x-cache-timestamp'], 'Expected X-Cache-Timestamp header on cache HIT');
    assert.strictEqual(secondRes.body.databaseQueryCount, 1, 'Database query count must NOT increase on cache HIT');
    assert.deepStrictEqual(secondRes.body.data, firstRes.body.data, 'Cached response data must match original payload');
  });

  it('C & D. POST mutation invalidates cached products and subsequent GET returns fresh MISS with new data', async () => {
    // 1. Initial GET -> MISS (databaseQueryCount: 1)
    const get1 = await request('GET', '/api/products');
    assert.strictEqual(get1.headers['x-cache'], 'MISS');
    assert.strictEqual(get1.body.data.length, 3);
    assert.strictEqual(get1.body.databaseQueryCount, 1);

    // 2. Subsequent GET -> HIT (served from cache)
    const get2 = await request('GET', '/api/products');
    assert.strictEqual(get2.headers['x-cache'], 'HIT');
    assert.strictEqual(get2.body.databaseQueryCount, 1);

    // 3. POST mutation -> Creates a new product and invalidates 'products' tag
    const mutationRes = await request('POST', '/api/products', {
      name: 'Noise-Cancelling Headphones',
      price: 249.99,
      stock: 30
    });
    assert.strictEqual(mutationRes.statusCode, 201);
    assert.strictEqual(mutationRes.body.data.name, 'Noise-Cancelling Headphones');

    // 4. GET after mutation -> Must be fresh MISS with updated products array
    const get3 = await request('GET', '/api/products');
    assert.strictEqual(get3.statusCode, 200);
    assert.strictEqual(get3.headers['x-cache'], 'MISS', 'Expected fresh MISS after cache invalidation');
    assert.strictEqual(get3.body.databaseQueryCount, 2, 'Database query must re-execute to fetch fresh state');
    assert.strictEqual(get3.body.data.length, 4, 'Must contain 4 products including newly added item');
    assert.strictEqual(get3.body.data[3].name, 'Noise-Cancelling Headphones');
  });

  it('E. Granular tag invalidation: PUT /api/products/1 invalidates detail and collection without affecting product 2', async () => {
    // Cache collection, product 1, and product 2
    await request('GET', '/api/products');
    const p1Before = await request('GET', '/api/products/1');
    assert.strictEqual(p1Before.headers['x-cache'], 'MISS');
    const p2Before = await request('GET', '/api/products/2');
    assert.strictEqual(p2Before.headers['x-cache'], 'MISS');

    // Verify product 2 is cached
    const p2Cached = await request('GET', '/api/products/2');
    assert.strictEqual(p2Cached.headers['x-cache'], 'HIT');

    // Update product 1
    const putRes = await request('PUT', '/api/products/1', {
      name: 'Mechanical Keyboard RGB Pro',
      price: 159.99
    });
    assert.strictEqual(putRes.statusCode, 200);

    // Product 1 must now be a fresh MISS
    const p1After = await request('GET', '/api/products/1');
    assert.strictEqual(p1After.headers['x-cache'], 'MISS');
    assert.strictEqual(p1After.body.data.name, 'Mechanical Keyboard RGB Pro');

    // Product 2 must still be a cache HIT (resource isolation)
    const p2After = await request('GET', '/api/products/2');
    assert.strictEqual(p2After.headers['x-cache'], 'HIT', 'Unrelated product cache should remain preserved');
  });

  it('F. Failed mutation (400 Bad Request) protects existing cache and does NOT invalidate', async () => {
    // Populate cache
    await request('GET', '/api/products');
    const hitBefore = await request('GET', '/api/products');
    assert.strictEqual(hitBefore.headers['x-cache'], 'HIT');

    // Send invalid POST (missing price)
    const failedPost = await request('POST', '/api/products', { name: 'Faulty Item' });
    assert.strictEqual(failedPost.statusCode, 400);

    // Cache should remain HIT because invalidation only occurs on 2xx
    const hitAfter = await request('GET', '/api/products');
    assert.strictEqual(hitAfter.headers['x-cache'], 'HIT', 'Cache must not be invalidated on 4xx error responses');
  });
});
