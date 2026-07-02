import { useToastStore } from '../toast.store';

describe('toast.store', () => {
  beforeEach(() => {
    useToastStore.setState({ message: null, lastShownAt: 0 });
  });

  it('starts with no message', () => {
    expect(useToastStore.getState().message).toBeNull();
  });

  it('show() sets the message and records the timestamp', () => {
    const before = Date.now();
    useToastStore.getState().show('Something happened');
    const state = useToastStore.getState();
    expect(state.message).toBe('Something happened');
    expect(state.lastShownAt).toBeGreaterThanOrEqual(before);
  });

  it('clear() resets the message but keeps lastShownAt', () => {
    useToastStore.getState().show('Something happened');
    const shownAt = useToastStore.getState().lastShownAt;
    useToastStore.getState().clear();
    expect(useToastStore.getState().message).toBeNull();
    expect(useToastStore.getState().lastShownAt).toBe(shownAt);
  });

  it('show() called again overwrites the previous message', () => {
    useToastStore.getState().show('First');
    useToastStore.getState().show('Second');
    expect(useToastStore.getState().message).toBe('Second');
  });
});
