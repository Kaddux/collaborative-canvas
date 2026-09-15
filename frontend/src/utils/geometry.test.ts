import { describe, expect, it } from 'vitest';
import { angleBetween, normalizeDeg } from './geometry';

describe('normalizeDeg', () => {
  it('wraps angles into [0, 360)', () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(450)).toBe(90);
    expect(normalizeDeg(-450)).toBe(270);
  });
});

describe('angleBetween', () => {
  it('computes clockwise angles in screen coordinates', () => {
    expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
    expect(angleBetween({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(90);
    expect(angleBetween({ x: 0, y: 0 }, { x: -1, y: 0 })).toBe(180);
    expect(angleBetween({ x: 0, y: 0 }, { x: 0, y: -1 })).toBe(270);
    expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(45);
  });
});
