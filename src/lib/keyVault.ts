/**
 * Local key vault: encrypts saved provider keys with a user passphrase.
 * The ciphertext lives in localStorage; only the provider receives plaintext.
 */
import { createVerifier, decryptText, encryptText, verifyPassphrase } from "./crypto";

const VAULT_KEY = "hv_key_vault_v1";
const VERIFIER_KEY = "hv_pass_verifier_v1";

export interface KeyVault {
  version: 1;
  createdAt: number;
  keys: Record<string, string>;
}

export async function sealKeyVault(passphrase: string, providers: { id: string; apiKey: string }[]): Promise<boolean> {
  try {
    const verifier = await createVerifier(passphrase);
    const keys: Record<string, string> = {};
    for (const provider of providers) {
      if (provider.apiKey) keys[provider.id] = await encryptText(provider.apiKey, passphrase);
    }
    const vault: KeyVault = { version: 1, createdAt: Date.now(), keys };
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
    localStorage.setItem(VERIFIER_KEY, verifier);
    return true;
  } catch {
    return false;
  }
}

export function readVault(): KeyVault | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KeyVault;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export async function openKeyVault(passphrase: string): Promise<Record<string, string> | null> {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (verifier && !(await verifyPassphrase(verifier, passphrase))) return null;
  const vault = readVault();
  if (!vault) return {};
  const keys: Record<string, string> = {};
  for (const [providerId, payload] of Object.entries(vault.keys)) {
    try {
      keys[providerId] = await decryptText(payload, passphrase);
    } catch {
      return null;
    }
  }
  return keys;
}

export function hasVault(): boolean {
  return Boolean(readVault() || localStorage.getItem(VERIFIER_KEY));
}
