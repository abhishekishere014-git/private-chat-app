# NEXUS

> "Private conversations. Nothing unnecessary."

NEXUS is a minimal, temporary, private real-time communication platform with client-side authenticated end-to-end encryption (E2E). Built around Cloudflare Workers, Durable Objects, WebSockets, and the browser Web Crypto API.

---

## 1. Project Overview

NEXUS allows two people to create an ephemeral room, securely negotiate symmetric encryption keys directly in their browsers, exchange authenticated ciphertext over a zero-knowledge WebSocket relay, and leave without leaving residual server-side traces.

### Core Philosophy
* **Private**: All message contents are encrypted before touching the network.
* **Temporary**: Rooms expire automatically after 15 minutes of inactivity.
* **Minimal**: No user accounts, passwords, profile photos, contact lists, or social graphs.
* **Secure by Design**: Web Crypto API standard primitives; no proprietary or custom cryptography.
* **Zero-Knowledge Relay**: Server routes opaque ciphertext payloads without holding private keys.

---

## 2. Architecture & Directory Structure

```
nexus/
├── src/
│   ├── client/
│   │   ├── components/
│   │   │   ├── Header.tsx           # Room status, online count, actions
│   │   │   ├── ChatArea.tsx         # Message timeline & encrypted bubbles
│   │   │   ├── MessageInput.tsx     # Auto-resizing input with keyboard shortcuts
│   │   │   ├── RoomInspector.tsx    # Technical transparency drawer & fingerprint
│   │   │   ├── SecurityModal.tsx    # Honest cryptographic explanation
│   │   │   └── AboutModal.tsx       # System overview & stack
│   │   └── pages/
│   │       ├── LandingPage.tsx      # Restrained entry point
│   │       ├── CreateRoomPage.tsx   # Cryptographic code generation & waiting room
│   │       ├── JoinRoomPage.tsx     # Code input, sanitization, & verification
│   │       └── ChatRoomPage.tsx     # Primary secure real-time session
│   ├── crypto/
│   │   ├── e2e.ts                   # Web Crypto API ECDH, HKDF, AES-256-GCM engine
│   │   └── types.ts                 # Cryptographic payload schemas
│   ├── hooks/
│   │   ├── useCryptoSession.ts      # Local keypair & AES-GCM state management
│   │   ├── useRoomSocket.ts         # WebSocket lifecycle & frame dispatcher
│   │   └── useAutoResizeTextarea.ts # Expanding input hook
│   ├── services/
│   │   └── api.ts                   # REST client for room initialization & verification
│   ├── types/
│   │   └── protocol.ts              # Strongly-typed client/server message schemas
│   └── utils/
│       ├── room-code.ts             # Cryptographically secure random room code generator
│       └── format.ts                # Timestamps, clipboard helpers, time formatting
├── worker/
│   ├── index.ts                     # Cloudflare Worker entry point & edge routing
│   ├── room-do.ts                   # Cloudflare RoomDurableObject (Zero-knowledge relay)
│   ├── types.ts                     # Worker environment types
│   ├── validation.ts                # Zero-trust server-side validation
│   └── rate-limit.ts                # Sliding-window rate limiters
├── server/
│   ├── relay.ts                     # Standalone/Dev zero-knowledge relay engine
│   └── dev-plugin.ts                # Vite dev server WebSocket bridge
├── tests/
│   ├── crypto.test.ts               # Key agreement, derivation, tampering tests
│   ├── room-code.test.ts            # Entropy, charset, and ambiguous character tests
│   ├── validation.test.ts           # Server validation unit tests
│   └── rate-limit.test.ts           # Window rate limiting tests
├── server.ts                        # Standalone Node.js Express production server
├── wrangler.jsonc                   # Cloudflare Workers & Durable Objects config
└── package.json
```

---

## 3. End-to-End Cryptography Flow

NEXUS uses the standardized **W3C Web Crypto API** available natively in modern web browsers:

```
Participant A (Browser)                                Participant B (Browser)
      │                                                      │
      │ 1. generateKeyPair() (ECDH P-256)                    │ 1. generateKeyPair() (ECDH P-256)
      │ 2. exportPublicKey() (JWK)                           │ 2. exportPublicKey() (JWK)
      │                                                      │
      ├────────── send JWK via WebSocket Relay ─────────────>│
      │<───────── send JWK via WebSocket Relay ──────────────┤
      │                                                      │
      │ 3. deriveSharedSecret(privA, pubB)                   │ 3. deriveSharedSecret(privB, pubA)
      │    HKDF-SHA-256 (Context: "NEXUS-E2E-v1-AES-GCM-256")│    HKDF-SHA-256 (Same Context)
      │    Key: 256-bit AES-GCM                              │    Key: 256-bit AES-GCM
      │                                                      │
      │ 4. encryptMessage(AES-GCM, fresh 96-bit IV)          │
      ├────────── send {ciphertext, iv} relay ──────────────>│
      │                                                      │ 5. decryptMessage(AES-GCM, iv)
      │                                                      │    -> Verified Plaintext
```

