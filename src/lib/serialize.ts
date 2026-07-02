/** Convert a Mongo lean doc to a client-safe object: _id -> id, strip internals. */
export function serializeDoc<T = Record<string, unknown>>(doc: Record<string, unknown>): T {
  const { _id, __v, passwordHash, createdAt, updatedAt, ...rest } = doc as Record<string, unknown> & {
    _id: unknown;
  };
  void __v;
  void passwordHash;
  return {
    id: String(_id),
    ...rest,
    createdAt: createdAt ? new Date(createdAt as string).toISOString() : "",
    updatedAt: updatedAt ? new Date(updatedAt as string).toISOString() : "",
  } as T;
}

export function serializeList<T = Record<string, unknown>>(docs: Record<string, unknown>[]): T[] {
  return docs.map((d) => serializeDoc<T>(d));
}
