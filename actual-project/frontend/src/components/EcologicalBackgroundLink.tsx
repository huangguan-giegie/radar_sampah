import { C } from '../theme';

export const ECOLOGICAL_BACKGROUND_URL =
  'https://ourworldindata.org/grapher/share-of-global-plastic-waste-emitted-to-the-ocean?country=PAK';

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
      Learn more
    </a>
  );
}
