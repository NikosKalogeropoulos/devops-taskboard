import { describe, expect, it } from 'vitest';

describe('CI failure verification', () => {
  it('fails intentionally', () => {
    expect(true).toBe(false);
  });
});
