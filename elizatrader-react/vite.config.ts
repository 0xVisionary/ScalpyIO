import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-assets',
      closeBundle() {
        // Create dist/assets directory if it doesn't exist
        mkdirSync('dist/assets', { recursive: true });
        
        // Copy manifest.json to dist
        copyFileSync('public/manifest.json', 'dist/manifest.json');
        
        // Copy popup files
        copyFileSync('public/popup.html', 'dist/popup.html');
        copyFileSync('public/popup.js', 'dist/popup.js');
        
        // Copy all assets
        copyFileSync('public/assets/icon16.png', 'dist/assets/icon16.png');
        copyFileSync('public/assets/icon32.png', 'dist/assets/icon32.png');
        copyFileSync('public/assets/icon48.png', 'dist/assets/icon48.png');
        copyFileSync('public/assets/icon128.png', 'dist/assets/icon128.png');
      },
    },
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.ts'),
        contentScript: resolve(__dirname, 'src/contentScript.tsx'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background' || chunkInfo.name === 'contentScript') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    sourcemap: true,
  },
})
