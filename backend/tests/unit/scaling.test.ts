import { describe, expect, it } from 'vitest';
import {
  childScaleFactor,
  rootScaleFactor,
  roundQuantity,
  scaleIngredientQuantity,
} from '../../src/domain/scaling';
import { toBaseUnit } from '../../src/domain/units';

describe('rootScaleFactor', () => {
  it('is 1 when no target servings are requested', () => {
    expect(rootScaleFactor(4)).toBe(1);
  });

  it('scales proportionally to the target servings', () => {
    expect(rootScaleFactor(4, 8)).toBe(2);
    expect(rootScaleFactor(4, 2)).toBe(0.5);
  });

  it('rejects non-positive servings', () => {
    expect(() => rootScaleFactor(4, 0)).toThrow(RangeError);
    expect(() => rootScaleFactor(0, 4)).toThrow(RangeError);
  });
});

describe('childScaleFactor', () => {
  it('"batch" multiplies by the quantity (2 × Recipe B)', () => {
    expect(childScaleFactor(1, 2, 'batch', 4)).toBe(2);
    expect(childScaleFactor(3, 2, 'batch', 4)).toBe(6);
  });

  it('"serving" divides by the child recipe yield (8 servings of a 4-serving sauce = 2 batches)', () => {
    expect(childScaleFactor(1, 8, 'serving', 4)).toBe(2);
    expect(childScaleFactor(0.5, 8, 'serving', 4)).toBe(1);
  });

  it('applies to ingredient quantities: 500 g Tomatoes × 2 = 1000 g', () => {
    expect(scaleIngredientQuantity(500, childScaleFactor(1, 8, 'serving', 4))).toBe(1000);
  });
});

describe('roundQuantity', () => {
  it('removes floating point noise', () => {
    expect(roundQuantity(0.1 + 0.2)).toBe(0.3);
    expect(roundQuantity(1 / 3)).toBe(0.333);
  });
});

describe('toBaseUnit', () => {
  it('converts mass and volume to g / ml', () => {
    expect(toBaseUnit(1.5, 'kg')).toEqual({ quantity: 1500, unit: 'g' });
    expect(toBaseUnit(2, 'tbsp')).toEqual({ quantity: 30, unit: 'ml' });
    expect(toBaseUnit(1, 'l')).toEqual({ quantity: 1000, unit: 'ml' });
  });

  it('leaves count units untouched', () => {
    expect(toBaseUnit(3, 'piece')).toEqual({ quantity: 3, unit: 'piece' });
  });
});
