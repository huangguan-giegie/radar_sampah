export type AuthFailureAction = 'sign-out' | 'preserve';

/** Only an explicit 401 means that the stored session is no longer valid. */
export function authFailureAction(error: unknown): AuthFailureAction {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (status === 401) return 'sign-out';
  }
  return 'preserve';
}
