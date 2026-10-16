export type TmdbResult = {
  id: number;
  mediaType: 'series' | 'movie';
  title: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  totalEpisodes?: number;
};

export type TmdbSeasonInfo = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
};

export type TmdbEpisodeInfo = {
  episodeNumber: number;
  name: string;
  overview?: string;
};

const token = process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN;
const baseUrl = 'https://api.themoviedb.org/3';

export const isTmdbConfigured = Boolean(token);

export async function searchCatalog(query: string, lang = 'en-US'): Promise<TmdbResult[]> {
  if (!token) throw new Error('TMDB API key not configured. Add EXPO_PUBLIC_TMDB_ACCESS_TOKEN to your .env file.');
  if (!query.trim()) return [];

  const response = await fetch(
    `${baseUrl}/search/multi?query=${encodeURIComponent(query)}&language=${lang}&include_adult=false`,
    {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`TMDB error ${response.status}: ${body || response.statusText}`);
  }

  const data = await response.json();

  return (data.results as Array<{
    id: number;
    media_type: string;
    name?: string;
    title?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    overview?: string;
  }>)
    .filter((item) => item.media_type === 'tv' || item.media_type === 'movie')
    .map((item) => ({
      id: item.id,
      mediaType: item.media_type === 'tv' ? 'series' : 'movie',
      title: item.name ?? item.title ?? 'Untitled',
      posterPath: item.poster_path ?? undefined,
      backdropPath: item.backdrop_path ?? undefined,
      overview: item.overview,
    }));
}

export async function fetchItemDetails(
  id: number,
  mediaType: 'series' | 'movie',
  lang = 'en-US'
): Promise<{
  totalEpisodes: number;
  overview?: string;
  backdropPath?: string;
  posterPath?: string;
  seasons: TmdbSeasonInfo[];
}> {
  if (!token) {
    return {
      totalEpisodes: mediaType === 'movie' ? 1 : 0,
      seasons: [],
    };
  }

  const endpoint = mediaType === 'series'
    ? `${baseUrl}/tv/${id}?language=${lang}`
    : `${baseUrl}/movie/${id}?language=${lang}`;

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    if (!response.ok) return { totalEpisodes: mediaType === 'movie' ? 1 : 0, seasons: [] };
    const data = await response.json();

    const seasons: TmdbSeasonInfo[] = (data.seasons || [])
      .filter((s: { season_number: number }) => s.season_number > 0)
      .map((s: { season_number: number; name: string; episode_count: number }) => ({
        seasonNumber: s.season_number,
        name: s.name || `Season ${s.season_number}`,
        episodeCount: s.episode_count,
      }));

    return {
      totalEpisodes: mediaType === 'movie' ? 1 : (data.number_of_episodes ?? 0),
      overview: data.overview || undefined,
      backdropPath: data.backdrop_path || undefined,
      posterPath: data.poster_path || undefined,
      seasons,
    };
  } catch {
    return { totalEpisodes: mediaType === 'movie' ? 1 : 0, seasons: [] };
  }
}

export async function fetchSeasonEpisodes(
  tvId: number,
  seasonNumber: number,
  lang = 'en-US'
): Promise<TmdbEpisodeInfo[]> {
  if (!token) return [];
  try {
    const response = await fetch(`${baseUrl}/tv/${tvId}/season/${seasonNumber}?language=${lang}`, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.episodes || []).map((ep: { episode_number: number; name: string; overview?: string }) => ({
      episodeNumber: ep.episode_number,
      name: ep.name || `Episode ${ep.episode_number}`,
      overview: ep.overview,
    }));
  } catch {
    return [];
  }
}

export function posterUrl(path?: string, size = 'w342'): string | undefined {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
}
