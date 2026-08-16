import { z } from 'zod';

export const PortalLinkRequestSchema = z.object({
  email: z.string().email(),
});

export type PortalLinkRequestType = z.infer<typeof PortalLinkRequestSchema>;

/**
 * The token a patient confirms from the landing page, rather than one spent by a bare GET.
 *
 * 32 random bytes as base64url is 43 characters; the bounds are wide enough for that and narrow
 * enough that nothing else reaches the redemption service.
 */
export const PortalRedeemSchema = z.object({
  token: z.string().min(20).max(128),
});

export type PortalRedeemType = z.infer<typeof PortalRedeemSchema>;
