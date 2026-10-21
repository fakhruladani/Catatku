import "server-only";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { forUser } from "./db/scoped";

/**
 * Dipanggil sekali saat user dibuat: preferensi default + SALINAN kategori default.
 * Idempoten: aman dipanggil ulang.
 */
export async function provisionNewUser(userId: string): Promise<void> {
  const db = forUser(userId);
  await db.$transaction(async (tx) => {
    const existingPref = await tx.userPreference.findUnique({ where: { userId } });
    if (!existingPref) {
      await tx.userPreference.create({ data: { userId } });
    }

    const count = await tx.category.count();
    if (count > 0) return;

    let order = 0;
    for (const c of DEFAULT_CATEGORIES) {
      const parent = await tx.category.create({
        data: {
          userId,
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
          sortOrder: order++,
        },
      });
      for (const child of c.children ?? []) {
        await tx.category.create({
          data: {
            userId,
            name: child.name,
            type: c.type,
            icon: c.icon,
            color: c.color,
            parentId: parent.id,
            sortOrder: order++,
          },
        });
      }
    }
  });
}
