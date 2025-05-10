import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const port = 8082; // Different from your Vite server port

app.use(cors());

// Proxy middleware configuration
const flutterwaveProxy = createProxyMiddleware({
  target: 'https://api.flutterwave.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/flutterwave': '/v3', // Remove /api/flutterwave and add /v3
  },
  onProxyReq: (proxyReq, req) => {
    // Log the outgoing request
    console.log('Proxying request:', {
      method: req.method,
      path: req.path,
      headers: req.headers
    });
  },
  onProxyRes: (proxyRes, req) => {
    // Log the response
    console.log('Received response:', {
      status: proxyRes.statusCode,
      path: req.path,
      headers: proxyRes.headers
    });
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(500).json({ error: 'Proxy Error', message: err.message });
  }
});

// Use the proxy for all routes starting with /api/flutterwave
app.use('/api/flutterwave', flutterwaveProxy);

app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
}); 