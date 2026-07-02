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

import { emitReliable, markGatewayErrorHandled } from '../socket';

describe('emitReliable', () => {
  beforeEach(() => {
    emitMock.mockClear();
    timeoutMock.mockClear();
    useToastStore.setState({ message: null });
  });

  it('emits through a timeout()-wrapped ack', () => {
    emitReliable('send_message', { content: 'hi' });
    expect(timeoutMock).toHaveBeenCalledWith(8000);
    expect(emitMock).toHaveBeenCalledWith('send_message', { content: 'hi' }, expect.any(Function));
    // Resolve the ack so this call doesn't linger in the module-level pending
    // map and skew the "how many emits are in flight" count for later tests.
    emitMock.mock.calls[0][2](null);
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

  it('does not double-toast when the gateway already emitted an explicit error for the only in-flight call', () => {
    emitReliable('add_reaction', { messageId: '1', emoji: '👍' });
    const ack = emitMock.mock.calls[0][2];

    // Simulates the gateway's WsExceptionFilter rejecting the action — the
    // 'error' listener in useSocket already showed a specific toast for this.
    markGatewayErrorHandled();
    useToastStore.getState().show('Rate limit exceeded');

    ack(new Error('operation has timed out'));
    expect(useToastStore.getState().message).toBe('Rate limit exceeded');
  });

  it('does not suppress an unrelated timeout when two emits are in flight and only one errors', () => {
    emitReliable('add_reaction', { messageId: '1', emoji: '👍' });
    const ackA = emitMock.mock.calls[0][2];
    emitReliable('remove_reaction', { messageId: '2', emoji: '👍' });
    const ackB = emitMock.mock.calls[1][2];

    // Gateway error arrives while two calls are pending — can't tell which one
    // it belongs to, so it must not be attributed to either.
    markGatewayErrorHandled();
    useToastStore.getState().show('Not a member');

    // A's ack resolves first (say the error was for A) — no assertion needed here,
    // it's B's outcome that matters: B genuinely timed out and must still toast.
    ackA(null);
    ackB(new Error('operation has timed out'));
    expect(useToastStore.getState().message).toMatch(/may not have gone through/i);
  });
});
