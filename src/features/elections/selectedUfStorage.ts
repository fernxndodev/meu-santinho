import {
  brazilianStates,
  type BrazilianUf,
} from './electionConfig'

const STORAGE_KEY = 'meu-santinho:selected-uf:2026'

const validUfs = new Set<string>(
  brazilianStates.map((state) => state.uf),
)

export function saveSelectedUf(uf: BrazilianUf): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, uf)
    return true
  } catch {
    return false
  }
}

export function loadSelectedUf(): BrazilianUf | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    if (!stored || !validUfs.has(stored)) {
      return null
    }

    return stored as BrazilianUf
  } catch {
    return null
  }
}

export function removeSelectedUf(): boolean {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
