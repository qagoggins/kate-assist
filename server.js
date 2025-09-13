const http = require('http');

function startServer() {
  const port = process.env.PORT || 8080;
  http
    .createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    })
    .listen(port, () => {
      console.log(`Healthcheck server running on port ${port}`);
    });
}

module.exports = { startServer };