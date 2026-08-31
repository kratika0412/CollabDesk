/** Normalize a string id or a populated `{ _id }` from the API into a string id. */
export function idFromRef(ref: string | { _id: string } | null | undefined): string {
  if (ref == null) return '';
  return typeof ref === 'string' ? ref : String(ref._id);
}
