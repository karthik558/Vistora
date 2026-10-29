import { text } from "../platform/http";
import { PlatformError } from "../platform/db";
export function uuid(value: unknown, name = "Identifier") {
  const id = text(value, name, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new PlatformError(`Invalid ${name.toLowerCase()}.`);
  return id;
}
