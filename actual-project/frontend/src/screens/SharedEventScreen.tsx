import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createIteration2ShareLink } from '../api';
import { EmptyState } from '../components/ds';
import { BackButton } from '../components/ui';

/** Preserve old event bookmarks without substituting an unrelated beach report. */
export default function SharedEventScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setError(false);
    createIteration2ShareLink({ eventId })
      .then((link) => { if (active) nav(link.path, { replace: true }); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [eventId, nav]);
  return (
    <div className="screen scroll-y"><div className="measure i2-page">
      <BackButton onClick={() => nav('/community')} />
      {error ? <EmptyState title="Shared activity not found" body="This activity is no longer available." /> : <div role="status">Opening shared activity...</div>}
    </div></div>
  );
}
