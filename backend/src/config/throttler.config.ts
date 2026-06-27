import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = [{ ttl: 60000, limit: 100 }];
