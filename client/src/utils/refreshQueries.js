/** Refresh observed queries without restarting requests already in flight. */
export function refreshQueries(client, families) {
  return client.invalidateQueries({
    predicate: (query) => families.includes(query.queryKey[0]),
    refetchType: 'active',
  }, { cancelRefetch: false });
}
