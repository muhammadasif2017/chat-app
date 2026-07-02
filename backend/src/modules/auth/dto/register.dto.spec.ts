import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto.js';

function make(data: Record<string, unknown>) {
  return plainToInstance(RegisterDto, data);
}

const VALID = { username: 'alice', email: 'alice@example.com', password: 'hunter2hunter2' };

describe('RegisterDto.password', () => {
  it('rejects password shorter than 8 characters', async () => {
    const errors = await validate(make({ ...VALID, password: 'short' }));
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('accepts password exactly 8 characters', async () => {
    const errors = await validate(make({ ...VALID, password: '12345678' }));
    expect(errors).toHaveLength(0);
  });

  it('accepts password exactly 128 characters', async () => {
    const errors = await validate(make({ ...VALID, password: 'a'.repeat(128) }));
    expect(errors).toHaveLength(0);
  });

  it('rejects password longer than 128 characters — bcrypt DoS guard', async () => {
    const errors = await validate(make({ ...VALID, password: 'a'.repeat(129) }));
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});

describe('RegisterDto.email', () => {
  it('accepts email exactly 254 characters — RFC 5321 max', async () => {
    const domain =
      'b'.repeat(62) + '.' + 'b'.repeat(62) + '.' + 'b'.repeat(62) + '.' + 'b'.repeat(60) + '.bb';
    const email = 'a@' + domain;
    expect(email).toHaveLength(254);
    const errors = await validate(make({ ...VALID, email }));
    expect(errors).toHaveLength(0);
  });

  it('rejects email longer than 254 characters', async () => {
    const domain =
      'b'.repeat(62) + '.' + 'b'.repeat(62) + '.' + 'b'.repeat(62) + '.' + 'b'.repeat(60) + '.bb';
    const email = 'aa@' + domain;
    expect(email).toHaveLength(255);
    const errors = await validate(make({ ...VALID, email }));
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects invalid email format', async () => {
    const errors = await validate(make({ ...VALID, email: 'not-an-email' }));
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});

describe('RegisterDto.username', () => {
  it('rejects username shorter than 2 characters', async () => {
    const errors = await validate(make({ ...VALID, username: 'a' }));
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('accepts username exactly 2 characters', async () => {
    const errors = await validate(make({ ...VALID, username: 'ab' }));
    expect(errors).toHaveLength(0);
  });

  it('accepts username exactly 30 characters', async () => {
    const errors = await validate(make({ ...VALID, username: 'a'.repeat(30) }));
    expect(errors).toHaveLength(0);
  });

  it('rejects username longer than 30 characters', async () => {
    const errors = await validate(make({ ...VALID, username: 'a'.repeat(31) }));
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });
});
