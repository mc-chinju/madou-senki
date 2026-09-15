/** Minimal software authenticator (ES256, "none" attestation) for Worker passkey tests. */

type Cbor = number | string | Uint8Array | Map<number | string, Cbor>;

function head(major: number, length: number): number[] {
  if (length < 24) return [(major << 5) | length];
  if (length < 256) return [(major << 5) | 24, length];
  return [(major << 5) | 25, length >> 8, length & 0xff];
}
function cbor(value: Cbor): Uint8Array {
  if (typeof value === 'number') return new Uint8Array(value >= 0 ? head(0, value) : head(1, -1 - value));
  if (typeof value === 'string') { const bytes = new TextEncoder().encode(value); return concat(new Uint8Array(head(3, bytes.length)), bytes); }
  if (value instanceof Uint8Array) return concat(new Uint8Array(head(2, value.length)), value);
  return concat(new Uint8Array(head(5, value.size)), ...[...value].flatMap(([key, item]) => [cbor(key), cbor(item)]));
}
function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const fromBase64url = (text: string) => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), character => character.charCodeAt(0));
const sha256 = async (bytes: Uint8Array<ArrayBuffer>) => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
const uint32 = (value: number) => new Uint8Array([value >>> 24, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]);

/** WebCrypto returns r||s; WebAuthn ES256 signatures are DER sequences. */
function der(raw: Uint8Array): Uint8Array {
  const integer = (bytes: Uint8Array) => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    const trimmed = bytes.slice(start);
    const body = trimmed[0]! & 0x80 ? concat(new Uint8Array([0]), trimmed) : trimmed;
    return concat(new Uint8Array([0x02, body.length]), body);
  };
  const body = concat(integer(raw.slice(0, 32)), integer(raw.slice(32)));
  return concat(new Uint8Array([0x30, body.length]), body);
}

export class SoftwareAuthenticator {
  private counter = 0;
  private constructor(private readonly rpId: string, private readonly origin: string, private readonly keys: CryptoKeyPair, readonly credentialId: Uint8Array) {}

  static async create(origin: string) {
    const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    return new SoftwareAuthenticator(new URL(origin).hostname, origin, keys, crypto.getRandomValues(new Uint8Array(16)));
  }

  private clientData(type: 'webauthn.create' | 'webauthn.get', challenge: string) {
    return new TextEncoder().encode(JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false }));
  }

  async register(challenge: string) {
    const jwk = await crypto.subtle.exportKey('jwk', this.keys.publicKey);
    const coseKey = cbor(new Map<number, Cbor>([[1, 2], [3, -7], [-1, 1], [-2, fromBase64url(jwk.x!)], [-3, fromBase64url(jwk.y!)]]));
    const credential = concat(new Uint8Array(16), new Uint8Array([this.credentialId.length >> 8, this.credentialId.length & 0xff]), this.credentialId, coseKey);
    // Flags: user present, user verified, attested credential data.
    const authData = concat(await sha256(new TextEncoder().encode(this.rpId)), new Uint8Array([0x45]), uint32(this.counter), credential);
    const attestationObject = cbor(new Map<string, Cbor>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
    const id = base64url(this.credentialId);
    return { id, rawId: id, type: 'public-key', authenticatorAttachment: 'platform', clientExtensionResults: {},
      response: { clientDataJSON: base64url(this.clientData('webauthn.create', challenge)), attestationObject: base64url(attestationObject), transports: ['internal'] } };
  }

  async authenticate(challenge: string) {
    this.counter += 1;
    const authenticatorData = concat(await sha256(new TextEncoder().encode(this.rpId)), new Uint8Array([0x05]), uint32(this.counter));
    const clientDataJSON = this.clientData('webauthn.get', challenge);
    const signed = concat(authenticatorData, await sha256(clientDataJSON));
    const signature = der(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, this.keys.privateKey, signed)));
    const id = base64url(this.credentialId);
    return { id, rawId: id, type: 'public-key', authenticatorAttachment: 'platform', clientExtensionResults: {},
      response: { clientDataJSON: base64url(clientDataJSON), authenticatorData: base64url(authenticatorData), signature: base64url(signature) } };
  }
}
