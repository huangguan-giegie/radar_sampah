// What the pins on the map look like.
//
// WHY THIS FILE IS STRINGS AND NOT REACT. Leaflet's divIcon takes an HTML
// string. It is not a React root, so a component cannot be mounted into it,
// which is why the styles here are inline text rather than JSX. It looks out
// of place next to the rest of the codebase, and this is the reason.
//
// Everything drawn here comes from the BeachSummary that was passed in. No
// local lookup tables of beach data - a pin can never disagree with the card
// that opens when you tap it.
import type { BeachSummary, MapLayer, SpeciesGlyph } from '../types';
import { attentionStateFor, SEVERITY } from '../theme';

// The font stack, written out once. These strings live outside React and
// outside our stylesheet, so nothing else would give them our typeface.
const F = "font-family:-apple-system,'Helvetica Neue',sans-serif";

// The line drawings, as raw SVG path data. Drawn by hand rather than pulled
// from an icon library: six shapes is not worth a dependency, and every extra
// package is another licence to check for a university project.
const GLYPH_D: Record<SpeciesGlyph, string> = {
  turtle:
    '<ellipse cx="12" cy="12" rx="6.2" ry="4.8"/><circle cx="19.4" cy="12" r="1.7"/><path d="M8 8.2 6 6.4M16 8.2 18 6.4M8 15.8 6 17.6M16 15.8 18 17.6"/><path d="M12 7.2v9.6M8.4 10h7.2M8.4 14h7.2"/>',
  bird: '<path d="M3 13.5Q7.5 7.5 12 13.5M12 13.5Q16.5 7.5 21 13.5"/>',
  mangrove:
    '<path d="M12 4.5v8M12 12.5c0 3.5-3.5 3-4.6 6.5M12 12.5c0 3.5 3.5 3 4.6 6.5M12 15.5c0 2-1.6 2-2.2 3.5M12 15.5c0 2 1.6 2 2.2 3.5"/><circle cx="12" cy="5.5" r="3.2"/>',
  grass: '<path d="M8 19c0-6-1.5-8-3-10M12 19c0-8 .5-10 2-13M16 19c0-6 1.8-7 3.4-9"/>',
  crab: '<path d="M4.5 13a7.5 5.8 0 0 1 15 0l-1.4 3.5H5.9Z"/><path d="M12 16.5v4M9 7.5l-1.6-2M15 7.5l1.6-2"/>',
  fish:
    '<ellipse cx="10.5" cy="12" rx="6" ry="3.6"/><path d="M16.5 12l4-3v6Z"/><circle cx="7.8" cy="11.2" r=".6"/>',
};