1. **Ephemeral Keypair**: Each client generates a non-extractable ECDH P-256 keypair upon entering the room.
2. **Key Agreement**: Public keys are exchanged in standard JWK format across the WebSocket relay.
3. **Key Derivation (HKDF)**: Both peers compute the ECDH shared bits and pass them through HKDF-SHA-256 with explicit domain separation string `"NEXUS-E2E-v1-AES-GCM-256"`.
4. **Authenticated Encryption (AES-256-GCM)**: Every outgoing message is encrypted with AES-256-GCM using a freshly generated, cryptographically secure 96-bit (12-byte) IV (`crypto.getRandomValues`).
5. **No IV Reuse**: Each message has a unique IV. If ciphertext or IV is tampered with in transit, AES-GCM authentication tag verification fails and the frame is rejected safely.

---

## 4. Threat Model & Privacy Limitations

We believe in honest, technically defensible security claims.

### What NEXUS Protects
* **Message Confidentiality**: Plaintext messages exist only in client browser memory.
* **Message Integrity & Authenticity**: AES-GCM authenticated tags detect and reject any tampered or modified ciphertext.
* **Zero Server Knowledge of Content**: Cloudflare Workers, Durable Objects, and Node relays never see or log plaintext messages or private keys.
* **No Long-Term Storage**: No databases or message history files are kept on servers.

### What NEXUS Does NOT Protect Against (Limitations)
* **Network & Infrastructure Metadata**: Cloudflare, edge routers, ISPs, and network eavesdroppers can observe network-level metadata (IP addresses, connection timestamps, message sizes, and packet timing).
* **Endpoint Compromise**: If either participant's device, browser extension, or operating system is compromised (e.g., keyloggers, screen recorders, malware), encryption cannot protect against capture at the display/input level.
* **Untrusted Peers**: Once a message is decrypted by the intended recipient, they may screenshot, copy, or retain the text.
* **Man-in-the-Middle on Initial Key Exchange**: Ephemeral ECDH exchange without pre-authenticated public key infrastructure (PKI) protects against passive eavesdropping. To verify active interception resistance, users can compare the **Session Fingerprint** displayed in the Room Inspector drawer.

---

## 5. Room Lifecycle & Capacity

* **Maximum Capacity**: Exactly 2 participants per room. Any third connection is rejected with `"Room is full"`.
* **Inactivity Timeout**: Rooms automatically expire after 15 minutes of inactivity (no messages, joins, or typing).
* **Teardown**: Upon expiration, all open WebSockets receive a `room-expired` notification, sockets are closed with code `4000`, and all in-memory and Durable Object storage state is destroyed.

---

## 6. Local Development & Running

### Prerequisites
* Node.js v20+
* npm

### Install Dependencies
```bash
npm install
```

### Run Local Development Server
Starts the Vite dev server with integrated zero-knowledge WebSocket relay on port 3000:
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### Run Production Node Server
```bash
npm run build
npm run start
```

---

## 7. Testing

The suite uses **Vitest** for rigorous, automated verification of crypto, room codes, validation, and rate limiting:

```bash
npm run test
```

### Test Coverage
* `tests/crypto.test.ts`: ECDH P-256 keypair generation, JWK export/import, shared secret derivation, AES-GCM encryption/decryption, tampered ciphertext rejection, wrong-key rejection.
* `tests/room-code.test.ts`: Cryptographically secure generation, 6-character length, character set validation, exclusion of ambiguous characters (0, O, 1, I, L), and entropy collision tests.
* `tests/validation.test.ts`: Username sanitization, message payload schema validation, clock drift limits, public key verification.
* `tests/rate-limit.test.ts`: Sliding-window rate limiting for room creation, join attempts, message flooding, and window resets.

---

## 8. Cloudflare Deployment

NEXUS is designed for native Cloudflare edge deployment with Durable Objects.

### Cloudflare Prerequisites
* Cloudflare account with Workers Paid (required for Durable Objects)
* Wrangler CLI installed

### Deploy to Cloudflare Workers
```bash
# 1. Build frontend assets
npm run build

# 2. Deploy to Cloudflare Workers with Durable Objects
npx wrangler deploy
```

Configuration is specified in `wrangler.jsonc`.

---

## 9. License

MIT License. Designed with zero unnecessary clutter.
