import { describe, expect, it } from 'vitest';
import { authFailureAction } from './authPolicy';

describe('authentication sync policy', () => {
  it('preserves a session after a server error', () => {
    expect(authFailureAction({ status: 500 })).toBe('preserve');
  });

  it('preserves a session after a network error', () => {
    expect(authFailureAction(new Error('Could not reach the server'))).toBe('preserve');
  });

  it('signs out only for an unauthorized response', () => {
    expect(authFailureAction({ status: 401 })).toBe('sign-out');
  });
});
