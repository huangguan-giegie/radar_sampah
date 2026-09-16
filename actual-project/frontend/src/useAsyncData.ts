import { useEffect, useState, type DependencyList } from 'react';

/** Small shared loader for screens backed by the real API or the local mock.
 * It ignores late responses after navigation so an old beach/event cannot
 * overwrite the next screen's data. */
export function useAsyncData<T>(load: () => Promise<T>, dependencies: DependencyList, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    return load()
      .then((value) => {
        setData(value);
        return value;
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'Could not load this information.');
        return undefined;
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    // Do not leave the previous beach/event visible while a route parameter
    // changes and the next request is in flight.
    setData(initial);
    setLoading(true);
    setError(null);
    load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load this information.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
    // Callers supply the exact data dependencies; including the inline loader
    // itself would restart every request after every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return { data, setData, loading, error, refresh };
}
