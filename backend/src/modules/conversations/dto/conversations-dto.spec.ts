import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateMemberRoleDto } from './update-member-role.dto';
import { AddMemberDto } from './add-member.dto';
import { UpdateGroupDto } from './update-group.dto';
import { CreateConversationDto } from './create-conversation.dto';

describe('UpdateMemberRoleDto', () => {
  const make = (role: unknown) =>
    plainToInstance(UpdateMemberRoleDto, { role });

  it('accepts ADMIN', async () => {
    const errors = await validate(make('ADMIN'));
    expect(errors).toHaveLength(0);
  });

  it('accepts MEMBER', async () => {
    const errors = await validate(make('MEMBER'));
    expect(errors).toHaveLength(0);
  });

  it('rejects OWNER — privilege escalation guard', async () => {
    const errors = await validate(make('OWNER'));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('role');
  });

  it('rejects arbitrary string', async () => {
    const errors = await validate(make('superadmin'));
    expect(errors).toHaveLength(1);
  });

  it('rejects missing role', async () => {
    const errors = await validate(make(undefined));
    expect(errors).toHaveLength(1);
  });
});

describe('AddMemberDto', () => {
  const make = (userId: unknown) =>
    plainToInstance(AddMemberDto, { userId });

  it('accepts a valid v4 UUID', async () => {
    const errors = await validate(make('550e8400-e29b-41d4-a716-446655440000'));
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID string', async () => {
    const errors = await validate(make('not-a-uuid'));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('userId');
  });

  it('rejects empty string', async () => {
    const errors = await validate(make(''));
    expect(errors).toHaveLength(1);
  });

  it('rejects missing userId', async () => {
    const errors = await validate(make(undefined));
    expect(errors).toHaveLength(1);
  });
});

describe('UpdateGroupDto', () => {
  const make = (body: Record<string, unknown>) =>
    plainToInstance(UpdateGroupDto, body);

  it('accepts valid name and description', async () => {
    const errors = await validate(make({ name: 'Team Alpha', description: 'Our team' }));
    expect(errors).toHaveLength(0);
  });

  it('accepts empty body (both fields optional)', async () => {
    const errors = await validate(make({}));
    expect(errors).toHaveLength(0);
  });

  it('rejects name longer than 100 chars', async () => {
    const errors = await validate(make({ name: 'x'.repeat(101) }));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
  });

  it('rejects description longer than 500 chars', async () => {
    const errors = await validate(make({ description: 'x'.repeat(501) }));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('description');
  });

  it('rejects empty-string name (minLength 1)', async () => {
    const errors = await validate(make({ name: '' }));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
  });
});

describe('CreateConversationDto — memberIds', () => {
  const make = (body: Record<string, unknown>) =>
    plainToInstance(CreateConversationDto, body);

  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts a GROUP with valid memberIds', async () => {
    const errors = await validate(make({ type: 'GROUP', name: 'Test', memberIds: [validUuid] }));
    expect(errors).toHaveLength(0);
  });

  it('accepts a GROUP with no memberIds', async () => {
    const errors = await validate(make({ type: 'GROUP', name: 'Test' }));
    expect(errors).toHaveLength(0);
  });

  it('rejects memberIds containing a non-UUID', async () => {
    const errors = await validate(make({ type: 'GROUP', name: 'Test', memberIds: ['bad-id'] }));
    expect(errors.some((e) => e.property === 'memberIds')).toBe(true);
  });

  it('rejects memberIds with more than 49 entries', async () => {
    const ids = Array.from({ length: 50 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
    );
    const errors = await validate(make({ type: 'GROUP', name: 'Test', memberIds: ids }));
    expect(errors.some((e) => e.property === 'memberIds')).toBe(true);
  });

  it('rejects description longer than 500 chars', async () => {
    const errors = await validate(
      make({ type: 'GROUP', name: 'Test', description: 'x'.repeat(501) }),
    );
    expect(errors.some((e) => e.property === 'description')).toBe(true);
  });
});
