export async function fetchExplorerJson<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL ?? "/";
  const url = `${base.replace(/\/$/, "")}/data/${path}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
