const { app } = require('../src/server');

// Also mount the root handler explicitly on /api so both / and /api serve the API documentation
app.get('/api', (req, res) => {
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

module.exports = app;