function glyphSvg(g: SpeciesGlyph, color: string, size: number) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${
    // Falls back to the bird if the backend ever sends a glyph name we do not
    // know. An unknown species must not produce an empty pin nobody can tap.
    GLYPH_D[g] ?? GLYPH_D.bird
  }</svg>`;
}

/**
 * Build the HTML for one pin.
 *
 * The two layers get genuinely different pins, not the same pin in another
 * colour: a severity pill with bars for litter, a round species badge for
 * biodiversity. Someone glancing at the map should be able to tell which layer
 * they are on without reading the switch at the top.
 *
 * offset moves the drawing a few pixels, and nothing else. Two south-coast
 * beaches sit so close together that at phone width their pins cover each
 * other. The marker stays on its real coordinate; only the picture shifts.
 */
export function markerHtml(
  b: BeachSummary,
  selected: boolean,
  layer: MapLayer,
  primaryGlyph: SpeciesGlyph,
  offset: [number, number] = [0, 0],
): string {
  // One shared helper decides whether this beach may show a band at all, and
  // what to say when it may not. The beach page asks the same function, so a
  // beach can never read "LOW" on the map and "Insufficient data" on its own
  // page. null on the biodiversity layer, because that layer makes no claim
  // about litter.
  const attention = layer === 'litter'
    ? attentionStateFor(b.severity, b.insufficientData, b.validReports)
    : null;
  // The pin is a div, so role and tabindex are what make it reachable by
  // keyboard and announced as a button. aria-label carries the severity word
  // as well as the name: a screen reader user gets no colour and no bars, so
  // the name alone would throw away the point of the map. MapScreen sets the
  // same three attributes on the outer element Leaflet builds around this one
  // - keep the wording here identical to that one.
  const wrap = (inner: string) =>
    `<div role="button" tabindex="0" aria-label="${b.name} · ${
      attention ? attention.markerLabel : b.habitatTag
    }" style="${F};transform:translate(calc(-50% + ${offset[0]}px),calc(-50% + ${offset[1]}px));position:absolute;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;outline:none;${
      selected ? 'animation:popIn .25s ease;z-index:600' : ''
    }">${inner}</div>`;

  if (layer === 'litter') {
    // Grey unless the beach has earned a band. hasBand is checked before
    // SEVERITY is read, so a beach with too few reports cannot borrow a
    // severity colour from a b.severity value it is not allowed to show.
    const sv = attention?.hasBand && b.severity ? SEVERITY[b.severity] : null;
    const col = sv ? sv.col : '#98A4B5';
    // Four bars, filled up to the band. The reading is shown as a shape as
    // well as a colour, so the difference between Low and Very high survives
    // for a colour-blind user and in a black and white printout. Without a
    // band every bar stays empty, which is why hasBand is tested again here.
    let bars = '<span style="display:flex;gap:2px;align-items:flex-end">';
    for (let i = 0; i < 4; i++) {
      const on = attention?.hasBand && b.band !== null && i < b.band;
      bars += `<i style="display:block;width:3px;height:${5 + i * 3}px;border-radius:2px;background:${
        on ? col : 'rgba(30,36,44,.18)'
      }"></i>`;
    }
    bars += '</span>';
    // The wording comes from the helper, never from the raw band: the pin says
    // "VERY HIGH" where the data says 'Severe'. "NO DATA" is spelled out in
    // words, because a pin with empty bars and no label reads as a Low rating
    // rather than as an absence of evidence.
    const label = attention?.markerLabel ?? 'NO DATA';
    const pill =
      `<div style="display:flex;align-items:center;gap:6px;background:${
        selected ? '#0B2161' : 'rgba(255,255,255,.95)'
      };color:${selected ? '#F7F8FA' : '#1E2421'};padding:${
        selected ? '9px 13px' : '7px 11px'
      };border-radius:999px;border:1.5px solid ${
        selected ? '#B8FF36' : b.insufficientData ? 'rgba(30,36,44,.25)' : 'rgba(11,33,97,.1)'
      };box-shadow:0 10px 22px -8px rgba(14,30,64,.5);${
        // A dashed border is the third signal for "not enough evidence",
        // alongside the empty bars and the NO DATA label.
        b.insufficientData ? 'border-style:dashed;' : ''
      }">${bars}<b style="font-size:10.5px;font-weight:750;letter-spacing:.09em;${
        b.insufficientData ? `color:${selected ? '#CBD3E0' : '#5A6474'}` : ''
      }">${label}</b></div>` +
      // The name sits under every litter pin, selected or not, so the map can
      // be read without tapping each pin in turn to find out which beach it is.
      `<div style="background:rgba(11,33,97,.88);color:#F7F8FA;font-size:10px;font-weight:600;padding:4px 10px;border-radius:9px">${b.name}</div>`;
    return wrap(pill);
  }

  const size = selected ? 46 : 40;
  return wrap(
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,.94);border:1.5px solid ${
      selected ? '#B8FF36' : 'rgba(11,33,97,.12)'
    };display:flex;align-items:center;justify-content:center;box-shadow:0 10px 22px -8px rgba(14,30,64,.5)">${glyphSvg(
      primaryGlyph,
      '#0B2161',
      selected ? 22 : 19,
    )}</div><div style="background:rgba(11,33,97,${
      selected ? '.88' : '.72'
    });color:#F7F8FA;font-size:9px;font-weight:650;letter-spacing:.08em;padding:3px 8px;border-radius:8px">${
      b.habitatTag
    }</div>`,
  );
}

/** The single location dot on the two small maps in the report flow. It is a
 *  constant, not a function - it is the same everywhere it appears. */
export const MINI_PIN_HTML =
  '<div style="transform:translate(-50%,-50%);position:absolute"><div style="width:34px;height:34px;border-radius:50%;background:rgba(184,255,54,.25);display:flex;align-items:center;justify-content:center"><div style="width:14px;height:14px;border-radius:50%;background:#0B2161;border:2.5px solid #B8FF36;box-shadow:0 4px 10px rgba(14,30,64,.5)"></div></div></div>';
