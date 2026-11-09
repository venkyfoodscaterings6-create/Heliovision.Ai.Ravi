/**
 * Optional local passphrase protection for saved provider keys.
 * AES-GCM with PBKDF2-SHA-256; keys never leave the browser.
 */
const ITERATIONS = 210_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, encoder.encode(plaintext));
  return `hv1.${toBase64(salt)}.${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptText(payload: string, passphrase: string): Promise<string> {
  const [version, salt, iv, ciphertext] = payload.split(".");
  if (version !== "hv1" || !salt || !iv || !ciphertext) throw new Error("Unrecognised encrypted payload");
  const key = await deriveKey(passphrase, fromBase64(salt));
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) as BufferSource }, key, fromBase64(ciphertext) as BufferSource);
  return decoder.decode(plaintext);
}

export function createVerifier(passphrase: string): Promise<string> {
  return encryptText("heliovision-verifier", passphrase);
}

export async function verifyPassphrase(verifier: string, passphrase: string): Promise<boolean> {
  try {
    return (await decryptText(verifier, passphrase)) === "heliovision-verifier";
  } catch {
    return false;
  }
}
