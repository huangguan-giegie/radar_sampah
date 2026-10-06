import { useEffect, useRef, useState } from 'react';
import { getSpeciesDistribution, USE_MOCK } from '../api';
import { hasMapCoordinates } from '../mapGeometry';
import type { SpeciesDistributionResult } from '../types';
import { SpeciesModelCards, speciesModelError, type SpeciesModelError } from './SpeciesModelCards';

type BeachReference = { id: string; lat: number | null; lng: number | null; scene: string };
type ModelState = {
  beachId: string; lat: number; lng: number;
  result: SpeciesDistributionResult | null; loading: boolean; error: SpeciesModelError | null;
};

/** Historical marine context belongs to the displayed beach, never a stale request. */
export function NearbyMarineSpecies({ beach }: { beach: BeachReference }) {
  const requestId = useRef(0);
  const [state, setState] = useState<ModelState | null>(null);

  function load() {
    if (USE_MOCK || !hasMapCoordinates(beach)) return;
    const currentRequest = ++requestId.current;
    const reference = { beachId: beach.id, lat: beach.lat, lng: beach.lng };
    setState({ ...reference, result: null, loading: true, error: null });
    getSpeciesDistribution(beach.lat, beach.lng, { mode: 'nearby_marine', topK: 5 })
      .then(result => {
        if (currentRequest === requestId.current) setState({ ...reference, result, loading: false, error: null });
      })
      .catch(reason => {
        if (currentRequest === requestId.current) setState({ ...reference, result: null, loading: false, error: speciesModelError(reason) });
      });
  }

  useEffect(() => {
    load();
    return () => { ++requestId.current; };
  }, [beach.id, beach.lat, beach.lng]);

  if (!USE_MOCK && !hasMapCoordinates(beach)) {
    return <p className="coastal-footnote">Species information is unavailable until this beach's coordinates are verified.</p>;
  }
  const current = state?.beachId === beach.id && state.lat === beach.lat && state.lng === beach.lng ? state : null;
  return <SpeciesModelCards result={current?.result ?? null} loading={current?.loading ?? !USE_MOCK}
    error={current?.error ?? null} onRetry={load} scene={beach.scene} preview={USE_MOCK} />;
}
