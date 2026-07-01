import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SendMessageDto } from './send-message.dto';

const CONV_ID = 'b6b4c3e2-1234-4567-8901-abcdef012345';

describe('SendMessageDto', () => {
  const make = (data: Record<string, unknown>) => plainToInstance(SendMessageDto, data);

  it('accepts a non-empty TEXT message', async () => {
    const errors = await validate(make({ conversationId: CONV_ID, content: 'hi' }));
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty TEXT message', async () => {
    const errors = await validate(make({ conversationId: CONV_ID, content: '' }));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('content');
  });

  it('rejects a missing content for TEXT', async () => {
    const errors = await validate(make({ conversationId: CONV_ID }));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('content');
  });
});
