const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')

function readEnv(filePath) {
  const env = {}
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx === -1) continue
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return env
}

async function main() {
  const env = readEnv(path.join(process.cwd(), '.env'))
  const token = jwt.sign({ id: 1 }, env.JWT_SECRET)
  const response = await fetch('http://127.0.0.1:1339/api/exam-rounds/1/payments', {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-code': 'dhcd',
    },
  })
  const text = await response.text()
  console.log(JSON.stringify({ status: response.status, body: text }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
