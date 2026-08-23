import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'save-products-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            // FIXED: Added the product endpoint string path '/api/save-products'
            if (req.method === 'POST' && req.url === '/api/save-products') {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const products = JSON.parse(body);
                  const productsFilePath = path.resolve(__dirname, 'public/data/products.json');
                  fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2), 'utf-8');
                  
                  // Write to dist/ data directory if it exists as well
                  const distProductsFilePath = path.resolve(__dirname, 'dist/data/products.json');
                  try {
                    fs.mkdirSync(path.dirname(distProductsFilePath), { recursive: true });
                    fs.writeFileSync(distProductsFilePath, JSON.stringify(products, null, 2), 'utf-8');
                  } catch (e) {
                    console.warn('Could not write to dist products.json:', e);
                  }

                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                } catch (err) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
            // FIXED: Added the image upload endpoint string path '/api/upload-image'
            } else if (req.method === 'POST' && req.url === '/api/upload-image') {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const data = JSON.parse(body);
                  const { filename, base64 } = data;
                  if (!filename || !base64) {
                    throw new Error('Missing filename or base64 data');
                  }
                  
                  // Extract the pure base64 part
                  const base64Data = base64.replace(/^data:image\/[^;]+;base64,/, "");
                  const buffer = Buffer.from(base64Data, 'base64');
                  
                  // Generate unique name to prevent conflicts
                  const cleanFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                  const uniqueFilename = `upload_${Date.now()}_${cleanFilename}`;
                  
                  const targetPath = path.resolve(__dirname, 'public/assets/images', uniqueFilename);
                  fs.writeFileSync(targetPath, buffer);
                  
                  // Write to dist/ assets directory if it exists as well
                  const distImagePath = path.resolve(__dirname, 'dist/assets/images', uniqueFilename);
                  try {
                    fs.mkdirSync(path.dirname(distImagePath), { recursive: true });
                    fs.writeFileSync(distImagePath, buffer);
                  } catch (e) {
                    console.warn('Could not write to dist image:', e);
                  }

                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ 
                    success: true, 
                    url: `./assets/images/${uniqueFilename}` 
                  }));
                } catch (err) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          products: path.resolve(__dirname, 'products.html'),
          product: path.resolve(__dirname, 'product.html'),
          about: path.resolve(__dirname, 'about.html'),
          contact: path.resolve(__dirname, 'contact.html'),
          faq: path.resolve(__dirname, 'faq.html'),
          privacy: path.resolve(__dirname, 'privacy.html'),
          terms: path.resolve(__dirname, 'terms.html'),
          refund: path.resolve(__dirname, 'refund.html'),
          cookie: path.resolve(__dirname, 'cookie-policy.html'),
          blog: path.resolve(__dirname, 'blog.html'),
          blogPost: path.resolve(__dirname, 'blog-post.html'),
          success: path.resolve(__dirname, 'success.html'),
          admin: path.resolve(__dirname, 'admin.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify file watching to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

