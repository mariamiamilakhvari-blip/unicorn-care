import { z } from 'zod';

export const PortalLinkRequestSchema = z.object({
  email: z.string().email(),
});

export type PortalLinkRequestType = z.infer<typeof PortalLinkRequestSchema>;
