import { C } from '../theme';
import { OWID_MALAYSIA_URL } from '../oceanPlastic';

// The one "Learn more" link out to the ocean-plastic source, used on every
// beach page. It opens the Our World in Data chart with Malaysia highlighted,
// because Malaysia is the country this app is about. (An earlier copy pointed
// at Pakistan; that came from a stale prototype frame, not a decision.)
export const ECOLOGICAL_BACKGROUND_URL = OWID_MALAYSIA_URL;

export function EcologicalBackgroundLink() {
  return (
    <a
      href={ECOLOGICAL_BACKGROUND_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        marginTop: 10,
        color: C.navy,
        fontSize: 12,
        fontWeight: 700,
        textDecoration: 'underline',
        textUnderlineOffset: 3,
      }}
    >
      Learn more ↗
    </a>
  );
}
