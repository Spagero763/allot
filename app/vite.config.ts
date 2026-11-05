import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      server.middlewares.use('/api/faucet', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const { drip } = await server.ssrLoadModule('/api/faucet.ts')
        const response: Response = await drip(env, new Request('http://local/api/faucet', { method: 'POST', body: Buffer.concat(chunks) }))
        res.statusCode = response.status
        res.setHeader('content-type', 'application/json')
        res.end(await response.text())
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApi()],
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
