import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env': {},
  },
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'solana', test: /node_modules[\\/].*(@solana|@coral-xyz|bn\.js|borsh|buffer|@noble)/ },
            { name: 'motion', test: /node_modules[\\/].*(motion|framer-motion)/ },
          ],
        },
      },
    },
  },
})
