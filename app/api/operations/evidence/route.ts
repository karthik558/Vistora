import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { withWorkspace, text } from "../../../../lib/platform/http";
import {
  workspaceDb,
  workspaceUser,
  checked,
  PlatformError,
} from "../../../../lib/platform/db";
import { uuid } from "../../../../lib/omniops/validation";
export const POST = withWorkspace(async (request: NextRequest) => {
  const user = workspaceUser(),
    db = workspaceDb();
  if (!user.isOrganizationAdmin)
    throw new PlatformError("Supervisor access required.", 403);
  if (Number(request.headers.get("content-length")) > 5500000)
    throw new PlatformError("Photos must be under 5 MB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PlatformError("Choose a photo to upload.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 5500000) {
      await reader.cancel();
      throw new PlatformError("Photos must be under 5 MB.", 413);
    }
    chunks.push(part.value);
  }
  const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData(),
    file = form.get("photo"),
    pid = uuid(form.get("property_id"), "Property"),
    label = text(form.get("check_label"), "Failed check", 200);
  checked(
    await db.rpc("ops_assert_property", {
      pid,
      dept: null,
      write_access: true,
    }),
  );
  if (!(file instanceof File) || file.size > 5242880 || file.size < 12)
    throw new PlatformError("Choose a JPEG, PNG or WebP photo under 5 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type =
    bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          ? "image/webp"
          : null;
  if (!type || type !== file.type)
    throw new PlatformError("The photo format could not be verified.");
  const path = `${user.organizationId}/${pid}/${user.id}/${randomUUID()}.${type.split("/")[1]}`;
  checked(
    await db.storage
      .from("operations-evidence")
      .upload(path, bytes, { contentType: type, upsert: false }),
  );
  try {
    const result = checked(
      await db.rpc("omniops_command", {
        p_action: "evidence",
        p_data: { property_id: pid, object_path: path, check_label: label },
        p_request_id: randomUUID(),
      }),
    );
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    await db.storage.from("operations-evidence").remove([path]);
    throw error;
  }
});
export const GET = withWorkspace(async (request: NextRequest) => {
  const db = workspaceDb(),
    row = checked(
      await db
        .from("inspection_evidence")
        .select("object_path")
        .eq("id", uuid(request.nextUrl.searchParams.get("id")))
        .single(),
    );
  const data = checked(
    await db.storage
      .from("operations-evidence")
      .createSignedUrl(row.object_path, 60),
  );
  return NextResponse.json(
    { url: data.signedUrl },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
