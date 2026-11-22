const { app } = require('../src/server');

module.exports = (req, res) => {
  // If request URL is root, ensure Express matches '/'
  if (req.url === '' || !req.url) {
    req.url = '/';
  }
  return app(req, res);
};
