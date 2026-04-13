import fs from 'node:fs/promises'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionFingerprint {
  sessione: string
  date: string
  simhash: string   // 16-char hex representation of 64-bit hash
  preview: string   // first ~120 chars of the recap
}

export interface FingerprintMatch {
  fingerprint: SessionFingerprint
  distance: number
}

// ---------------------------------------------------------------------------
// FNV-1a 32-bit hash (no external deps)
// ---------------------------------------------------------------------------

function fnv1a32(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// ---------------------------------------------------------------------------
// SimHash (64-bit via two 32-bit halves)
// ---------------------------------------------------------------------------

const SHINGLE_SIZE = 5

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function shingles(text: string): string[] {
  const words = text.split(' ')
  if (words.length < SHINGLE_SIZE) return [text]
  const result: string[] = []
  for (let i = 0; i <= words.length - SHINGLE_SIZE; i++) {
    result.push(words.slice(i, i + SHINGLE_SIZE).join(' '))
  }
  return result
}

/**
 * Compute a 64-bit SimHash represented as two 32-bit integers [hi, lo].
 * Each shingle is hashed twice (with different seeds) to produce the two halves.
 */
function computeSimHash(text: string): [number, number] {
  const normalized = normalize(text)
  const shingleList = shingles(normalized)

  // 32 buckets for hi, 32 for lo
  const vHi = new Int32Array(32)
  const vLo = new Int32Array(32)

  for (const s of shingleList) {
    const hHi = fnv1a32(s)
    const hLo = fnv1a32(s + '\x00')  // different seed via suffix

    for (let bit = 0; bit < 32; bit++) {
      vHi[bit] += (hHi >>> bit) & 1 ? 1 : -1
      vLo[bit] += (hLo >>> bit) & 1 ? 1 : -1
    }
  }

  let hi = 0
  let lo = 0
  for (let bit = 0; bit < 32; bit++) {
    if (vHi[bit] > 0) hi |= 1 << bit
    if (vLo[bit] > 0) lo |= 1 << bit
  }

  return [hi >>> 0, lo >>> 0]
}

function simHashToHex(hash: [number, number]): string {
  return hash[0].toString(16).padStart(8, '0') + hash[1].toString(16).padStart(8, '0')
}

function hexToSimHash(hex: string): [number, number] {
  return [parseInt(hex.slice(0, 8), 16) >>> 0, parseInt(hex.slice(8, 16), 16) >>> 0]
}

function hammingDistance(a: [number, number], b: [number, number]): number {
  let dist = 0
  for (let i = 0; i < 2; i++) {
    let xor = (a[i] ^ b[i]) >>> 0
    while (xor) {
      dist += xor & 1
      xor >>>= 1
    }
  }
  return dist
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SessionFingerprintService {
  private readonly archivePath: string

  constructor(dataPath: string) {
    this.archivePath = path.join(dataPath, 'session-fingerprints.json')
  }

  /**
   * Check the recap text against all stored fingerprints.
   * Returns the closest match if within the given threshold, or null.
   */
  async checkFingerprint(
    recapText: string,
    threshold: number
  ): Promise<FingerprintMatch | null> {
    const hash = computeSimHash(recapText)
    const archive = await this.loadArchive()

    let bestMatch: FingerprintMatch | null = null

    for (const fp of archive) {
      const stored = hexToSimHash(fp.simhash)
      const dist = hammingDistance(hash, stored)
      if (dist <= threshold && (bestMatch === null || dist < bestMatch.distance)) {
        bestMatch = { fingerprint: fp, distance: dist }
      }
    }

    return bestMatch
  }

  /**
   * Record a new fingerprint after successful extraction.
   */
  async recordFingerprint(sessione: string, recapText: string): Promise<void> {
    const hash = computeSimHash(recapText)
    const archive = await this.loadArchive()

    const entry: SessionFingerprint = {
      sessione,
      date: new Date().toISOString().slice(0, 10),
      simhash: simHashToHex(hash),
      preview: recapText.replace(/\s+/g, ' ').trim().slice(0, 120)
    }

    archive.push(entry)
    await this.saveArchive(archive)
  }

  private async loadArchive(): Promise<SessionFingerprint[]> {
    try {
      const raw = await fs.readFile(this.archivePath, 'utf-8')
      return JSON.parse(raw) as SessionFingerprint[]
    } catch {
      return []
    }
  }

  private async saveArchive(archive: SessionFingerprint[]): Promise<void> {
    await fs.mkdir(path.dirname(this.archivePath), { recursive: true })
    await fs.writeFile(this.archivePath, JSON.stringify(archive, null, 2), 'utf-8')
  }
}
