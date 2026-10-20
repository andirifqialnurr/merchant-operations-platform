/** Query metadata only: a cursor is a position, not a lookup of another tenant's row. */
export function masterPage<T extends { id: string }>(rows: readonly T[], limit: number) {
  const items = rows.slice(0, limit);
  const hasNextPage = rows.length > limit;
  return {
    items,
    pageInfo: { hasNextPage, nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null },
  };
}
