import { z } from 'zod';

export const UuidSchema = z.string().uuid({ message: 'Invalid UUID identifier' });

export const CreateShipmentSchema = z.object({
  origin_city: z.string().min(2).max(100).trim(),
  destination_city: z.string().min(2).max(100).trim(),
  delivery_address: z.string().min(5).max(300).trim(),
  notes: z.string().max(1000).default('').transform((val) => val.trim()),
});

export const UpdateShipmentStatusSchema = z.object({
  status: z.enum(['assigned', 'picked_up', 'in_transit', 'delivered'], {
    errorMap: () => ({ message: 'Invalid status value' }),
  }),
  location: z.string().min(2).max(100).trim(),
  notes: z.string().max(1000).optional().default(''),
});

export const AssignDriverSchema = z.object({
  driver_id: UuidSchema,
});

export const PublicTrackingQuerySchema = z.object({
  token: z.string().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/, {
    message: 'Invalid tracking token format',
  }),
});

export const ShipmentIdParamSchema = z.object({
  id: UuidSchema,
});
