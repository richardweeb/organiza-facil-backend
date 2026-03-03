import { z } from "zod";

export const idSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().positive()]),
});

export const revokeRoleSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().positive()]),
  force: z.boolean().optional(),
});

export const preferredChannelSchema = z.object({
  preferredChannel: z.enum(["telegram", "whatsapp"]),
});

export const roleSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().positive()]),
  role: z.enum(["admin", "moderador", "membro"]),
  force: z.boolean().optional(),
});

export const planSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().positive()]),
  plan: z.enum(["free", "vip"]),
  force: z.boolean().optional(),
});

export const banSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().positive()]),
  duration: z.string().min(1).optional(),
  reason: z.string().max(500).optional(),
});

export const bannedQuerySchema = z.object({
  activeOnly: z.union([z.literal("0"), z.literal("1")]).optional(),
});
