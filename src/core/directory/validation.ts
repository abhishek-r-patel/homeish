// Validate directory inputs and database rows at the server boundary.
import { z } from 'zod';

const uuid = z.uuid();

export const directoryResidentSchema = z.object({
  membership_id: uuid,
  unit_id: uuid.nullable(),
  full_name: z.string().nullable(),
  unit_number: z.string().nullable(),
  phone: z.string().nullable(),
});

export const directoryVehicleSchema = z.object({
  id: uuid,
  unit_id: uuid,
  membership_id: uuid,
  vehicle_type: z.enum(['car', 'two_wheeler', 'other']),
  registration_number: z.string(),
  tag_number: z.string().nullable(),
  status: z.enum(['active', 'inactive']),
  is_verified: z.boolean(),
});

export const directoryEmergencyContactSchema = z.object({
  id: uuid,
  unit_id: uuid,
  membership_id: uuid,
  full_name: z.string(),
  relationship: z.string(),
  phone: z.string(),
});

export const directoryGuardVehicleSchema = z.object({
  vehicle_type: z.enum(['car', 'two_wheeler', 'other']),
  unit_number: z.string(),
});

export const directoryVisibilitySchema = z.object({
  name_visible: z.boolean(),
  unit_visible: z.boolean(),
  phone_visible: z.boolean(),
});

export const directoryHouseholdSchema = z.object({
  unit_id: uuid,
  membership_id: uuid,
  unit_number: z.string(),
});

export const directoryPageInputSchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(2_147_483_647).default(0),
  })
  .strict();

export function directoryPageSchema<T extends z.ZodType>(itemSchema: T) {
  return z
    .object({
      items: z.array(itemSchema),
      total: z.number().int().nonnegative(),
      limit: z.number().int().min(1).max(100),
      offset: z.number().int().nonnegative(),
    })
    .refine(
      ({ items, total, limit, offset }) =>
        items.length <= Math.min(limit, Math.max(0, total - offset)),
      { message: 'Directory page items exceed the declared bounds.' },
    );
}

export const directoryVisibilityInputSchema = z
  .object({
    nameVisible: z.boolean(),
    unitVisible: z.boolean(),
    phoneVisible: z.boolean(),
  })
  .strict();

const directoryRegistrationSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(
    z.string().regex(/^[A-Z0-9]{4,16}$/, {
      message: 'Enter a valid vehicle registration number.',
    }),
  );

export const directoryVehicleInputSchema = z
  .object({
    vehicleId: uuid.nullable(),
    unitId: uuid,
    membershipId: uuid.nullable(),
    vehicleType: z.enum(['car', 'two_wheeler', 'other']),
    registrationNumber: directoryRegistrationSchema,
    tagNumber: z
      .string()
      .trim()
      .max(40)
      .transform((value) => value || null)
      .nullable(),
    clientRequestId: uuid,
  })
  .strict();

export const directoryVehicleIdInputSchema = z
  .object({ vehicleId: uuid })
  .strict();

export const directoryVehicleVerificationInputSchema = z
  .object({ vehicleId: uuid, isVerified: z.boolean() })
  .strict();

export const directoryEmergencyContactInputSchema = z
  .object({
    contactId: uuid.nullable(),
    unitId: uuid,
    membershipId: uuid.nullable(),
    fullName: z.string().trim().min(1).max(120),
    relationship: z.string().trim().min(1).max(80),
    phone: z
      .string()
      .trim()
      .regex(/^[+]?[0-9]{10,15}$/),
    clientRequestId: uuid,
  })
  .strict();

export const directoryEmergencyContactIdInputSchema = z
  .object({ contactId: uuid })
  .strict();

export type DirectoryResident = z.infer<typeof directoryResidentSchema>;
export type DirectoryVisibility = z.infer<typeof directoryVisibilitySchema>;
export type DirectoryHousehold = z.infer<typeof directoryHouseholdSchema>;
export type DirectoryPage<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};
export type DirectoryVehicle = z.infer<typeof directoryVehicleSchema>;
export type DirectoryEmergencyContact = z.infer<
  typeof directoryEmergencyContactSchema
>;
export type DirectoryGuardVehicle = z.infer<typeof directoryGuardVehicleSchema>;
