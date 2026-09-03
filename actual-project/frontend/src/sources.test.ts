import { describe, expect, it } from 'vitest';
import { pendingSourceLabel } from './sources';

describe('pending biodiversity source labels', () => {
  it.each([
    ['species', 'SOURCE PENDING · NOT YET FROM FISHBASE / OBIS'],
    ['habitat', 'HABITAT CONTEXT · TEAM DESCRIPTION'],
    ['group', 'GROUP CONTEXT · TEAM DESCRIPTION'],
  ] as const)('uses the correct label for %s cards', (kind, label) => {
    expect(pendingSourceLabel(kind)).toBe(label);
  });
});
