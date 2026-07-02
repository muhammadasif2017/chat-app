import { useToastStore } from '../toast.store';

describe('toast.store', () => {
  beforeEach(() => {
    useToastStore.setState({ message: null });
  });

  it('starts with no message', () => {
    expect(useToastStore.getState().message).toBeNull();
  });

  it('show() sets the message', () => {
    useToastStore.getState().show('Something happened');
    expect(useToastStore.getState().message).toBe('Something happened');
  });

  it('clear() resets the message', () => {
    useToastStore.getState().show('Something happened');
    useToastStore.getState().clear();
    expect(useToastStore.getState().message).toBeNull();
  });

  it('show() called again overwrites the previous message', () => {
    useToastStore.getState().show('First');
    useToastStore.getState().show('Second');
    expect(useToastStore.getState().message).toBe('Second');
  });
});
