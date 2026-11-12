/** Cloud Run service name: lowercase letters, digits and hyphens, starts with a letter, max 49 chars, no trailing hyphen. */
export const serviceName = (orderId: string) =>
  `gc-${orderId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`.slice(0, 49).replace(/-+$/, '');
