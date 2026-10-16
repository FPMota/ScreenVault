export type TmdbResult = {
  id: number;
  mediaType: 'series' | 'movie';
  title: string;
  posterPath?: string;
  overview?: string;
};

const token = process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN;
const baseUrl = 'https://api.themoviedb.org/3';

export const isTmdbConfigured = Boolean(token);

export async function searchCatalog(query: string): Promise<TmdbResult[]> {
  if (!token || !query.trim()) return [];
  const response = await fetch(`${baseUrl}/search/multi?query=${encodeURIComponent(query)}&language=pt-PT` , {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Não foi possível pesquisar o catálogo.');
  const data = await response.json();
  return data.results
    .filter((item: { media_type: string }) => item.media_type === 'tv' || item.media_type === 'movie')
    .map((item: { id: number; media_type: 'tv' | 'movie'; name?: string; title?: string; poster_path?: string | null; overview?: string }) => ({
      id: item.id,
      mediaType: item.media_type === 'tv' ? 'series' : 'movie',
      title: item.name ?? item.title ?? 'Sem título',
      posterPath: item.poster_path ?? undefined,
      overview: item.overview,
    }));
}

export function posterUrl(path?: string) {
  return path ? `https://image.tmdb.org/t/p/w342${path}` : undefined;
}
