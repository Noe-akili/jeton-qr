import { cpSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'nodejs')
const dest = resolve(root, 'dist', 'nodejs')

mkdirSync(dest, { recursive: true })
cpSync(resolve(src, 'server.js'), resolve(dest, 'server.js'))
cpSync(resolve(src, 'package.json'), resolve(dest, 'package.json'))
console.log('Serveur Node.js copié dans dist/nodejs')
