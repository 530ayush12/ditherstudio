#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cli = path.join(root, 'src', 'cli.ts')
const child = spawn('npx', ['tsx', cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
  shell: process.platform === 'win32',
})
child.on('exit', (code) => process.exit(code ?? 0))
