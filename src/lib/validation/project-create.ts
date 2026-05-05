import { z } from "zod";

export const createProjectBodySchema = z.object({
  name: z.string().min(1).max(100),
  urls: z.array(z.string().url()).min(1).max(20),
});

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
