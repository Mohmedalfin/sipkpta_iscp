/** Adaptasi respons daftar legacy tanpa kehilangan metadata server. */
export function readListResponse(response) {
  const { data, meta } = response.data;
  return { items: data, pagination: meta?.pagination, summary: meta?.summary };
}
