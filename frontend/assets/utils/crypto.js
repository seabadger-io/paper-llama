/**
 * Cryptographic utility functions.
 */

/**
 * Generates a cryptographically secure random hex token.
 * @param {number} byteLength - Number of bytes to generate (default 32 for 64-hex chars)
 * @returns {string} Hex-encoded random string
 */
export function generateWebhookToken(byteLength = 32) {
    const cryptoObj =
        typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues
            ? window.crypto
            : typeof crypto !== 'undefined' && crypto.getRandomValues
              ? crypto
              : null;

    if (!cryptoObj) {
        throw new Error('Web Crypto API is not available in this environment');
    }

    const bytes = new Uint8Array(byteLength);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
