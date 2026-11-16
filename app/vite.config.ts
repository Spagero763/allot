import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      const route = (path: string, file: string, name: string) =>
        server.middlewares.use(path, async (req, res) => {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const mod = await server.ssrLoadModule(file)
          const response: Response = await mod[name](env, new Request('http://local' + path, { method: 'POST', body: Buffer.concat(chunks) }))
          res.statusCode = response.status
          res.setHeader('content-type', 'application/json')
          res.end(await response.text())
        })
      route('/api/faucet', '/api/faucet.ts', 'drip')
      route('/api/verify', '/api/verify.ts', 'verify')
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
