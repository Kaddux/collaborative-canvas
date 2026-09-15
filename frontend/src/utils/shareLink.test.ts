import { describe, expect, it } from 'vitest';
import { buildShareLink, getCanvasIdFromUrl } from './shareLink';

describe('buildShareLink', () => {
  it('keeps origin/path and drops other params and the hash', () => {
    expect(buildShareLink('abc-123', 'https://example.com/app?foo=bar#frag')).toBe(
      'https://example.com/app?canvas=abc-123',
    );
  });

  it('url-encodes the canvas id', () => {
    expect(buildShareLink('a b/c', 'https://example.com/')).toBe(
      'https://example.com/?canvas=a+b%2Fc',
    );
  });
});

describe('getCanvasIdFromUrl', () => {
  it('reads and trims the canvas id', () => {
    expect(getCanvasIdFromUrl('?canvas=abc-123')).toBe('abc-123');
    expect(getCanvasIdFromUrl('?canvas=%20abc%20')).toBe('abc');
  });

  it('returns null when absent or blank', () => {
    expect(getCanvasIdFromUrl('')).toBeNull();
    expect(getCanvasIdFromUrl('?other=1')).toBeNull();
    expect(getCanvasIdFromUrl('?canvas=')).toBeNull();
    expect(getCanvasIdFromUrl('?canvas=%20%20')).toBeNull();
  });
});
