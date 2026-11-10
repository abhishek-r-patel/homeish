// Shared, client-safe society status values for validation and display.
import { z } from 'zod';

export const societyStatusSchema = z.enum([
  'trial',
  'active',
  'suspended',
  'archived',
]);

export type DeveloperSocietyStatus = z.infer<typeof societyStatusSchema>;
