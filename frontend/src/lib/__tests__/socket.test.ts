import { useToastStore } from '../../store/toast.store';

const emitMock = jest.fn();
const timeoutMock = jest.fn(() => ({ emit: emitMock }));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    timeout: timeoutMock,
    connected: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  })),
}));

import { emitReliable } from '../socket';

describe('emitReliable', () => {
  beforeEach(() => {
    emitMock.mockClear();
    timeoutMock.mockClear();
    useToastStore.setState({ message: null, lastShownAt: 0 });
  });

  it('emits through a timeout()-wrapped ack', () => {
    emitReliable('send_message', { content: 'hi' });
    expect(timeoutMock).toHaveBeenCalledWith(8000);
    expect(emitMock).toHaveBeenCalledWith('send_message', { content: 'hi' }, expect.any(Function));
  });

  it('shows no toast when the ack succeeds', () => {
    emitReliable('send_message', { content: 'hi' });
    const ack = emitMock.mock.calls[0][2];
    ack(null);
    expect(useToastStore.getState().message).toBeNull();
  });

  it('shows a toast when the ack times out and no prior error fired', () => {
    emitReliable('send_message', { content: 'hi' });
    const ack = emitMock.mock.calls[0][2];
    ack(new Error('operation has timed out'));
    expect(useToastStore.getState().message).toMatch(/may not have gone through/i);
  });

  it('does not double-toast when the gateway already emitted an explicit error', () => {
    emitReliable('add_reaction', { messageId: '1', emoji: '👍' });
    const ack = emitMock.mock.calls[0][2];

    // Simulates the gateway's WsExceptionFilter rejecting the action — the
    // 'error' listener in useSocket already showed a specific toast for this.
    useToastStore.getState().show('Rate limit exceeded');

    ack(new Error('operation has timed out'));
    expect(useToastStore.getState().message).toBe('Rate limit exceeded');
  });
});
