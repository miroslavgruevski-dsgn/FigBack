import { prisma } from "@/lib/db";

export async function getFigmaToken(projectId?: string): Promise<string> {
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { figmaAccessToken: true },
    });
    if (project?.figmaAccessToken) return project.figmaAccessToken;
  }

  const config = await prisma.teamConfig.findUnique({
    where: { id: "default" },
    select: { figmaAccessToken: true },
  });
  if (config?.figmaAccessToken) return config.figmaAccessToken;

  return process.env.FIGMA_ACCESS_TOKEN || "";
}
