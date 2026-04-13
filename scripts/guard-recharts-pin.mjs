import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const expectedRechartsVersion = '3.4.1'
const here = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(here, '..')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function fail(message) {
  console.error(`Recharts regression guard failed: ${message}`)
  process.exit(1)
}

const packageJsonPath = resolve(projectRoot, 'package.json')
const lockJsonPath = resolve(projectRoot, 'package-lock.json')
const packageJson = readJson(packageJsonPath)
const lockJson = readJson(lockJsonPath)

const manifestVersion = packageJson?.dependencies?.recharts
if (manifestVersion !== expectedRechartsVersion) {
  fail(
    `expected dependencies.recharts=${expectedRechartsVersion}, found ${manifestVersion ?? 'missing'}`
  )
}

const lockPackages = lockJson?.packages ?? {}
const lockRootVersion = lockPackages?.['']?.dependencies?.recharts
const lockInstalledVersion = lockPackages?.['node_modules/recharts']?.version

if (lockRootVersion !== expectedRechartsVersion) {
  fail(
    `expected package-lock root dependency recharts=${expectedRechartsVersion}, found ${lockRootVersion ?? 'missing'}`
  )
}

if (lockInstalledVersion !== expectedRechartsVersion) {
  fail(
    `expected package-lock node_modules/recharts version=${expectedRechartsVersion}, found ${lockInstalledVersion ?? 'missing'}`
  )
}

console.log(
  `Recharts regression guard passed (${expectedRechartsVersion}); pinned to prevent ./util/Global resolution regressions during dependency updates.`
)
