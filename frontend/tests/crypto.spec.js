import { describe, it, expect } from 'vitest';
import { generateWebhookToken } from '../assets/utils/crypto.js';

describe('crypto.js utility', () => {
    it('generates a 64-character hex string by default (32 bytes)', () => {
        const token = generateWebhookToken();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64);
        expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('generates a hex string with custom byte length', () => {
        const token = generateWebhookToken(16);
        expect(token.length).toBe(32);
        expect(/^[0-9a-f]{32}$/.test(token)).toBe(true);
    });

    it('generates unique tokens across multiple calls', () => {
        const token1 = generateWebhookToken();
        const token2 = generateWebhookToken();
        expect(token1).not.toBe(token2);
    });
});
