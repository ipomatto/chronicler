import { app, BrowserWindow, shell, Menu } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { registerHandlers } from './ipc/handlers'
import type { AppConfig } from '../src/types/entities'

process.on('uncaughtException', (err) => {
  console.error('[MAIN] uncaughtException', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[MAIN] unhandledRejection', reason)
})

// ---------------------------------------------------------------------------
// Path resolution: dev uses source-relative paths, packaged uses resourcesPath
// ---------------------------------------------------------------------------

function resolveProjectPath(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments)
  }
  // In dev: __dirname = out/main/, project root is 3 levels up
  return path.join(__dirname, '../../..', ...segments)
}

function loadDevToolsSetting(): boolean {
  try {
    const configPath = resolveProjectPath('config', 'app.json')
    const raw = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw) as AppConfig & { ui?: { devtools?: boolean } }
    return config.ui?.devtools === true
  } catch {
    return false
  }
}

function createWindow(): BrowserWindow {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'resources', 'icon.ico')
    : path.join(__dirname, '../../resources/icon.ico')

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Chronicler Distiller',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Open external links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])

    // Open DevTools only if explicitly enabled via env var or config
    const devtoolsEnabled =
      process.env['CHRONICLER_DEVTOOLS'] === '1' || loadDevToolsSetting()
    if (devtoolsEnabled) {
      win.webContents.openDevTools()
    }
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

  registerHandlers({
    dataPath: resolveProjectPath('data'),
    promptsBasePath: resolveProjectPath('prompts'),
    configBasePath: resolveProjectPath('config'),
    keysFilePath: path.join(app.getPath('userData'), 'keys.bin')
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
