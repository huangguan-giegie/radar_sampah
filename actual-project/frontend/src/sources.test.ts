import { describe, expect, it } from 'vitest';
import { pendingSourceLabel } from './sources';

describe('pendingSourceLabel', () => {
  it('keeps species cards as source-pending', () => {
    expect(pendingSourceLabel('species')).toBe('SOURCE PENDING · NOT YET FROM FISHBASE / OBIS');
  });

  it('labels habitat cards as team context', () => {
    expect(pendingSourceLabel('habitat')).toBe('HABITAT CONTEXT · TEAM DESCRIPTION');
  });

  it('labels group cards as team context', () => {
    expect(pendingSourceLabel('group')).toBe('GROUP CONTEXT · TEAM DESCRIPTION');
  });
});
