import { z } from 'zod';

export const ProductSchema = z.object({
  code: z.string(),
  description: z.string().max(30),
  expirationDate: z.date(),
  quantity: z.number().int().positive(),
  photoUri: z.string().optional(),
  isFavorite: z.boolean().default(false),
  isSold: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date().optional()
});

export type Product = z.infer<typeof ProductSchema>;

export interface ProductFilters {
  search?: string;
  startDate?: Date;
  endDate?: Date;
  showFavorites?: boolean;
} 