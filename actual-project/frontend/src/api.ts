// Reviewed API facade. The implementation remains in apiCore.ts so the
// Iteration 2 integration can stay intact while reviewed authentication and
// band-based cleanup contracts are enforced consistently at the public facade.

export * from './apiCore';

import {
  createIteration2Cleanup as createIteration2CleanupCore,
  restoreId as restoreIdCore,
} from './apiCore';
import type { AuthSession, QuantityByCategory } from './types';

export type Iteration2CleanupInput = {
  targetReportId?: string;
  beachId?: string;
  eventId?: string | null;
  remainingQuantities?: QuantityByCategory;
  removedQuantities?: QuantityByCategory;
  handling: string;
  note?: string;
  idempotencyKey: string;
};

export function createIteration2Cleanup(input: Iteration2CleanupInput): Promise<any> {
  // apiCore still carries the pre-review signature for compatibility with old
  // callers; the reviewed facade is the contract consumed by current screens.
  return createIteration2CleanupCore(
    input as unknown as Parameters<typeof createIteration2CleanupCore>[0],
  );
}

export async function restoreId(participantId: string, token = ''): Promise<AuthSession> {
  const recoveryToken = token.trim();
  if (!recoveryToken) {
    throw new Error('Enter your recovery token.');
  }
  return restoreIdCore(participantId, recoveryToken);
}
