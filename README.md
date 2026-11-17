# express-response-cache-demo

> **Live Consumer Demonstration** for the [`express-response-cache-middleware`](https://www.npmjs.com/package/express-response-cache-middleware) npm package.

This repository demonstrates how an independent developer installs and integrates `express-response-cache-middleware` directly from the public npm registry to achieve transparent HTTP response caching and automatic tag-based cache invalidation in an Express.js application.

---

## Related Project Links

- **Published npm Package:** [https://www.npmjs.com/package/express-response-cache-middleware](https://www.npmjs.com/package/express-response-cache-middleware)
- **Source Package GitHub Repository:** [https://github.com/arjavj1105/NPM-PACKAGE](https://github.com/arjavj1105/NPM-PACKAGE)
- **Demonstration Repository:** [https://github.com/arjavj1105/express-response-cache-demo](https://github.com/arjavj1105/express-response-cache-demo)

---

## Key Behaviors Demonstrated

1. **First GET Request — Cache MISS (`X-Cache: MISS`)**:
   The response is not yet in the cache. The underlying database query executes, and the HTTP response is automatically captured and stored in memory.

2. **Subsequent GET Request — Cache HIT (`X-Cache: HIT`)**:
   Repeated requests to the same endpoint bypass the database layer completely. Cached headers and body are served directly from memory alongside the `X-Cache-Timestamp` header.

3. **POST Mutation — Tag Invalidation**:
   When a client creates a new product via `POST /api/products`, the invalidation middleware intercepts the successful `201 Created` response and immediately purges all cache entries associated with the `'products'` tag.

4. **Subsequent GET After Mutation — Fresh Cache MISS**:
   The next `GET /api/products` triggers a cache MISS, executes a fresh database query, and returns the updated collection containing the newly added product.

5. **Granular Resource Isolation**:
   Updating `PUT /api/products/1` purges the collection and `'product:1'` detail cache, leaving unrelated items like `'product:2'` safely cached.

6. **Failed Mutation Protection**:
   Mutations returning client errors (`400 Bad Request`) or server errors (`500 Server Error`) never invalidate the cache, preventing cache thrashing from invalid client input.

---

## Prerequisites

- **Node.js**: `>=18.0.0`
- **npm**: `>=9.0.0`

---

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/arjavj1105/express-response-cache-demo.git
   cd express-response-cache-demo
   ```

2. **Install dependencies from npm:**
   ```bash
   npm install
   ```
   *(Notice that `package.json` installs `express-response-cache-middleware` directly from the global npm registry, not from a local file or relative path.)*

3. **Start the demonstration server:**
   ```bash
   npm start
   ```
   The server will start listening on `http://localhost:3000`.

---

## Available API Endpoints

| Method | Endpoint | Description | Cache Behavior |
|---|---|---|---|
| `GET` | `/` | API overview and testing guide | Non-cached |
| `GET` | `/api/products` | Retrieve all products (simulated 150ms DB query) | Cached (tag: `'products'`, TTL: 60s) |
| `GET` | `/api/products/:id` | Retrieve product details (simulated 100ms DB query) | Cached (tag: `'product:{id}'`, TTL: 60s) |
| `POST` | `/api/products` | Create a new product | Invalidates tag: `'products'` |
| `PUT` | `/api/products/:id` | Update product details | Invalidates tags: `'products'`, `'product:{id}'` |
| `DELETE` | `/api/products/:id` | Delete product | Invalidates tags: `'products'`, `'product:{id}'` |
| `GET` | `/api/stats` | Diagnostic cache inspection & query counter | Non-cached |

---

## Step-by-Step Verification with `curl`

Open your terminal and execute the following commands against the running server:

### Step 1: Initial Fetch (Cache MISS)
```bash
curl -i http://localhost:3000/api/products
```
**Expected Headers & Behavior:**
```http
HTTP/1.1 200 OK
X-Cache: MISS
Content-Type: application/json; charset=utf-8
```
*The database query executes (`databaseQueryCount: 1`), simulating an initial 150ms delay.*

---

### Step 2: Repeated Fetch (Cache HIT)
```bash
curl -i http://localhost:3000/api/products
```
**Expected Headers & Behavior:**
```http
HTTP/1.1 200 OK
X-Cache: HIT
X-Cache-Timestamp: 2026-11-17T09:50:00.000Z
Content-Type: application/json; charset=utf-8
```
*The response is served directly from the in-memory cache. `databaseQueryCount` remains `1`.*

---

### Step 3: Create a New Product (POST Mutation)
```bash
curl -i -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name": "4K Ultra-HD Webcam", "price": 89.99, "stock": 25}'
```
**Expected Response:**
```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{
  "message": "Product created successfully",
  "data": { "id": 4, "name": "4K Ultra-HD Webcam", "price": 89.99, "stock": 25 }
}
```
*The invalidation middleware automatically purges all cache entries tagged with `'products'` upon successful 201 Created status.*

---

### Step 4: Subsequent Fetch (Fresh Cache MISS with New Data)
```bash
curl -i http://localhost:3000/api/products
```
**Expected Headers & Behavior:**
```http
HTTP/1.1 200 OK
X-Cache: MISS
Content-Type: application/json; charset=utf-8
```
*The cache entry was cleared by the mutation. A fresh database query executes (`databaseQueryCount: 2`), and the response includes the newly created product (`"4K Ultra-HD Webcam"`).*

---

### Step 5: Verify Cache Diagnostics
```bash
curl -s http://localhost:3000/api/stats
```
**Expected Response:**
```json
{
  "databaseQueryCount": 2,
  "cachedEntriesCount": 1,
  "cachedKeys": ["GET::/api/products"]
}
```

---

## Running Automated Tests

Run the full integration test suite:

```bash
npm test
```

### Verified Test Output
```text
▶ Consumer Demo — express-response-cache-middleware Integration Tests
  ✔ A. First GET request returns Cache MISS and executes database query (160.35ms)
  ✔ B. Repeated GET request returns Cache HIT and avoids database query (158.33ms)
  ✔ C & D. POST mutation invalidates cached products and subsequent GET returns fresh MISS with new data (318.42ms)
  ✔ E. Granular tag invalidation: PUT /api/products/1 invalidates detail and collection without affecting product 2 (466.43ms)
  ✔ F. Failed mutation (400 Bad Request) protects existing cache and does NOT invalidate (157.42ms)
✔ Consumer Demo — express-response-cache-middleware Integration Tests (1261.79ms)

ℹ tests 5
ℹ suites 1
ℹ pass 5
ℹ fail 0
```

---

## License

This project is licensed under the [MIT License](LICENSE).
