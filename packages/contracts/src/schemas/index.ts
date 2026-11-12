import type { AIBrief } from '../types/brief';
import type { z } from 'zod';
import { AIBriefSchema } from './brief';

export * from './brief';
export * from './events';
export * from './auth';
export * from './repo';
export * from './order';
export * from './payment';
export * from './dispatch';
export * from './realtime';

// Compile-time guard: hand-written AIBrief interface and the runtime schema must stay identical.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _briefMatches: Same<z.infer<typeof AIBriefSchema>, AIBrief> = true;
void _briefMatches;
