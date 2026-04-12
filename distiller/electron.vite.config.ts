import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// VSCode sets ELECTRON_RUN_AS_NODE=1 in its terminal environment, which causes
// Electron to run as plain Node.js (disabling all Electron APIs). Delete it here
// so electron-vite spawns Electron with the correct process type.
delete process.env['ELECTRON_RUN_AS_NODE']

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'electron/main.ts'
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'electron/preload.ts'
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: path.join(__dirname, 'index.html')
      }
    },
    plugins: [react()]
  }
})
