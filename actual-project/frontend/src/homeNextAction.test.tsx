import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeachSummary } from './types';

const state = vi.hoisted(() => ({
  navigate: vi.fn(), resetDraft: vi.fn(), patchDraft: vi.fn(), getBeaches: vi.fn(),
}));
vi.mock('react-router-dom', async original => ({
  ...await original<typeof import('react-router-dom')>(), useNavigate: () => state.navigate,
}));
vi.mock('./api', () => ({ USE_MOCK: false, getBeaches: state.getBeaches, getBeach: vi.fn() }));
vi.mock('./iteration3Api', () => ({ iteration3Request: vi.fn() }));
vi.mock('./AppContext', () => ({ useApp: () => ({
  user: { participantId: '2027' }, draft: { beachId: 'morib', quantities: {} }, reportsVersion: 0,
  resetDraft: state.resetDraft, patchDraft: state.patchDraft, setLastSavedReport: vi.fn(),
}) }));
vi.mock('./useAsyncData', () => ({ useAsyncData: (load: unknown, dependencies: unknown[]) => ({
  data: load === state.getBeaches ? [{ id: 'remis', name: 'Pantai Remis', area: 'Selangor', insufficientData: true, composition: [] } as unknown as BeachSummary]
    : dependencies[0] === '2027' ? { actionLabel: 'Submit follow-up report', reason: 'Your cleanup needs a follow-up.',
      destination: { type: 'report', beachId: 'remis', path: '/report/photo?beach=remis' } } : null,
  loading: false, error: null, refresh: vi.fn(),
}) }));

import HomeScreen from './screens/HomeScreen';

let view: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { setTimeout: vi.fn(), clearTimeout: vi.fn() });
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { if (view) act(() => view!.unmount()); view = undefined; vi.unstubAllGlobals(); });

function openRecommendation() {
  act(() => { view = create(<MemoryRouter initialEntries={['/home']}><HomeScreen /></MemoryRouter>); });
  act(() => view!.root.findByProps({ 'aria-label': 'Next Action' }).findByType('button').props.onClick());
}
function choose(label: string) {
  const button = view!.root.findAll(item => item.props.children === label && typeof item.props.onClick === 'function')[0];
  if (!button) throw new Error('Missing draft choice: ' + label);
  act(() => button.props.onClick());
}

describe('recommended reports with an existing draft', () => {
  it('waits for the draft choice and preserves the recommended beach when starting a new report', () => {
    openRecommendation();
    expect(state.resetDraft).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
    choose('Discard draft & start new');
    expect(state.resetDraft).toHaveBeenCalledOnce();
    expect(state.patchDraft).toHaveBeenCalledWith({ beachId: 'remis', beachName: 'Pantai Remis', locationSource: 'manual', coords: null });
    expect(state.navigate).toHaveBeenCalledWith('/report/photo?beach=remis');
  });
  it('keeps the existing draft when the participant chooses to continue it', () => {
    openRecommendation();
    choose('Continue draft');
    expect(state.resetDraft).not.toHaveBeenCalled();
    expect(state.patchDraft).not.toHaveBeenCalled();
    expect(state.navigate).toHaveBeenCalledWith('/report/photo');
  });
});
