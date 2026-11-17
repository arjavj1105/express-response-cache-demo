const express = require('express');
const cache = require('express-response-cache-middleware');

const app = express();
app.use(express.json());

// In-memory data store for the demonstration
let products = [
  { id: 1, name: 'Mechanical Keyboard', price: 129.99, stock: 45 },
  { id: 2, name: 'Wireless Gaming Mouse', price: 79.99, stock: 80 },
  { id: 3, name: 'Ultra-Wide 4K Monitor', price: 499.99, stock: 15 }
];

// Helper to simulate asynchronous database retrieval delay
const simulateDatabaseDelay = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));

// Diagnostic counter to verify database execution vs cached responses
let databaseQueryCount = 0;

/**
 * Root endpoint - API information and testing guide
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to express-response-cache-middleware Consumer Demo!',
    documentation: {
      getProducts: 'GET /api/products (cached with tag: "products")',
      getProductById: 'GET /api/products/:id (cached with tag: "product:{id}")',
      createProduct: 'POST /api/products (invalidates tag: "products")',
      updateProduct: 'PUT /api/products/:id (invalidates "products" and "product:{id}")',
      deleteProduct: 'DELETE /api/products/:id (invalidates "products" and "product:{id}")',
      stats: 'GET /api/stats (cache inspection & database query counter)'
    }
  });
});

/**
 * GET /api/products
 * Caches the complete products collection under the 'products' tag for 60 seconds.
 */
app.get(
  '/api/products',
  cache({
    ttl: 60,
    tags: ['products']
  }),
  async (req, res) => {
    databaseQueryCount++;
    await simulateDatabaseDelay(150);
    res.json({
      data: products,
      databaseQueryCount,
      servedBy: 'database-query'
    });
  }
);

/**
 * GET /api/products/:id
 * Caches single product details under both 'products' and a granular 'product:{id}' tag.
 */
app.get(
  '/api/products/:id',
  cache({
    ttl: 60,
    tags: (req) => [`product:${req.params.id}`]
  }),
  async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    databaseQueryCount++;
    await simulateDatabaseDelay(100);

    const product = products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      data: product,
      databaseQueryCount,
      servedBy: 'database-query'
    });
  }
);

/**
 * POST /api/products
 * Creates a new product and automatically invalidates all cached entries tagged with 'products'.
 */
app.post(
  '/api/products',
  cache.invalidate({
    tags: ['products']
  }),
  (req, res) => {
    const { name, price, stock } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const newProduct = {
      id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
      name,
      price: parseFloat(price),
      stock: stock !== undefined ? parseInt(stock, 10) : 0
    };

    products.push(newProduct);
    res.status(201).json({
      message: 'Product created successfully',
      data: newProduct
    });
  }
);

/**
 * PUT /api/products/:id
 * Updates an existing product and invalidates the collection and the specific product tag.
 */
app.put(
  '/api/products/:id',
  cache.invalidate({
    tags: (req) => ['products', `product:${req.params.id}`]
  }),
  (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const index = products.findIndex(p => p.id === productId);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { name, price, stock } = req.body;
    products[index] = {
      ...products[index],
      ...(name && { name }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(stock !== undefined && { stock: parseInt(stock, 10) })
    };

    res.json({
      message: 'Product updated successfully',
      data: products[index]
    });
  }
);

/**
 * DELETE /api/products/:id
 * Removes a product and invalidates the collection and the specific product tag.
 */
app.delete(
  '/api/products/:id',
  cache.invalidate({
    tags: (req) => ['products', `product:${req.params.id}`]
  }),
  (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const index = products.findIndex(p => p.id === productId);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const deleted = products.splice(index, 1)[0];
    res.json({
      message: 'Product deleted successfully',
      data: deleted
    });
  }
);

/**
 * GET /api/stats
 * Diagnostic endpoint for inspecting cache state and query counts.
 */
app.get('/api/stats', (req, res) => {
  const defaultStore = cache.getDefaultStore();
  res.json({
    databaseQueryCount,
    cachedEntriesCount: defaultStore.size,
    cachedKeys: defaultStore.keys()
  });
});

// Helper for testing to reset state
function resetState() {
  products = [
    { id: 1, name: 'Mechanical Keyboard', price: 129.99, stock: 45 },
    { id: 2, name: 'Wireless Gaming Mouse', price: 79.99, stock: 80 },
    { id: 3, name: 'Ultra-Wide 4K Monitor', price: 499.99, stock: 15 }
  ];
  databaseQueryCount = 0;
  cache.clear();
}

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Consumer Demo Server listening on http://localhost:${PORT}`);
    console.log('Using express-response-cache-middleware from npm registry');
  });
}

module.exports = { app, resetState };
