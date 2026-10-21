import { buildYearWorkbook } from "@/features/export/xlsx";
import { getSessionUser } from "@/server/auth/session";
import { forUser } from "@/server/db/scoped";

/** Unduh workbook Excel satu tahun milik user yang sedang login (userId dari sesi). */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const tahun = new URL(request.url).searchParams.get("tahun") ?? "";
  if (!/^\d{4}$/.test(tahun) || Number(tahun) < 2000 || Number(tahun) > 2100) {
    return new Response("Parameter tahun tidak valid", { status: 400 });
  }
  const buf = await buildYearWorkbook({ userId: user.id, db: forUser(user.id) }, Number(tahun));
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Catatku-${tahun}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
