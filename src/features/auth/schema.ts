import { z } from 'zod';

/**
 * Login input validation (Engineering Standards §1/§3: validate with Zod on
 * both client and server). Password rules are enforced by Supabase Auth at
 * account creation; here we only require a non-empty value.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
