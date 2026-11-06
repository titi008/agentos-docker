// Creates the RSA key pair for Cloudflare Access sign-in: the UI server signs
// AgentOS tokens with the private key, and the AgentOS API checks them with the
// public key. Prints file paths only, never key contents.
//
// Usage: pnpm signing-key [output-directory]   (default: .keys)
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const directory = resolve(process.argv[2] ?? '.keys')
const privatePath = join(directory, 'agentos-ui-signing-key.pem')
const publicPath = join(directory, 'agentos-verification-key.pem')

if (existsSync(privatePath) || existsSync(publicPath)) {
  console.error(
    `Keys already exist in ${directory}. Move them away first so a key pair in use is not replaced.`
  )
  process.exit(1)
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
})

mkdirSync(directory, { recursive: true, mode: 0o700 })
writeFileSync(privatePath, privateKey, { mode: 0o600 })
writeFileSync(publicPath, publicKey, { mode: 0o644 })

console.log(`Created a 3072-bit RSA key pair in ${directory}

  ${privatePath}
    Secret. Set its contents as AGENTOS_TOKEN_SIGNING_KEY on the UI service only.

  ${publicPath}
    Public. Set its contents as JWT_VERIFICATION_KEY on the AgentOS API.

Delete both files once they are stored in your deployment's settings.`)
