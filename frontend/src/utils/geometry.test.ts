import { describe, expect, it } from 'vitest';
import {
  angleBetween,
  defaultFontSize,
  effectiveFontSize,
  normalizeDeg,
  scaleFontSize,
} from './geometry';

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

describe('effectiveFontSize', () => {
  it('uses the stored size when positive', () => {
    expect(effectiveFontSize(24, 'TEXT')).toBe(24);
    expect(effectiveFontSize(30, 'STICKY_NOTE')).toBe(30);
  });

  it('falls back per type for missing/legacy sizes', () => {
    expect(effectiveFontSize(0, 'TEXT')).toBe(16);
    expect(effectiveFontSize(null, 'TEXT')).toBe(16);
    expect(effectiveFontSize(0, 'STICKY_NOTE')).toBe(14);
  });
});

describe('scaleFontSize', () => {
  it('scales by the ratio and clamps', () => {
    expect(scaleFontSize(16, 2)).toBe(32);
    expect(scaleFontSize(16, 0.5)).toBe(8);
    expect(scaleFontSize(16, 0.0001)).toBe(6);
    expect(scaleFontSize(16, 1000)).toBe(200);
  });

  it('handles bad ratios', () => {
    expect(scaleFontSize(16, 0)).toBe(16);
    expect(scaleFontSize(16, NaN)).toBe(16);
  });
});

describe('defaultFontSize', () => {
  it('defaults per type', () => {
    expect(defaultFontSize('STICKY_NOTE')).toBe(14);
    expect(defaultFontSize('TEXT')).toBe(16);
    expect(defaultFontSize('RECTANGLE')).toBe(16);
  });
});
