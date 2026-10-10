import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapMarineSelection } from './components/MapMarineSelection';
import { beachMarineCards } from './beachMarineLife';

let view: ReactTestRenderer;
afterEach(() => { if (view) act(() => view.unmount()); });
const props = () => ({
  beachName: 'Pantai Morib', rating: 'Severe', color: '#c20e19', lightText: true,
  position: { x: 160, y: 180, diameter: 284 }, cards: beachMarineCards('morib'),
  loading: false, error: false,
  onBeach: vi.fn(), onSpecies: vi.fn(), onClose: vi.fn(), onMore: vi.fn(), onRetry: vi.fn(),
});

describe('expanded map beach', () => {
  it('gives the core and species separate destinations without hover', () => {
    const callbacks = props();
    act(() => { view = create(<MapMarineSelection {...callbacks} />); });
    act(() => view.root.findByProps({ 'aria-label': 'Open Pantai Morib beach details' }).props.onClick());
    expect(callbacks.onBeach).toHaveBeenCalledOnce();
    expect(callbacks.onSpecies).not.toHaveBeenCalled();
    const card = callbacks.cards[0];
    act(() => view.root.findByProps({ 'aria-label': `Open ${card.name} guide · published reference` }).props.onClick());
    expect(callbacks.onSpecies).toHaveBeenCalledWith(card);
    expect(card.destination).toContain('?beach=morib');
    act(() => view.root.findByProps({ 'aria-label': 'Close nearby marine life' }).props.onClick());
    expect(callbacks.onClose).toHaveBeenCalledOnce();
  });

  it('offers the overflow list and keeps model evidence visible', () => {
    const callbacks = props();
    const cards = Array.from({ length: 40 }, (_, i) => ({ ...callbacks.cards[0], id: String(i), name: `Species ${i}`, modelled: true, published: false }));
    act(() => { view = create(<MapMarineSelection {...callbacks} cards={cards} />); });
    const speciesButtons = view.root.findAllByType('button').filter(button => button.props['aria-label']?.startsWith('Open Species'));
    expect(speciesButtons).toHaveLength(5);
    act(() => view.root.findByProps({ 'aria-label': 'Show 35 more species' }).props.onClick());
    expect(callbacks.onMore).toHaveBeenCalledOnce();
    expect(JSON.stringify(view.toJSON())).toContain('OBIS modelled context');
    expect(JSON.stringify(view.toJSON())).toContain('not sightings');
  });

  it('keeps beach details usable with no species and exposes failed-load retry', () => {
    const callbacks = props();
    act(() => { view = create(<MapMarineSelection {...callbacks} cards={[]} />); });
    expect(JSON.stringify(view.toJSON())).toContain('No species information available');
    act(() => view.root.findByProps({ 'aria-label': 'Open Pantai Morib beach details' }).props.onClick());
    expect(callbacks.onBeach).toHaveBeenCalledOnce();
    act(() => view.update(<MapMarineSelection {...callbacks} cards={[]} error />));
    act(() => view.root.findAllByType('button').find(button => button.children.includes('Retry'))!.props.onClick());
    expect(callbacks.onRetry).toHaveBeenCalledOnce();
    act(() => view.root.findByType('section').props.onKeyDown({ key: 'Escape' }));
    expect(callbacks.onClose).toHaveBeenCalledOnce();
  });
});
