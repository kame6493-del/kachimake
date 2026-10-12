import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('表示の配色', () => {
  it('明るい・暗いはそのまま、端末に合わせるは端末の設定で決まる', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
