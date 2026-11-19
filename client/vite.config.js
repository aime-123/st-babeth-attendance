import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'print-dev-url',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const address = server.httpServer.address()

          if (address && typeof address !== 'string') {
            console.log(`Frontend: http://localhost:${address.port}/`)
          }
        })
      },
    },
  ],
  logLevel: 'error',
})
