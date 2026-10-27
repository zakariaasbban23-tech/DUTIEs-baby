const { copyFileSync } = require('node:fs')
const { join } = require('node:path')

copyFileSync(join(__dirname, 'preview-server.cjs'), join(__dirname, '..', 'dist', 'boot.js'))
