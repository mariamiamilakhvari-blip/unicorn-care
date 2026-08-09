import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export type LoginType = z.infer<typeof LoginSchema>;

export const SignUpSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export type SignUpType = z.infer<typeof SignUpSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export type ForgotPasswordType = z.infer<typeof ForgotPasswordSchema>;

/**
 * What the reset endpoint accepts. 32 random bytes as base64url is 43 characters; the bound is
 * generous on both sides so a token format change does not silently start 400-ing.
 */
export const ResetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(100),
});

export type ResetPasswordType = z.infer<typeof ResetPasswordSchema>;

/**
 * The form the user actually fills in. The confirmation field never leaves the browser — it exists
 * to catch a typo in a password nobody can see, and the API has no use for it.
 */
export const ResetPasswordFormSchema = z
  .object({
    password: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
  })
  .refine(values => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'PASSWORD_MISMATCH',
  });

export type ResetPasswordFormType = z.infer<typeof ResetPasswordFormSchema>;
