/**
 * Typed store errors.
 *
 * Drizzle wraps driver errors, so the SQLite detail ("UNIQUE constraint
 * failed: ...") sits on `error.cause`, not on `error.message`. Code that
 * sniffed the message for "UNIQUE" silently stopped working when the query
 * builder was introduced — a duplicate email started answering 500 instead of
 * 409. Repositories translate constraint failures here so no caller has to
 * inspect a driver message again.
 */

/** Walk the cause chain; the driver error is not always the top one. */
function messages(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current instanceof Error) parts.push(current.message);
    current = (current as { cause?: unknown })?.cause;
  }
  return parts.join(" | ");
}

export function isUniqueViolation(error: unknown): boolean {
  return /UNIQUE constraint failed/i.test(messages(error));
}

/** A row already exists with this value. `field` is the column that clashed. */
export class DuplicateError extends Error {
  readonly field: string | null;

  constructor(field: string | null, cause?: unknown) {
    super(
      field ? `A record already exists with that ${field}` : "Already exists",
    );
    this.name = "DuplicateError";
    this.field = field;
    this.cause = cause;
  }
}

/** The column named in a UNIQUE violation, e.g. "api_keys.email" -> "email". */
export function violatedField(error: unknown): string | null {
  const match = messages(error).match(/UNIQUE constraint failed: \S+\.(\w+)/i);
  return match ? match[1] : null;
}
