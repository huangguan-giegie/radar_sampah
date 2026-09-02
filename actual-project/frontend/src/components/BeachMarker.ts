

import type { BeachSummary, MapLayer, SpeciesGlyph } from '../types';
import { attentionStateFor, SEVERITY } from '../theme';

const F = "font-family:-apple-system,'Helvetica Neue',sans-serif";

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
    GLYPH_D[g] ?? GLYPH_D.bird
  }</svg>`;
}


export function markerHtml(
  b: BeachSummary,
  selected: boolean,
  layer: MapLayer,
  primaryGlyph: SpeciesGlyph,
  offset: [number, number] = [0, 0],
  // Zoomed far out the four beaches sit within a few dozen pixels of each
  // other and the full pills overlap into an unreadable stack. The dot keeps
  // every beach visible and tappable; the label comes back on zoom in.
  compact = false,
): string {
  const attention = layer === 'litter'
    ? attentionStateFor(b.severity, b.insufficientData, b.validReports)
    : null;
  const wrap = (inner: string) =>
    `<div role="button" tabindex="0" aria-label="${b.name} · ${
      attention ? attention.markerLabel : b.habitatTag
    }" style="${F};transform:translate(calc(-50% + ${offset[0]}px),calc(-50% + ${offset[1]}px));position:absolute;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;outline:none;${
      selected ? 'animation:popIn .25s ease;z-index:600' : ''
    }">${inner}</div>`;

  if (compact) {
    const dot = attention && attention.hasBand && b.severity ? SEVERITY[b.severity].col : '#98A4B5';
    return wrap(
      `<div style="width:${selected ? 18 : 13}px;height:${selected ? 18 : 13}px;border-radius:50%;background:${dot};border:2px solid ${
        selected ? '#B8FF36' : '#FFFFFF'
      };box-shadow:0 4px 10px rgba(14,30,64,.45)"></div>`,
    );
  }

  if (layer === 'litter') {
    const sv = attention?.hasBand && b.severity ? SEVERITY[b.severity] : null;
    const col = sv ? sv.col : '#98A4B5';
    let bars = '<span style="display:flex;gap:2px;align-items:flex-end">';
    for (let i = 0; i < 4; i++) {
      const on = attention?.hasBand && b.band !== null && i < b.band;
      bars += `<i style="display:block;width:3px;height:${5 + i * 3}px;border-radius:2px;background:${
        on ? col : 'rgba(30,36,44,.18)'
      }"></i>`;
    }
    bars += '</span>';
    const label = attention?.markerLabel ?? 'NO DATA';
    const pill =
      `<div style="display:flex;align-items:center;gap:6px;background:${
        selected ? '#0B2161' : 'rgba(255,255,255,.95)'
      };color:${selected ? '#F7F8FA' : '#1E2421'};padding:${
        selected ? '9px 13px' : '7px 11px'
      };border-radius:999px;border:1.5px solid ${
        selected ? '#B8FF36' : b.insufficientData ? 'rgba(30,36,44,.25)' : 'rgba(11,33,97,.1)'
      };box-shadow:0 10px 22px -8px rgba(14,30,64,.5);${
        b.insufficientData ? 'border-style:dashed;' : ''
      }">${bars}<b style="font-size:10.5px;font-weight:750;letter-spacing:.09em;${
        b.insufficientData ? `color:${selected ? '#CBD3E0' : '#5A6474'}` : ''
      }">${label}</b></div>` +
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


export const MINI_PIN_HTML =
  '<div style="transform:translate(-50%,-50%);position:absolute"><div style="width:34px;height:34px;border-radius:50%;background:rgba(184,255,54,.25);display:flex;align-items:center;justify-content:center"><div style="width:14px;height:14px;border-radius:50%;background:#0B2161;border:2.5px solid #B8FF36;box-shadow:0 4px 10px rgba(14,30,64,.5)"></div></div></div>';
