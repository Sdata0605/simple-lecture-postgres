// Splits a long id list into chunks so a PostgREST `in.(...)` filter never produces a URL longer than the
// proxy's request-line limit (Apache rejects requests over ~8 KB with 414 and no CORS headers).
// Use it wherever a query filters with .in(column, ids) on a list that can grow with user data.
export const IN_CHUNK_SIZE = 50;

export async function inBatches<T, V>(
  values: readonly V[],
  run: (chunk: V[]) => PromiseLike<T[] | null | undefined>,
  chunkSize: number = IN_CHUNK_SIZE,
): Promise<T[]> {
  const unique = Array.from(new Set(values.filter((v) => v !== null && v !== undefined && v !== "")));
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    const rows = await run(unique.slice(i, i + chunkSize));
    if (rows && rows.length) out.push(...rows);
  }
  return out;
}
