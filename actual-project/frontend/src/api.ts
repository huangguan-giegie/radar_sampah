// Reviewed API facade. The implementation remains in apiCore.ts so the
// Iteration 2 integration can stay intact while recovery authentication is
// enforced consistently in mock and real-backend modes.

export * from './apiCore';

import { restoreId as restoreIdCore } from './apiCore';
import type { AuthSession } from './types';

export async function restoreId(participantId: string, token = ''): Promise<AuthSession> {
  const recoveryToken = token.trim();
  if (!recoveryToken) {
    throw new Error('Enter your recovery token.');
  }
  return restoreIdCore(participantId, recoveryToken);
}
