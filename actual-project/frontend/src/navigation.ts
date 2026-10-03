import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/** BrowserRouter starts its own history at index 0, even after an external page.
 * history.length alone would send a directly opened detail back outside the app. */
export function backNavigation(historyState: unknown, fallback: string) {
  const index = (historyState as { idx?: unknown } | null)?.idx;
  if (typeof index === "number" && Number.isInteger(index) && index > 0) {
    return { pop: true } as const;
  }
  const to = fallback.startsWith("/") && !fallback.startsWith("//")
    ? fallback
    : "/home";
  return { pop: false, to, replace: true } as const;
}

export function useAppBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    const action = backNavigation(window.history.state, fallback);
    if (action.pop) navigate(-1);
    else navigate(action.to, { replace: true });
  }, [navigate, fallback]);
}
