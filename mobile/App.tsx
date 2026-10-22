import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  fetchItemDetails,
  fetchSeasonEpisodes,
  isTmdbConfigured,
  posterUrl,
  searchCatalog,
  type TmdbEpisodeInfo,
  type TmdbResult,
  type TmdbSeasonInfo,
} from './lib/tmdb';


// ─── Types & Localization ─────────────────────────────────────────────────────

type Language = 'en' | 'pt';
type Collection = 'watching' | 'finished_airing_to_continue' | 'up_to_date';

export type Series = {
  title: string;
  collection: Collection;
  watchedEpisodes: number;
  totalEpisodes: number;
  mediaType?: 'series' | 'movie';
  tmdbId?: number;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  lastWatched?: number;
  watchedEpList?: string[]; // e.g. ["S1E1", "S1E2"] or ["MOVIE"]
};

type PersonalData = {
  watchedEpisodes?: number;
  rating?: number;
  review?: string;
  lastWatched?: number;
  watchedEpList?: string[];
};

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export type FriendProfile = {
  id: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  mutualFriendsCount?: number;
  mutualFriendName?: string;
  sampleSeries?: Series[];
};

export type Friendship = {
  id: string;
  userId: string;
  friendId: string;
  status: FriendshipStatus;
  createdAt?: string;
  friendProfile?: FriendProfile;
};

type Tab = 'home' | 'library' | 'watchlist' | 'friends' | 'profile';

const TABS: Tab[] = ['home', 'library', 'watchlist', 'friends', 'profile'];
const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const STORAGE_KEY = '@screenvault/personal-data-v1';
const LIBRARY_KEY = '@screenvault/library-v1';
const WATCHLIST_KEY = '@screenvault/watchlist-v1';
const AVATAR_KEY = '@screenvault/avatar-v1';
const BANNER_KEY = '@screenvault/banner-v1';
const LANG_KEY = '@screenvault/lang-v1';
const USERNAME_KEY = '@screenvault/username-v1';
const BIO_KEY = '@screenvault/bio-v1';
const FRIENDS_KEY = '@screenvault/friends-v1';
const LIBRARY_VIEW_KEY = '@screenvault/library_view_mode-v1';
const WATCHLIST_VIEW_KEY = '@screenvault/watchlist_view_mode-v1';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function useGridMetrics() {
  const { width } = useWindowDimensions();
  const safeWidth = width && width > 0 ? width : SCREEN_W;
  const padding = 24; // 12px on each side
  const gap = 8;
  // User requested at least 4 items per row. On larger screens, scale smoothly.
  const numColumns = Math.max(4, Math.floor((safeWidth - padding + gap) / (90 + gap)));
  const cardWidth = Math.floor((safeWidth - padding - gap * (numColumns - 1)) / numColumns);
  return { numColumns, cardWidth, gap };
}

// ─── Translations ─────────────────────────────────────────────────────────────

export const i18n = {
  en: {
    home: 'Home',
    library: 'Library',
    watchlist: 'Watchlist',
    profile: 'Profile',
    continueWatching: 'Continue Watching',
    pickUp: 'Pick up where you left off.',
    recentActivity: 'Recent Activity',
    recentActivitySub: 'Your recently watched shows.',
    searchPlaceholder: 'Search library...',
    searchCatalogPrompt: 'Search movies or series...',
    search: 'Search',
    addContent: 'Add',
    versionText: 'Version 1.4 - 22/10/2026',
    all: 'All',
    watching: 'Watching',
    finishedToContinue: 'Finished – To Continue',
    upToDate: 'Up to Date',
    episodesWatched: 'episodes watched',
    episodes: 'episodes',
    of: 'of',
    ep: 'Ep',
    emptyHome: 'No activity yet. Tap Add to discover shows and movies!',
    emptyLibrary: 'No shows found.',
    emptyWatchlist: 'Your watchlist is empty. Add titles to watch later.',
    settings: 'Settings',
    language: 'Language',
    signOut: 'Sign out',
    close: 'Close',
    cancel: 'Cancel',
    changePhoto: 'Change photo',
    dashboard: 'Dashboard',
    seriesWatched: 'Series Watched',
    episodesWatchedStat: 'Episodes Watched',
    seriesToFinish: 'Series to Finish',
    episodesToGo: 'Episodes to Go',
    onWatchlist: 'On Watchlist',
    notSignedIn: 'Not signed in',
    addToLibrary: 'Add to Library',
    addToWatchlist: 'Add to Watchlist',
    inLibrary: 'In Library',
    inWatchlist: 'In Watchlist',
    removeFromLibrary: 'Remove from Library',
    removeFromWatchlist: 'Remove from Watchlist',
    dragHint: 'Slide left for Library • right for Watchlist',
    neutralNone: 'None',
    whereToAdd: 'Where to add?',
    chooseDestination: 'Choose where you want to save this title.',
    viewAllSeries: 'All',
    season: 'Season',
    episodesTitle: 'Episodes',
    markSeriesWatched: 'Already watched whole series',
    allSeriesWatched: 'Watched whole series',
    markSeasonWatched: 'Already watched this season',
    unmarkSeasonWatched: 'Watched this season',
    watchedCount: 'watched',
    noOverview: 'No overview available for this title.',
    loadingEpisodes: 'Loading episodes...',
    seeAll: 'See all',
    movie: 'Movie',
    markAsWatched: 'Mark as Watched',
    watched: 'Watched',
    username: 'Username',
    bio: 'Bio',
    editProfile: 'Edit Profile',
    save: 'Save',
    usernamePlaceholder: 'Your username (e.g. filipe_series)',
    bioPlaceholder: 'Write a short bio about what you love watching...',
    signInTitle: 'Welcome Back',
    signInDesc: 'Access your private series and cinema vault.',
    signUpTitle: 'Join ScreenVault',
    signUpDesc: 'Start your personal diary. Private, cloud-synced, and tailored for cinema lovers.',
    signInTab: 'Sign In',
    signUpTab: 'Create Account',
    emailPlaceholder: 'Email address',
    passwordPlaceholder: 'Password',
    confirmPasswordPlaceholder: 'Confirm password',
    passwordsDontMatch: 'Passwords do not match.',
    passwordTooShort: 'Password must be at least 8 characters.',
    featurePrivate: '100% Private & Synced',
    featureCatalog: 'Movies, Series & Watchlist',
    alreadyHaveAccount: 'Already have an account? Sign in',
    needAccount: "Don't have an account? Create one",
    addBanner: 'Add Cover',
    changeBanner: 'Change Cover',
    removeBanner: 'Remove Cover',
    showMore: 'Show more',
    showLess: 'Show less',
    profileCustomization: 'Profile Customization',
    profilePhoto: 'Profile Photo',
    coverImage: 'Cover Image',
    addPhoto: 'Add photo',
    noCover: 'No cover',
    friends: 'Friends',
    myFriends: 'My Friends',
    addFriend: 'Add Friend',
    pendingRequests: 'Requests',
    searchUsers: 'Search by username...',
    noFriendsYet: 'No friends added yet. Connect with other cinema lovers!',
    noRequests: 'No pending requests.',
    sendRequest: 'Add Friend',
    requestSent: 'Request Sent',
    accept: 'Accept',
    decline: 'Decline',
    removeFriend: 'Remove',
    alreadyFriends: 'Friends',
    friendsCount: 'Friends',
    friendSearchHint: 'Search for users by username to connect and see what they are watching.',
    allUsers: 'All Users',
    noUsersFound: 'No users found.',
    findFriends: 'Find Friends',
    refresh: 'Refresh',
    loading: 'Loading...',
    viewProfile: 'View Profile',
    friendProfile: 'Profile',
    userLibrary: 'Library',
    userWatchlist: 'Watchlist',
    noWatchingSeries: 'No series currently being watched.',
    noCompletedSeries: 'No completed series yet.',
    noWatchlistItems: 'Watchlist is empty.',
    episodesWatchedCount: 'Episodes Watched',
    watchedSeriesCount: 'Series Watched',
    watchingCount: 'Watching',
    currentlyWatching: 'Watching',
    allSeries: 'All',
    suggestedFriends: 'Suggested For You',
    mutualFriendsHint: 'Based on mutual friends',
    mutualFriends: 'mutual friends',
    mutualFriend: 'mutual friend',
    friendOf: 'Friend of',
    epsCount: 'Eps',
  },
  pt: {
    home: 'Início',
    library: 'Biblioteca',
    watchlist: 'Por Ver',
    profile: 'Perfil',
    continueWatching: 'Continuar a Ver',
    pickUp: 'Continua de onde ficaste.',
    recentActivity: 'Atividade Recente',
    recentActivitySub: 'As tuas séries vistas recentemente.',
    searchPlaceholder: 'Pesquisar na biblioteca...',
    searchCatalogPrompt: 'Pesquisar filmes ou séries...',
    search: 'Pesquisar',
    addContent: 'Adicionar',
    versionText: 'Versão 1.4 - 22/10/2026',
    all: 'Todas',
    watching: 'A ver',
    finishedToContinue: 'Terminadas por ver',
    upToDate: 'Em dia',
    episodesWatched: 'episódios vistos',
    episodes: 'episódios',
    of: 'de',
    ep: 'Ep',
    emptyHome: 'Ainda sem atividade. Pesquisa no catálogo para adicionar séries e filmes!',
    emptyLibrary: 'Nenhuma série encontrada.',
    emptyWatchlist: 'A tua lista está vazia. Adiciona títulos para veres mais tarde.',
    settings: 'Definições',
    language: 'Idioma',
    signOut: 'Terminar sessão',
    close: 'Fechar',
    cancel: 'Cancelar',
    changePhoto: 'Mudar fotografia',
    dashboard: 'Estatísticas',
    seriesWatched: 'Séries Vistas',
    episodesWatchedStat: 'Episódios Vistos',
    seriesToFinish: 'Séries por Acabar',
    episodesToGo: 'Episódios em Falta',
    onWatchlist: 'Na Watchlist',
    notSignedIn: 'Sessão não iniciada',
    addToLibrary: 'Adicionar à Biblioteca',
    addToWatchlist: 'Adicionar à Watchlist',
    inLibrary: 'Na Biblioteca',
    inWatchlist: 'Na Watchlist',
    removeFromLibrary: 'Remover da Biblioteca',
    removeFromWatchlist: 'Remover da Watchlist',
    dragHint: 'Arrasta para a esquerda (Biblioteca) ou direita (Watchlist)',
    neutralNone: 'Nenhum',
    whereToAdd: 'Onde queres adicionar?',
    chooseDestination: 'Escolhe o destino para este título.',
    viewAllSeries: 'Tudo',
    season: 'Temporada',
    episodesTitle: 'Episódios',
    markSeriesWatched: 'Já vi a série toda',
    allSeriesWatched: 'Já vi a série toda',
    markSeasonWatched: 'Já vi esta temporada',
    unmarkSeasonWatched: 'Já vi esta temporada',
    watchedCount: 'vistos',
    noOverview: 'Sem sinopse disponível.',
    loadingEpisodes: 'A carregar episódios...',
    seeAll: 'Ver tudo',
    movie: 'Filme',
    markAsWatched: 'Marcar como Visto',
    watched: 'Visto',
    username: 'Nome de utilizador',
    bio: 'Biografia',
    editProfile: 'Editar Perfil',
    save: 'Guardar',
    usernamePlaceholder: 'O teu username (ex: filipe_series)',
    bioPlaceholder: 'Escreve uma pequena biografia do que gostas de ver...',
    signInTitle: 'Bem-vindo de volta',
    signInDesc: 'Acede ao teu cofre privado de séries e cinema.',
    signUpTitle: 'Cria a tua conta',
    signUpDesc: 'Começa o teu diário pessoal. Privado, sincronizado e feito para amantes de cinema.',
    signInTab: 'Iniciar Sessão',
    signUpTab: 'Criar Conta',
    emailPlaceholder: 'Endereço de email',
    passwordPlaceholder: 'Palavra-passe',
    confirmPasswordPlaceholder: 'Confirmar palavra-passe',
    passwordsDontMatch: 'As palavras-passe não coincidem.',
    passwordTooShort: 'A palavra-passe tem de ter pelo menos 8 caracteres.',
    featurePrivate: '100% Privado e Sincronizado',
    featureCatalog: 'Filmes, Séries e Watchlist',
    alreadyHaveAccount: 'Já tens conta? Iniciar sessão',
    needAccount: 'Ainda não tens conta? Criar conta',
    addBanner: 'Adicionar Capa',
    changeBanner: 'Mudar Capa',
    removeBanner: 'Remover Capa',
    showMore: 'Ver mais',
    showLess: 'Ver menos',
    profileCustomization: 'Personalização do Perfil',
    profilePhoto: 'Foto de Perfil',
    coverImage: 'Imagem de Capa',
    addPhoto: 'Adicionar foto',
    noCover: 'Sem capa',
    friends: 'Amigos',
    myFriends: 'Os Meus Amigos',
    addFriend: 'Adicionar Amigo',
    pendingRequests: 'Pedidos',
    searchUsers: 'Pesquisar por username...',
    noFriendsYet: 'Ainda não tens amigos adicionados. Conecta-te com outros amantes de cinema!',
    noRequests: 'Sem pedidos pendentes.',
    sendRequest: 'Adicionar Amigo',
    requestSent: 'Pedido Enviado',
    accept: 'Aceitar',
    decline: 'Recusar',
    removeFriend: 'Remover',
    alreadyFriends: 'Amigos',
    friendsCount: 'Amigos',
    friendSearchHint: 'Pesquisa utilizadores pelo nome de utilizador para veres o que estão a ver.',
    allUsers: 'Todos os Utilizadores',
    noUsersFound: 'Nenhum utilizador encontrado.',
    findFriends: 'Encontrar Amigos',
    refresh: 'Atualizar',
    loading: 'A carregar...',
    viewProfile: 'Ver Perfil',
    friendProfile: 'Perfil',
    userLibrary: 'Biblioteca',
    userWatchlist: 'Por Ver',
    noWatchingSeries: 'Nenhuma série a ser vista no momento.',
    noCompletedSeries: 'Ainda não concluiu nenhuma série.',
    noWatchlistItems: 'A lista por ver está vazia.',
    episodesWatchedCount: 'Episódios Vistos',
    watchedSeriesCount: 'Séries Vistas',
    watchingCount: 'A Ver',
    currentlyWatching: 'A Ver',
    allSeries: 'Todas',
    suggestedFriends: 'Sugestões para ti',
    mutualFriendsHint: 'Baseado em amigos em comum',
    mutualFriends: 'amigos em comum',
    mutualFriend: 'amigo em comum',
    friendOf: 'Amigo de',
    epsCount: 'Eps',
  },
};

// ─── Colour palette (Vintage Cinema Bordeaux) ─────────────────────────────────
const C = {
  bg: '#0C0A0D',           // Deep Noir Velvet Obsidian (luxurious, modern, clean)
  surface: '#161318',      // Sleek Charcoal Velvet Surface
  surface2: '#201A22',     // Soft Refined Contrast Surface
  bordeaux: '#9E1B32',     // Regal Burgundy Wine
  bordeauxLight: '#C72545',// Vibrant Ruby Accent
  gold: '#D4AF37',         // Clean Luxury Champagne Gold
  cream: '#F8F6F0',        // Pure Crisp Soft Off-White
  muted: '#9E9499',        // Refined Warm Silver-Taupe
  border: '#282027',       // Subtle Luxury Hairline Border
  error: '#FF6B6B',
};

// ─── Cloud Sync Helpers ───────────────────────────────────────────────────────

export function mergeLibrary(local: Series[], remote: Series[]): { merged: Series[]; localOnly: Series[] } {
  const remoteKeys = new Set(
    remote.map((s) => `${s.mediaType ?? 'series'}:${s.tmdbId ?? s.title.trim().toLowerCase()}`)
  );
  const localOnly = local.filter(
    (s) => !remoteKeys.has(`${s.mediaType ?? 'series'}:${s.tmdbId ?? s.title.trim().toLowerCase()}`)
  );
  return { merged: [...remote, ...localOnly], localOnly };
}

export function mergeWatchlist(local: TmdbResult[], remote: TmdbResult[]): { merged: TmdbResult[]; localOnly: TmdbResult[] } {
  const remoteKeys = new Set(
    remote.map((w) => `${w.mediaType ?? 'series'}:${w.id || w.title.trim().toLowerCase()}`)
  );
  const localOnly = local.filter(
    (w) => !remoteKeys.has(`${w.mediaType ?? 'series'}:${w.id || w.title.trim().toLowerCase()}`)
  );
  return { merged: [...remote, ...localOnly], localOnly };
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [lang, setLang] = useState<Language>('en');

  const [tab, setTab] = useState<Tab>('home');
  const [selected, setSelected] = useState<Series | TmdbResult | null>(null);
  const [personal, setPersonal] = useState<Record<string, PersonalData>>({});
  const [library, setLibrary] = useState<Series[]>([]);
  const [watchlist, setWatchlist] = useState<TmdbResult[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [allUsers, setAllUsers] = useState<FriendProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchAllUsers = async (targetUid?: string) => {
    const uid = targetUid || session?.user?.id;
    if (!uid) return;
    try {
      setLoadingUsers(true);
      if (supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', uid)
          .order('username', { ascending: true });

        if (!error && data) {
          const dbUsers: FriendProfile[] = data.map((p: any) => ({
            id: p.id,
            username: p.username || (p.email ? p.email.split('@')[0] : (p.full_name || `user_${p.id.slice(0, 6)}`)),
            bio: p.bio ?? undefined,
            avatarUrl: p.avatar_url ?? undefined,
            bannerUrl: p.banner_url ?? undefined,
          }));
          setAllUsers(dbUsers);
        } else if (error) {
          console.warn('Error in fetchAllUsers:', error.message || error);
        }
      }
    } catch (err) {
      console.warn('Error in fetchAllUsers:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchFriendships = async (targetUid?: string) => {
    const uid = targetUid || session?.user?.id;
    if (!supabase || !uid) return;
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${uid},friend_id.eq.${uid}`);

      if (error || !data) return;

      const otherUids = [...new Set(data.map((r: any) => (r.user_id === uid ? r.friend_id : r.user_id)))];
      const profilesMap: Record<string, FriendProfile> = {};

      if (otherUids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('*')
          .in('id', otherUids);

        if (profs) {
          profs.forEach((p: any) => {
            const rawName = p.username || (p.email ? p.email.split('@')[0] : (p.full_name || `user_${p.id.slice(0, 6)}`));
            profilesMap[p.id] = {
              id: p.id,
              username: rawName,
              bio: p.bio ?? undefined,
              avatarUrl: p.avatar_url ?? undefined,
              bannerUrl: p.banner_url ?? undefined,
            };
          });
        }
      }

      const list: Friendship[] = data.map((r: any) => {
        const otherId = r.user_id === uid ? r.friend_id : r.user_id;
        const fromMap = profilesMap[otherId];
        const fromAll = allUsers.find((u) => u.id === otherId);
        const resolvedName = fromMap?.username || fromAll?.username || `user_${otherId.slice(0, 6)}`;
        return {
          id: r.id,
          userId: r.user_id,
          friendId: r.friend_id,
          status: r.status as FriendshipStatus,
          createdAt: r.created_at,
          friendProfile: {
            id: otherId,
            username: resolvedName,
            bio: fromMap?.bio ?? fromAll?.bio,
            avatarUrl: fromMap?.avatarUrl ?? fromAll?.avatarUrl,
            bannerUrl: fromMap?.bannerUrl ?? fromAll?.bannerUrl,
          },
        };
      });

      setFriends(list);
      AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(list)).catch(() => undefined);
    } catch {
      // Graceful offline fallback
    }
  };

  const sendFriendRequest = async (targetUserId: string): Promise<{ error?: string }> => {
    if (!supabase || !session) return { error: 'Not authenticated' };
    const uid = session.user.id;
    if (uid === targetUserId) return { error: 'Cannot add yourself' };

    // Check if friendship already exists
    const existing = friends.find(
      (f) =>
        (f.userId === uid && f.friendId === targetUserId) ||
        (f.userId === targetUserId && f.friendId === uid),
    );
    if (existing) {
      if (existing.status === 'pending' && existing.userId === targetUserId) {
        await respondFriendRequest(existing.id, true);
        return {};
      }
      return { error: 'Already connected' };
    }

    // Optimistic UI update so button immediately shows "Request Sent"
    const targetProf = allUsers.find((u) => u.id === targetUserId);
    const tempId = `temp-${Date.now()}`;
    const optimisticF: Friendship = {
      id: tempId,
      userId: uid,
      friendId: targetUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      friendProfile: targetProf || { id: targetUserId, username: `user_${targetUserId.slice(0, 6)}` },
    };
    setFriends((prev) => [optimisticF, ...prev.filter((f) => f.id !== tempId)]);

    const { data, error } = await supabase.from('friendships').insert({
      user_id: uid,
      friend_id: targetUserId,
      status: 'pending',
    }).select().maybeSingle();

    if (error) {
      // Revert optimistic update
      setFriends((prev) => prev.filter((f) => f.id !== tempId));
      return { error: error.message };
    }

    if (data?.id) {
      setFriends((prev) => prev.map((f) => (f.id === tempId ? { ...f, id: data.id } : f)));
    }
    fetchFriendships(uid);
    return {};
  };

  const respondFriendRequest = async (friendshipId: string, accept: boolean) => {
    if (!supabase || !session) return;
    if (accept) {
      setFriends((prev) =>
        prev.map((f) => (f.id === friendshipId ? { ...f, status: 'accepted' as FriendshipStatus } : f))
      );
      await supabase.from('friendships').update({
        status: 'accepted',
        updated_at: new Date().toISOString(),
      }).eq('id', friendshipId);
    } else {
      setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
      await supabase.from('friendships').delete().eq('id', friendshipId);
    }
    fetchFriendships(session.user.id);
  };

  const removeFriendship = async (friendshipId: string) => {
    if (!supabase || !session) return;
    setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
    await supabase.from('friendships').delete().eq('id', friendshipId);
    fetchFriendships(session.user.id);
  };

  const searchUsersByUsername = async (q: string): Promise<FriendProfile[]> => {
    if (!supabase || !session) return [];
    const uid = session.user.id;
    const cleanQ = q.trim().replace(/^@/, '');
    let query = supabase
      .from('profiles')
      .select('*')
      .neq('id', uid);

    if (cleanQ) {
      query = query.ilike('username', `%${cleanQ}%`);
    }

    const { data } = await query.limit(20);
    if (!data) return [];
    return data.map((p: any) => ({
      id: p.id,
      username: p.username || (p.email ? p.email.split('@')[0] : (p.full_name || `user_${p.id.slice(0, 6)}`)),
      bio: p.bio ?? undefined,
      avatarUrl: p.avatar_url ?? undefined,
      bannerUrl: p.banner_url ?? undefined,
    }));
  };

  // Supabase Database Fetchers — Database is the single source of truth
  const fetchLibrary = (targetUid?: string) => {
    const uid = targetUid || session?.user?.id;
    if (!supabase || !uid) return;
    supabase
      .from('series_entries')
      .select('*')
      .eq('user_id', uid)
      .order('title')
      .then(({ data, error }) => {
        if (error) {
          console.warn('Supabase series_entries fetch notice:', error.message || error.code || String(error));
          return;
        }
        if (!data) return;
        const cl: Series[] = data.map((r) => ({
          title: r.title,
          collection: r.collection as Collection,
          watchedEpisodes: r.watched_episodes ?? 0,
          totalEpisodes: r.total_episodes ?? 0,
          mediaType: (r.media_type as 'series' | 'movie') || 'series',
          tmdbId: r.tmdb_id ?? undefined,
          posterPath: r.poster_path ?? undefined,
          lastWatched: r.last_watched ? Number(r.last_watched) : undefined,
        }));
        setLibrary(cl);
        setPersonal((cur) => {
          const next = { ...cur };
          for (const r of data) {
            const existing = cur[r.title] || {};
            let epList = existing.watchedEpList;
            let reviewText = r.review ?? undefined;

            if (r.review && typeof r.review === 'string' && r.review.startsWith('{"eps":')) {
              try {
                const parsed = JSON.parse(r.review);
                if (Array.isArray(parsed.eps) && parsed.eps.length > 0) {
                  epList = parsed.eps;
                }
                reviewText = parsed.text || undefined;
              } catch {}
            }

            if (!epList && r.media_type === 'movie' && (r.watched_episodes ?? 0) > 0) {
              epList = ['MOVIE'];
            }

            next[r.title] = {
              ...existing,
              watchedEpisodes: r.watched_episodes ?? 0,
              rating: r.rating ?? undefined,
              review: reviewText,
              lastWatched: r.last_watched ? Number(r.last_watched) : undefined,
              watchedEpList: epList,
            };
          }
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
          return next;
        });
        AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(cl)).catch(() => undefined);
      }, (err: any) => {
        console.warn('Network notice fetching series_entries:', err?.message || String(err));
      });
  };

  const fetchWatchlist = (targetUid?: string) => {
    const uid = targetUid || session?.user?.id;
    if (!supabase || !uid) return;
    supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.warn('Supabase watchlist fetch notice:', error.message || error.code || String(error));
          return;
        }
        if (!data) return;
        const items: TmdbResult[] = data.map((r) => ({
          id: Number(r.tmdb_id) || Number(r.id) || 0,
          mediaType: (r.media_type as 'series' | 'movie') || 'series',
          title: r.title,
          posterPath: r.poster_path ?? undefined,
          overview: r.overview ?? undefined,
        }));
        setWatchlist(items);
        AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(items)).catch(() => undefined);
      }, (err: any) => {
        console.warn('Network notice fetching watchlist:', err?.message || String(err));
      });
  };

  // Tab switch horizontal animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const tabOpacity = useRef(new Animated.Value(1)).current;
  const tabIndexRef = useRef(0);

  const goToTab = (next: Tab) => {
    // Re-sync with Supabase on tab switch so changes from other devices appear immediately
    if (session?.user?.id) {
      fetchLibrary(session.user.id);
      fetchWatchlist(session.user.id);
      if (next === 'friends' || next === 'profile') {
        fetchFriendships(session.user.id);
        fetchAllUsers(session.user.id);
      }
    }

    const nextIndex = TABS.indexOf(next);
    if (nextIndex === tabIndexRef.current) return;
    const direction = nextIndex > tabIndexRef.current ? 1 : -1;
    tabIndexRef.current = nextIndex;

    slideAnim.setValue(direction * 32);
    tabOpacity.setValue(0.72);
    setTab(next);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(tabOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 20 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8
          );
        },
        onPanResponderMove: (_evt, gestureState) => {
          slideAnim.setValue(gestureState.dx * 0.35);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dx < -45) {
            // Swiped left -> next tab
            const curIdx = tabIndexRef.current;
            if (curIdx < TABS.length - 1) {
              goToTab(TABS[curIdx + 1]);
              return;
            }
          } else if (gestureState.dx > 45) {
            // Swiped right -> previous tab
            const curIdx = tabIndexRef.current;
            if (curIdx > 0) {
              goToTab(TABS[curIdx - 1]);
              return;
            }
          }
          // Return smoothly to center
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
        },
      }),
    [],
  );

  // Prevent all zoom gestures on mobile web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const preventGesture = (e: Event) => e.preventDefault();
    const preventMultiTouch = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    document.addEventListener('gesturestart', preventGesture);
    document.addEventListener('gesturechange', preventGesture);
    document.addEventListener('gestureend', preventGesture);
    document.addEventListener('touchstart', preventMultiTouch, { passive: false });
    document.addEventListener('touchmove', preventMultiTouch, { passive: false });
    document.addEventListener('wheel', preventWheelZoom, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchstart', preventMultiTouch);
      document.removeEventListener('touchmove', preventMultiTouch);
      document.removeEventListener('wheel', preventWheelZoom);
    };
  }, []);

  // App Initialization:
  // 1. Reads local cache (AsyncStorage)
  // 2. Checks Supabase Auth session
  // 3. IF session exists: awaits profile (username, bio, avatar, banner), library, and watchlist
  //    BEFORE setting ready=true. This guarantees nothing disappears from the profile on app updates!
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      // 1. Read local storage cache
      let localLib: Series[] = [];
      let localWatch: TmdbResult[] = [];
      try {
        const [p, l, w, a, ban, la, un, bi, fr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(LIBRARY_KEY),
          AsyncStorage.getItem(WATCHLIST_KEY),
          AsyncStorage.getItem(AVATAR_KEY),
          AsyncStorage.getItem(BANNER_KEY),
          AsyncStorage.getItem(LANG_KEY),
          AsyncStorage.getItem(USERNAME_KEY),
          AsyncStorage.getItem(BIO_KEY),
          AsyncStorage.getItem(FRIENDS_KEY),
        ]);
        if (!isMounted) return;
        if (p) setPersonal(JSON.parse(p));
        if (l) {
          localLib = JSON.parse(l);
          setLibrary(localLib);
        }
        if (w) {
          localWatch = JSON.parse(w);
          setWatchlist(localWatch);
        }
        if (a) setAvatar(a);
        if (ban) setBanner(ban);
        if (la === 'en' || la === 'pt') setLang(la);
        if (un) setUsername(un);
        if (bi) setBio(bi);
        if (fr) {
          try { setFriends(JSON.parse(fr)); } catch {}
        }
      } catch {
        // storage fallback
      }

      // 2. Check Supabase connection & session
      if (!supabase) {
        if (isMounted) setReady(true);
        return;
      }

      try {
        const { data: authData } = await supabase.auth.getSession();
        if (!isMounted) return;
        const currentSession = authData?.session ?? null;
        setSession(currentSession);

        if (!currentSession) {
          // No user session -> ready to show SignIn
          setReady(true);
          return;
        }

        // Auto-detox: if user_metadata is contaminated with large base64 avatar/banner, strip it!
        const meta = currentSession.user.user_metadata;
        if (
          (typeof meta?.avatar_url === 'string' && meta.avatar_url.length > 500) ||
          (typeof meta?.banner_url === 'string' && meta.banner_url.length > 500)
        ) {
          try {
            await supabase.auth.updateUser({
              data: { avatar_url: null, banner_url: null },
            });
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed?.session && isMounted) {
              setSession(refreshed.session);
            }
          } catch {
            // Handled via SQL cleanup if header too large
          }
        }

        const uid = currentSession.user.id;

        // 3. User is signed in -> Pre-load Profile, Library, and Watchlist from Supabase
        await Promise.race([
          Promise.all([
            // Fetch profile
            supabase
              .from('profiles')
              .select('*')
              .eq('id', uid)
              .maybeSingle()
              .then(({ data, error }) => {
                if (!error && data && isMounted) {
                  if (data.username) {
                    setUsername(data.username);
                    AsyncStorage.setItem(USERNAME_KEY, data.username).catch(() => undefined);
                  }
                  if (data.bio) {
                    setBio(data.bio);
                    AsyncStorage.setItem(BIO_KEY, data.bio).catch(() => undefined);
                  }
                  if (data.avatar_url) {
                    setAvatar(data.avatar_url);
                    AsyncStorage.setItem(AVATAR_KEY, data.avatar_url).catch(() => undefined);
                  }
                  if ((data as any).banner_url) {
                    setBanner((data as any).banner_url);
                    AsyncStorage.setItem(BANNER_KEY, (data as any).banner_url).catch(() => undefined);
                  }
                }
              }),

            // Fetch library directly from Supabase database
            supabase
              .from('series_entries')
              .select('*')
              .eq('user_id', uid)
              .order('title')
              .then(({ data, error }) => {
                if (!error && data && isMounted) {
                  const cl: Series[] = data.map((r) => ({
                    title: r.title,
                    collection: r.collection as Collection,
                    watchedEpisodes: r.watched_episodes ?? 0,
                    totalEpisodes: r.total_episodes ?? 0,
                    mediaType: (r.media_type as 'series' | 'movie') || 'series',
                    tmdbId: r.tmdb_id ?? undefined,
                    posterPath: r.poster_path ?? undefined,
                    lastWatched: r.last_watched ? Number(r.last_watched) : undefined,
                  }));
                  setLibrary(cl);
                  setPersonal((cur) => {
                    const next = { ...cur };
                    for (const r of data) {
                      const existing = cur[r.title] || {};
                      let epList = existing.watchedEpList;
                      let reviewText = r.review ?? undefined;

                      if (r.review && typeof r.review === 'string' && r.review.startsWith('{"eps":')) {
                        try {
                          const parsed = JSON.parse(r.review);
                          if (Array.isArray(parsed.eps) && parsed.eps.length > 0) {
                            epList = parsed.eps;
                          }
                          reviewText = parsed.text || undefined;
                        } catch {}
                      }

                      if (!epList && r.media_type === 'movie' && (r.watched_episodes ?? 0) > 0) {
                        epList = ['MOVIE'];
                      }

                      next[r.title] = {
                        ...existing,
                        watchedEpisodes: r.watched_episodes ?? 0,
                        rating: r.rating ?? undefined,
                        review: reviewText,
                        lastWatched: r.last_watched ? Number(r.last_watched) : undefined,
                        watchedEpList: epList,
                      };
                    }
                    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
                    return next;
                  });
                  AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(cl)).catch(() => undefined);
                }
              }),

            // Fetch watchlist directly from Supabase database
            supabase
              .from('watchlist')
              .select('*')
              .eq('user_id', uid)
              .order('created_at', { ascending: false })
              .then(({ data, error }) => {
                if (!error && data && isMounted) {
                  const items: TmdbResult[] = data.map((r) => ({
                    id: Number(r.tmdb_id) || Number(r.id) || 0,
                    mediaType: (r.media_type as 'series' | 'movie') || 'series',
                    title: r.title,
                    posterPath: r.poster_path ?? undefined,
                    overview: r.overview ?? undefined,
                  }));

                  setWatchlist(items);
                  AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(items)).catch(() => undefined);
                }
              }),
          ]),
          new Promise((resolve) => setTimeout(resolve, 3000)), // 3s network safety timeout
        ]);
      } catch {
        // network / supabase fallback
      } finally {
        if (isMounted) {
          setReady(true);
        }
      }
    }

    initialize();

    const { data: listener } = supabase
      ? supabase.auth.onAuthStateChange((_e, s) => {
          setSession(s);
          if (s?.user?.id) {
            fetchLibrary(s.user.id);
            fetchWatchlist(s.user.id);
            fetchFriendships(s.user.id);
            fetchAllUsers(s.user.id);
          }
          if (!s) setReady(true);
        })
      : { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    AsyncStorage.setItem(LANG_KEY, newLang).catch(() => undefined);
  };

  // Supabase Cloud Sync
  useEffect(() => {
    if (!supabase || !session) return;

    fetchLibrary(session.user.id);
    fetchWatchlist(session.user.id);

    supabase.storage.from('avatars').createSignedUrl(`${session.user.id}/avatar`, 3600)
      .then(({ data }) => { if (data?.signedUrl) setAvatar(data.signedUrl); })
      .catch(() => undefined);

    const defaultUsername = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User';
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          if (data.username) {
            setUsername(data.username);
            AsyncStorage.setItem(USERNAME_KEY, data.username).catch(() => undefined);
          } else {
            if (supabase) {
              void supabase.from('profiles').update({
                username: defaultUsername,
                updated_at: new Date().toISOString(),
              }).eq('id', session.user.id);
            }
            setUsername(defaultUsername);
          }
          if (data.bio) {
            setBio(data.bio);
            AsyncStorage.setItem(BIO_KEY, data.bio).catch(() => undefined);
          }
          if (data.avatar_url) {
            setAvatar(data.avatar_url);
            AsyncStorage.setItem(AVATAR_KEY, data.avatar_url).catch(() => undefined);
          } else {
            AsyncStorage.getItem(AVATAR_KEY).then((localAv) => {
              if (localAv && supabase) {
                void supabase.from('profiles').update({ avatar_url: localAv }).eq('id', session.user.id);
              }
            }).catch(() => undefined);
          }
          if ((data as any).banner_url) {
            setBanner((data as any).banner_url);
            AsyncStorage.setItem(BANNER_KEY, (data as any).banner_url).catch(() => undefined);
          } else {
            AsyncStorage.getItem(BANNER_KEY).then((localBn) => {
              if (localBn && supabase) {
                void supabase.from('profiles').update({ banner_url: localBn }).eq('id', session.user.id);
              }
            }).catch(() => undefined);
          }
        } else if (!data && supabase) {
          // Automatically create initial profile so all users appear immediately
          void supabase.from('profiles').insert({
            id: session.user.id,
            username: defaultUsername,
            updated_at: new Date().toISOString(),
          }).then(() => {
            setUsername(defaultUsername);
            fetchAllUsers(session.user.id);
          });
        }
        fetchAllUsers(session.user.id);
      }, () => undefined);

    // Realtime listener on profiles table so photos update across all devices instantly
    const profileChannel = supabase
      .channel(`profile-realtime-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.avatar_url) {
            setAvatar(newRow.avatar_url);
            AsyncStorage.setItem(AVATAR_KEY, newRow.avatar_url).catch(() => undefined);
          }
          if (newRow?.banner_url !== undefined) {
            setBanner(newRow.banner_url || null);
            if (newRow.banner_url) {
              AsyncStorage.setItem(BANNER_KEY, newRow.banner_url).catch(() => undefined);
            } else {
              AsyncStorage.removeItem(BANNER_KEY).catch(() => undefined);
            }
          }
          if (newRow?.username) {
            setUsername(newRow.username);
            AsyncStorage.setItem(USERNAME_KEY, newRow.username).catch(() => undefined);
          }
          if (newRow?.bio) {
            setBio(newRow.bio);
            AsyncStorage.setItem(BIO_KEY, newRow.bio).catch(() => undefined);
          }
        },
      )
      .subscribe();

    // Realtime listener on watchlist table so watchlist updates across all devices instantly (e.g. mobile <-> pc)
    const watchlistChannel = supabase
      .channel(`watchlist-realtime-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'watchlist',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          fetchWatchlist(session.user.id);
        },
      )
      .subscribe();

    // Realtime listener on series_entries table
    const seriesChannel = supabase
      .channel(`series-realtime-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'series_entries',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          fetchLibrary(session.user.id);
        },
      )
      .subscribe();

    // Realtime listener on friendships table
    const friendsChannel = supabase
      .channel(`friendships-realtime-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => {
          fetchFriendships(session.user.id);
        },
      )
      .subscribe();

    // Realtime listener on all profiles so new user registrations and avatar updates appear live
    const allProfilesChannel = supabase
      .channel('all-profiles-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchAllUsers(session.user.id);
        },
      )
      .subscribe();

    // Visibility / focus listener to re-sync immediately when phone screen turns on, app is foregrounded, or user switches tabs
    let visibilityCleanup = () => {};
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          fetchLibrary(session.user.id);
          fetchWatchlist(session.user.id);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      visibilityCleanup = () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchLibrary(session.user.id);
        fetchWatchlist(session.user.id);
      }
    });

    return () => {
      profileChannel.unsubscribe();
      watchlistChannel.unsubscribe();
      seriesChannel.unsubscribe();
      friendsChannel.unsubscribe();
      allProfilesChannel.unsubscribe();
      visibilityCleanup();
      appStateSub.remove();
    };
  }, [session]);

  // Pre-fetch episode counts for series in watchlist that don't have totalEpisodes
  useEffect(() => {
    watchlist.forEach((w) => {
      if (w.mediaType === 'series' && (!w.totalEpisodes || w.totalEpisodes === 0) && w.id) {
        fetchItemDetails(w.id, 'series', lang === 'pt' ? 'pt-PT' : 'en-US')
          .then((res) => {
            if (res.totalEpisodes > 0) {
              setWatchlist((cur) =>
                cur.map((item) =>
                  item.id === w.id && item.mediaType === w.mediaType && (!item.totalEpisodes || item.totalEpisodes === 0)
                    ? { ...item, totalEpisodes: res.totalEpisodes }
                    : item
                )
              );
            }
          })
          .catch(() => undefined);
      }
    });
  }, [watchlist.length, lang]);

  const syncSeries = (series: Series, entry: PersonalData) => {
    if (!supabase || !session) return;
    const watched = entry.watchedEpisodes !== undefined ? entry.watchedEpisodes : series.watchedEpisodes;
    const isDone = series.totalEpisodes > 0 && watched >= series.totalEpisodes;
    const newCollection: Collection = isDone
      ? 'up_to_date'
      : watched > 0
      ? 'watching'
      : series.collection;

    let reviewPayload = entry.review ?? null;
    const epList = entry.watchedEpList ?? personal[series.title]?.watchedEpList;
    if (epList && epList.length > 0) {
      reviewPayload = JSON.stringify({ eps: epList, text: entry.review || '' });
    }

    supabase.from('series_entries').upsert({
      user_id: session.user.id,
      media_type: series.mediaType ?? 'series',
      tmdb_id: series.tmdbId ?? null,
      poster_path: series.posterPath ?? null,
      title: series.title,
      collection: newCollection,
      watched_episodes: watched,
      total_episodes: series.totalEpisodes,
      rating: entry.rating ?? null,
      review: reviewPayload,
      last_watched: entry.lastWatched ?? null,
    }, { onConflict: 'user_id,media_type,title' }).then(() => undefined);
  };

  const update = (title: string, changes: PersonalData) => {
    let updatedSeries: Series | undefined;

    setPersonal((cur) => {
      const existing = cur[title] || {};
      const nextItem = { ...existing, ...changes };
      const next = { ...cur, [title]: nextItem };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });

    setLibrary((cur) => {
      const match = cur.find(
        (s) => s.title === title || s.title.trim().toLowerCase() === title.trim().toLowerCase()
      );
      if (!match) return cur;
      const watched = changes.watchedEpisodes !== undefined ? changes.watchedEpisodes : match.watchedEpisodes;
      const isDone = match.totalEpisodes > 0 && watched >= match.totalEpisodes;
      updatedSeries = {
        ...match,
        watchedEpisodes: watched,
        collection: isDone ? 'up_to_date' : watched > 0 ? 'watching' : match.collection,
        lastWatched: changes.lastWatched ?? match.lastWatched,
      };
      const next = cur.map((s) => (s === match ? updatedSeries! : s));
      AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(next)).catch(() => undefined);
      if (updatedSeries) {
        syncSeries(updatedSeries, changes);
      }
      return next;
    });
  };

  const addFromCatalog = async (item: TmdbResult, initialPersonal?: PersonalData) => {
    let totalEpisodes = item.totalEpisodes ?? (item.mediaType === 'movie' ? 1 : 0);
    let overview = item.overview;
    let posterPath = item.posterPath;
    let backdropPath = item.backdropPath;

    if (item.mediaType === 'series' && (!item.totalEpisodes || item.totalEpisodes === 0)) {
      const details = await fetchItemDetails(item.id, item.mediaType, lang === 'pt' ? 'pt-PT' : 'en-US');
      totalEpisodes = details.totalEpisodes;
      if (!overview) overview = details.overview;
      if (!posterPath) posterPath = details.posterPath;
      if (!backdropPath) backdropPath = details.backdropPath;
    }

    setLibrary((cur) => {
      const existingPersonal = initialPersonal || personal[item.title] || {};
      const watched = existingPersonal.watchedEpisodes ?? 0;
      const isDone = totalEpisodes > 0 && watched >= totalEpisodes;
      const initialCollection: Collection = isDone ? 'up_to_date' : (watched > 0 ? 'watching' : 'watching');

      const entry: Series = {
        title: item.title,
        mediaType: item.mediaType,
        tmdbId: item.id,
        posterPath,
        backdropPath,
        overview,
        collection: initialCollection,
        watchedEpisodes: watched,
        totalEpisodes,
        lastWatched: existingPersonal.lastWatched ?? Date.now(),
      };

      const filtered = cur.filter((s) => !(s.tmdbId === item.id && s.mediaType === item.mediaType));
      const next = [entry, ...filtered];
      AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(next)).catch(() => undefined);
      syncSeries(entry, existingPersonal);
      return next;
    });

    // Remove from watchlist if present
    removeFromWatchlist(item);
  };

  const removeFromLibrary = (seriesTitle: string, tmdbId?: number) => {
    setLibrary((cur) => {
      const target = cur.find((s) =>
        (tmdbId && s.tmdbId === tmdbId) ||
        (s.title && s.title.trim().toLowerCase() === seriesTitle.trim().toLowerCase())
      );
      if (!target) return cur;
      const next = cur.filter((s) => s !== target);
      AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(next)).catch(() => undefined);
      if (supabase && session) {
        supabase.from('series_entries').delete()
          .match({ user_id: session.user.id, title: target.title, media_type: target.mediaType ?? 'series' })
          .then(() => undefined);
      }
      return next;
    });
  };

  const addToWatchlist = async (item: TmdbResult) => {
    // If it's already in library, remove from library
    removeFromLibrary(item.title, item.id);

    let totalEpisodes = item.totalEpisodes;
    if (item.mediaType === 'series' && (!totalEpisodes || totalEpisodes === 0) && item.id) {
      try {
        const details = await fetchItemDetails(item.id, item.mediaType, lang === 'pt' ? 'pt-PT' : 'en-US');
        if (details.totalEpisodes > 0) totalEpisodes = details.totalEpisodes;
      } catch {}
    }

    const itemWithEps: TmdbResult = totalEpisodes ? { ...item, totalEpisodes } : item;

    setWatchlist((cur) => {
      if (cur.some((w) => w.id === item.id && w.mediaType === item.mediaType)) return cur;
      const next = [itemWithEps, ...cur];
      AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)).catch(() => undefined);
      if (supabase && session) {
        supabase.from('watchlist').upsert({
          user_id: session.user.id,
          tmdb_id: item.id,
          media_type: item.mediaType,
          title: item.title,
          poster_path: item.posterPath ?? null,
          overview: item.overview ?? null,
        }, { onConflict: 'user_id,tmdb_id,media_type' }).then(() => undefined, () => undefined);
      }
      return next;
    });
  };

  const removeFromWatchlist = (item: { id?: number; title?: string; mediaType?: string }) => {
    const isTarget = (w: TmdbResult) => {
      const idMatch = Boolean(item.id && item.id !== 0 && w.id && w.id !== 0 && w.id === item.id);
      const titleMatch = Boolean(
        item.title && w.title && w.title.trim().toLowerCase() === item.title.trim().toLowerCase()
      );
      return idMatch || titleMatch;
    };

    setWatchlist((cur) => {
      const next = cur.filter((w) => !isTarget(w));
      AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });

    if (supabase && session?.user?.id) {
      if (item.id && item.id !== 0) {
        supabase
          .from('watchlist')
          .delete()
          .match({ user_id: session.user.id, tmdb_id: item.id })
          .then(() => undefined, () => undefined);
      } else if (item.title) {
        supabase
          .from('watchlist')
          .delete()
          .match({ user_id: session.user.id, title: item.title })
          .then(() => undefined, () => undefined);
      }
    }
  };

  const authenticate = async (email: string, password: string, mode: 'signIn' | 'signUp') => {
    if (!supabase) return 'Database connection not configured yet.';
    if (password.length < 8) return 'Password must be at least 8 characters.';

    if (mode === 'signIn') {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        if (result.error.message.toLowerCase().includes('invalid login credentials')) {
          return lang === 'pt' ? 'Email ou palavra-passe incorretos.' : 'Invalid email or password.';
        }
        return result.error.message;
      }
      if (result.data?.session?.user) {
        const meta = result.data.session.user.user_metadata;
        if (
          (typeof meta?.avatar_url === 'string' && meta.avatar_url.length > 500) ||
          (typeof meta?.banner_url === 'string' && meta.banner_url.length > 500)
        ) {
          try {
            await supabase.auth.updateUser({
              data: { avatar_url: null, banner_url: null },
            });
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed?.session) {
              setSession(refreshed.session);
            }
          } catch {
            // Handled via SQL cleanup if header too large
          }
        }
        fetchLibrary(result.data.session.user.id);
        fetchWatchlist(result.data.session.user.id);
      }
      return null;
    } else {
      const result = await supabase.auth.signUp({ email, password });
      if (result.error) {
        const msg = result.error.message.toLowerCase();
        if (
          msg.includes('already registered') ||
          msg.includes('already exists') ||
          msg.includes('user already exists') ||
          msg.includes('email address has already been registered')
        ) {
          return lang === 'pt'
            ? 'Este email já se encontra registado. Inicia sessão na tua conta.'
            : 'An account with this email already exists. Please sign in instead.';
        }
        return result.error.message;
      }

      // Check Supabase identities: if identities is empty array, email is already registered
      if (
        result.data?.user &&
        Array.isArray(result.data.user.identities) &&
        result.data.user.identities.length === 0
      ) {
        return lang === 'pt'
          ? 'Este email já se encontra registado. Inicia sessão na tua conta.'
          : 'An account with this email already exists. Please sign in instead.';
      }

      if (!result.data.session) {
        return lang === 'pt'
          ? 'Conta criada! Confirma o teu email para entrar.'
          : 'Account created! Please check your email to confirm.';
      }
      return null;
    }
  };

  const signOut = async () => {
    try {
      await supabase?.auth.signOut();
    } finally {
      setSession(null);
      setLibrary([]);
      setWatchlist([]);
      setPersonal({});
      setUsername('');
      setBio('');
      setAvatar(null);
      setBanner(null);
      AsyncStorage.multiRemove([
        LIBRARY_KEY,
        WATCHLIST_KEY,
        STORAGE_KEY,
        USERNAME_KEY,
        BIO_KEY,
        AVATAR_KEY,
        BANNER_KEY,
      ]).catch(() => undefined);
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (avatar && uri === avatar) {
      alert(
        lang === 'pt'
          ? 'Esta fotografia já é a tua foto atual. Escolhe uma fotografia diferente.'
          : 'This is already your current photo. Please choose a different photo.',
      );
      return;
    }

    setAvatar(uri);
    AsyncStorage.setItem(AVATAR_KEY, uri).catch(() => undefined);
    if (!supabase || !session) return;

    // Persist directly to profiles table so all devices sync the photo
    try {
      const { error: updErr } = await supabase.from('profiles').update({
        avatar_url: uri,
        updated_at: new Date().toISOString(),
      }).eq('id', session.user.id);
      if (updErr) {
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: session.user.id,
          avatar_url: uri,
          updated_at: new Date().toISOString(),
        });
        if (upsertErr && (upsertErr.message?.includes('avatar_url') || upsertErr.code === '42703')) {
          alert(lang === 'pt' ? 'Para gravar a foto no servidor, adiciona a coluna avatar_url no SQL do Supabase:\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;' : 'Add avatar_url column in Supabase SQL editor.');
        }
      }
    } catch (e) {
      console.warn('Error persisting avatar to profiles:', e);
    }

    // Upload to avatars storage bucket if available
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      await supabase.storage.from('avatars')
        .upload(`${session.user.id}/avatar`, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
    } catch { /* keep local & database copy */ }
  };

  const uploadBanner = async (uri: string) => {
    if (banner && uri === banner) {
      alert(
        lang === 'pt'
          ? 'Esta fotografia já é a tua imagem de fundo atual. Escolhe uma fotografia diferente.'
          : 'This is already your current background photo. Please choose a different photo.',
      );
      return;
    }

    setBanner(uri);
    AsyncStorage.setItem(BANNER_KEY, uri).catch(() => undefined);
    if (!supabase || !session) return;

    try {
      const { error: updErr } = await supabase.from('profiles').update({
        banner_url: uri,
        updated_at: new Date().toISOString(),
      }).eq('id', session.user.id);
      if (updErr) {
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: session.user.id,
          banner_url: uri,
          updated_at: new Date().toISOString(),
        });
        if (upsertErr && (upsertErr.message?.includes('banner_url') || upsertErr.code === '42703')) {
          alert(lang === 'pt' ? 'Para gravar a capa no servidor, adiciona a coluna banner_url no SQL do Supabase:\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url text;' : 'Add banner_url column in Supabase SQL editor.');
        }
      }
    } catch (e) {
      console.warn('Error persisting banner to profiles:', e);
    }
  };

  const removeBanner = async () => {
    setBanner(null);
    AsyncStorage.removeItem(BANNER_KEY).catch(() => undefined);
    if (!supabase || !session) return;

    try {
      await supabase.from('profiles').upsert({
        id: session.user.id,
        banner_url: null,
        updated_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }
  };

  const handleSaveProfile = async (newUsername: string, newBio: string) => {
    setUsername(newUsername);
    setBio(newBio);
    AsyncStorage.setItem(USERNAME_KEY, newUsername).catch(() => undefined);
    AsyncStorage.setItem(BIO_KEY, newBio).catch(() => undefined);

    if (supabase && session) {
      try {
        await supabase.from('profiles').upsert({
          id: session.user.id,
          username: newUsername.trim() || null,
          bio: newBio.trim() || null,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // silent fallback
      }
    }
  };

  const progress = (s: Series) => personal[s.title]?.watchedEpisodes ?? s.watchedEpisodes;
  const lastWatched = (s: Series) => personal[s.title]?.lastWatched ?? s.lastWatched ?? 0;

  if (!ready) {
    return <LoadingScreen lang={lang} />;
  }

  if (isSupabaseConfigured && !session) {
    return <SignIn onAuthenticate={authenticate} lang={lang} onChangeLang={changeLanguage} />;
  }

  const tabContent = (
    <Animated.View
      style={[styles.content, { transform: [{ translateX: slideAnim }], opacity: tabOpacity }]}
    >
      {tab === 'home' && (
        <Home
          library={library}
          progress={progress}
          lastWatched={lastWatched}
          open={setSelected}
          onOpenSearch={() => setSearchModalOpen(true)}
          lang={lang}
        />
      )}
      {tab === 'library' && (
        <Library
          library={library}
          watchlist={watchlist}
          progress={progress}
          open={setSelected}
          onAddToLibrary={addFromCatalog}
          lang={lang}
        />
      )}
      {tab === 'watchlist' && (
        <Watchlist
          items={watchlist}
          library={library}
          progress={progress}
          open={setSelected}
          onRemove={removeFromWatchlist}
          onAddToWatchlist={addToWatchlist}
          lang={lang}
        />
      )}
      {tab === 'friends' && (
        <FriendsScreen
          friends={friends}
          allUsers={allUsers}
          loadingUsers={loadingUsers}
          currentUserId={session?.user?.id}
          onSendFriendRequest={sendFriendRequest}
          onRespondFriendRequest={respondFriendRequest}
          onRemoveFriendship={removeFriendship}
          onRefreshUsers={() => fetchAllUsers(session?.user?.id)}
          onOpenSeries={setSelected}
          lang={lang}
        />
      )}
      {tab === 'profile' && (
        <Profile
          library={library}
          watchlist={watchlist}
          progress={progress}
          lastWatched={lastWatched}
          open={setSelected}
          avatar={avatar}
          banner={banner}
          username={username}
          bio={bio}
          email={session?.user.email}
          onUploadAvatar={uploadAvatar}
          onUploadBanner={uploadBanner}
          onRemoveBanner={removeBanner}
          onSaveProfile={handleSaveProfile}
          settingsOpen={settingsOpen}
          onOpenSettings={() => setSettingsOpen(true)}
          onCloseSettings={() => setSettingsOpen(false)}
          onSignOut={signOut}
          lang={lang}
          onChangeLang={changeLanguage}
          onNavigateTab={goToTab}
          friends={friends}
          currentUserId={session?.user?.id}
          onSendFriendRequest={sendFriendRequest}
          onRespondFriendRequest={respondFriendRequest}
          onRemoveFriendship={removeFriendship}
          onSearchUsers={searchUsersByUsername}
        />
      )}
    </Animated.View>
  );

  return (
    <View style={[styles.safe, tab === 'profile' && { paddingTop: 0 }]}>
      <StatusBar style="light"  />
      {selected ? (() => {
        const selectedTmdbId = 'tmdbId' in selected ? selected.tmdbId : ('id' in selected ? selected.id : undefined);
        const libMatch = library.find(
          (s) =>
            (selectedTmdbId && s.tmdbId === selectedTmdbId) ||
            (s.title && s.title.trim().toLowerCase() === selected.title.trim().toLowerCase())
        );
        const canonicalTitle = libMatch ? libMatch.title : selected.title;

        return (
          <SeriesDetailModal
            item={selected}
            library={library}
            watchlist={watchlist}
            personal={personal[canonicalTitle] ?? personal[selected.title] ?? {}}
            progress={'collection' in selected ? progress(selected) : (libMatch ? progress(libMatch) : 0)}
            onClose={() => setSelected(null)}
            onAddToLibrary={addFromCatalog}
            onRemoveFromLibrary={() => {
              const tid = 'tmdbId' in selected ? selected.tmdbId : ('id' in selected ? selected.id : undefined);
              removeFromLibrary(canonicalTitle, tid);
            }}
            onAddToWatchlist={(tmdbItem) => {
              addToWatchlist(tmdbItem);
            }}
            onRemoveFromWatchlist={(tmdbItem) => {
              removeFromWatchlist(tmdbItem);
            }}
            onUpdatePersonal={(changes) => update(canonicalTitle, changes)}
            lang={lang}
          />
        );
      })() : (
        <>
          {tabContent}
          <View style={{ backgroundColor: C.surface, width: '100%' }}>
            <TabBar tab={tab} setTab={goToTab} lang={lang} pendingRequestsCount={friends.filter(f => f.status === 'pending' && f.friendId === session?.user?.id).length} />
          </View>
          <SearchCatalogModal
            visible={searchModalOpen}
            close={() => setSearchModalOpen(false)}
            onAddToLibrary={addFromCatalog}
            onAddToWatchlist={addToWatchlist}
            library={library}
            watchlist={watchlist}
            openDetail={(item) => {
              setSearchModalOpen(false);
              setSelected(item);
            }}
            lang={lang}
          />
        </>
      )}
    </View>
  );
}

// ─── Sign In ──────────────────────────────────────────────────────────────────

function SignIn({
  onAuthenticate,
  lang,
  onChangeLang,
}: {
  onAuthenticate: (email: string, password: string, mode: 'signIn' | 'signUp') => Promise<string | null>;
  lang: Language;
  onChangeLang: (l: Language) => void;
}) {
  const t = i18n[lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'signUp';

  const submit = async () => {
    setMessage('');
    if (!email.trim()) {
      setMessage(lang === 'pt' ? 'Insere o teu email.' : 'Please enter your email.');
      return;
    }
    if (password.length < 8) {
      setMessage(t.passwordTooShort);
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setMessage(t.passwordsDontMatch);
      return;
    }

    setLoading(true);
    const res = await onAuthenticate(email.trim(), password, mode);
    setLoading(false);
    setMessage(
      res ??
        (mode === 'signIn'
          ? lang === 'pt'
            ? 'Sessão iniciada.'
            : 'Signed in.'
          : lang === 'pt'
          ? 'Conta criada com sucesso.'
          : 'Account created.'),
    );
  };

  const switchMode = (newMode: 'signIn' | 'signUp') => {
    setMode(newMode);
    setMessage('');
    setConfirmPassword('');
  };

  return (
    <View style={authSt.container}>
      <StatusBar style="light" />

      {/* Blurred Cinema Hall Background */}
      <Image
        source={require('./assets/icon.png')}
        style={authSt.bgImage}
        blurRadius={Platform.OS === 'web' ? 14 : 20}
        resizeMode="cover"
      />
      <View style={authSt.bgOverlay} />
      <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
        <View style={authSt.screen}>
          {/* Logo & Wordmark */}
          <View style={authSt.logoRow}>
            <Image source={require('./assets/icon.png')} style={authSt.appLogo} />
            <Text style={authSt.wordmark}>SCREENVAULT</Text>
          </View>

          {/* Segmented Mode Selector: Sign In vs Create Account */}
          <View style={authSt.tabSelector}>
            <Pressable
              onPress={() => switchMode('signIn')}
              style={[authSt.tabBtn, !isSignUp && authSt.tabBtnActive]}
            >
              <Text style={[authSt.tabBtnText, !isSignUp && authSt.tabBtnTextActive]}>
                {t.signInTab}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => switchMode('signUp')}
              style={[authSt.tabBtn, isSignUp && authSt.tabBtnActive]}
            >
              <Text style={[authSt.tabBtnText, isSignUp && authSt.tabBtnTextActive]}>
                {t.signUpTab}
              </Text>
            </Pressable>
          </View>

          {/* Title & Description */}
          <Text style={authSt.title}>{isSignUp ? t.signUpTitle : t.signInTitle}</Text>
          <Text style={authSt.description}>{isSignUp ? t.signUpDesc : t.signInDesc}</Text>

          {/* Feature highlights badge row - ONLY shown in Create Account */}
          {isSignUp && (
            <View style={authSt.featurePillsRow}>
              <View style={authSt.featureBadge}>
                <Text style={authSt.featureBadgeText}>✓ {t.featurePrivate}</Text>
              </View>
              <View style={authSt.featureBadge}>
                <Text style={authSt.featureBadgeText}>✓ {t.featureCatalog}</Text>
              </View>
            </View>
          )}

          {/* Form Inputs */}
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder={t.emailPlaceholder}
            placeholderTextColor="#8a6c74"
            style={authSt.input}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t.passwordPlaceholder}
            placeholderTextColor="#8a6c74"
            style={authSt.input}
          />

          {/* Confirm Password - ONLY shown in Create Account */}
          {isSignUp && (
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder={t.confirmPasswordPlaceholder}
              placeholderTextColor="#8a6c74"
              style={authSt.input}
            />
          )}

          {/* Submit Button */}
          <Pressable
            style={[styles.primaryButton, { marginTop: 10 }]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.cream} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isSignUp ? `★ ${t.signUpTab}` : `➜ ${t.signInTab}`}
              </Text>
            )}
          </Pressable>

          {/* Bottom toggle prompt */}
          <Pressable onPress={() => switchMode(isSignUp ? 'signIn' : 'signUp')}>
            <Text style={authSt.switch}>
              {isSignUp ? t.alreadyHaveAccount : t.needAccount}
            </Text>
          </Pressable>

          {message ? <Text style={authSt.message}>{message}</Text> : null}

          {/* Bottom language selector */}
          <View style={authSt.bottomLangRow}>
            <Pressable
              onPress={() => onChangeLang('en')}
              style={[authSt.langPill, lang === 'en' && authSt.langPillActive]}
            >
              <Text style={[authSt.langPillText, lang === 'en' && authSt.langPillTextActive]}>
                🇬🇧 EN
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onChangeLang('pt')}
              style={[authSt.langPill, lang === 'pt' && authSt.langPillActive]}
            >
              <Text style={[authSt.langPillText, lang === 'pt' && authSt.langPillTextActive]}>
                🇵🇹 PT
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

function Home({
  library,
  progress,
  lastWatched,
  open,
  onOpenSearch,
  lang,
}: {
  library: Series[];
  progress: (s: Series) => number;
  lastWatched: (s: Series) => number;
  open: (s: Series) => void;
  onOpenSearch: () => void;
  lang: Language;
}) {
  const t = i18n[lang];

  // In-progress series sorted by most recently touched
  const continueWatching = useMemo(() =>
    library
      .filter((s) => s.collection === 'watching' && progress(s) < s.totalEpisodes && progress(s) > 0)
      .sort((a, b) => lastWatched(b) - lastWatched(a)),
    [library, progress, lastWatched],
  );

  // Recent activity: shows with at least 1 episode watched, sorted by lastWatched
  const recentActivity = useMemo(() =>
    library
      .filter((s) => lastWatched(s) > 0)
      .sort((a, b) => lastWatched(b) - lastWatched(a))
      .slice(0, 15),
    [library, lastWatched],
  );

  return (
    <View style={styles.flex}>
      <View style={homeSt.topBar}>
        <View>
          <Text style={styles.wordmark}>SCREENVAULT</Text>
          <Text style={[styles.pageTitle, { marginTop: 0 }]}>{t.home}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <View style={homeSt.versionBadge}>
            <Text style={homeSt.versionBadgeText}>v1.4.0</Text>
          </View>
          <Image source={require('./assets/icon.png')} style={[homeSt.titleIcon, { marginBottom: 0 }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={homeSt.scrollContent}
        showsVerticalScrollIndicator={false}
        overScrollMode="always"
        bounces
      >

      {/* Continue Watching: Compact Posters, horizontal scroll, always visible */}
      <View style={{ marginTop: 12 }}>
        <Text style={styles.sectionHeader}>{t.continueWatching}</Text>
        <Text style={styles.subtitle}>{t.pickUp}</Text>

        {continueWatching.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            overScrollMode="always"
            bounces
            contentContainerStyle={homeSt.continueWatchingRow}
            style={{ marginHorizontal: -22 }}
          >
            {continueWatching.map((s) => {
              const watched = progress(s);
              const isMovie = s.mediaType === 'movie';
              const epSub = isMovie
                ? (watched >= 1 ? (lang === 'pt' ? 'Filme · Visto' : 'Movie · Watched') : (lang === 'pt' ? 'Filme' : 'Movie'))
                : `${watched}/${s.totalEpisodes} ${lang === 'pt' ? 'eps' : 'eps'}`;
              const badgeText = isMovie ? (lang === 'pt' ? 'Filme' : 'Movie') : `${watched}/${s.totalEpisodes}`;

              return (
                <Pressable
                  key={`${s.mediaType}-${s.tmdbId ?? s.title}`}
                  onPress={() => open(s)}
                  style={homeSt.compactCard}
                >
                  <View style={homeSt.compactPoster}>
                    {s.posterPath ? (
                      <Image source={{ uri: posterUrl(s.posterPath) }} style={homeSt.compactPosterImg} resizeMode="cover" />
                    ) : (
                      <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                    )}
                    {/* Subtle episode progress badge */}
                    <View style={homeSt.epBadge}>
                      <Text style={homeSt.epBadgeText}>{badgeText}</Text>
                    </View>
                  </View>
                  <Text style={homeSt.compactTitle} numberOfLines={1}>{s.title}</Text>
                  <Text style={homeSt.compactSubtitle}>{epSub}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={homeSt.emptySectionCard}>
            <Text style={homeSt.emptySectionText}>
              {lang === 'pt' ? 'Nenhuma série a decorrer de momento.' : 'No series in progress.'}
            </Text>
          </View>
        )}
      </View>

      {/* Recent Activity: Always visible */}
      <View style={{ marginTop: 22 }}>
        <Text style={styles.sectionHeader}>{t.recentActivity}</Text>
        <Text style={styles.subtitle}>{t.recentActivitySub}</Text>

        {recentActivity.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            overScrollMode="always"
            bounces
            contentContainerStyle={homeSt.continueWatchingRow}
            style={{ marginHorizontal: -22 }}
          >
            {recentActivity.map((s) => {
              const watched = progress(s);
              const isMovie = s.mediaType === 'movie';
              const isDone = !isMovie && s.totalEpisodes > 0 && watched >= s.totalEpisodes;
              const epSub = isMovie
                ? (watched >= 1 ? (lang === 'pt' ? 'Filme · Visto' : 'Movie · Watched') : (lang === 'pt' ? 'Filme' : 'Movie'))
                : `${watched}/${s.totalEpisodes} ${lang === 'pt' ? 'eps' : 'eps'}${isDone ? ' ✓' : ''}`;
              const badgeText = isMovie ? (lang === 'pt' ? 'Filme' : 'Movie') : `${watched}/${s.totalEpisodes}`;

              return (
                <Pressable
                  key={`recent-${s.mediaType}-${s.tmdbId ?? s.title}`}
                  onPress={() => open(s)}
                  style={homeSt.compactCard}
                >
                  <View style={homeSt.compactPoster}>
                    {s.posterPath ? (
                      <Image source={{ uri: posterUrl(s.posterPath) }} style={homeSt.compactPosterImg} resizeMode="cover" />
                    ) : (
                      <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                    )}
                    <View style={[homeSt.epBadge, isDone && { borderColor: '#2E7D32' }]}>
                      <Text style={[homeSt.epBadgeText, isDone && { color: '#68D391' }]}>{badgeText}</Text>
                    </View>
                  </View>
                  <Text style={homeSt.compactTitle} numberOfLines={1}>{s.title}</Text>
                  <Text style={[homeSt.compactSubtitle, isDone && { color: '#68D391' }]}>{epSub}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={homeSt.emptySectionCard}>
            <Text style={homeSt.emptySectionText}>
              {lang === 'pt' ? 'Sem atividade recente registada.' : 'No recent activity yet.'}
            </Text>
          </View>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

// ─── Library Screen ───────────────────────────────────────────────────────────

function Library({
  library,
  watchlist,
  progress,
  open,
  onAddToLibrary,
  lang,
}: {
  library: Series[];
  watchlist: TmdbResult[];
  progress: (s: Series) => number;
  open: (item: Series | TmdbResult) => void;
  onAddToLibrary: (item: TmdbResult) => void;
  lang: Language;
}) {
  const { numColumns, cardWidth, gap } = useGridMetrics();
  const t = i18n[lang];
  const [filter, setFilter] = useState<'all' | 'series' | 'movies'>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [catalogResults, setCatalogResults] = useState<TmdbResult[]>([]);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LIBRARY_VIEW_KEY)
      .then((val) => {
        if (val !== null) setIsCompact(val === 'grid');
      })
      .catch(() => undefined);
  }, []);

  const toggleViewMode = () => {
    setIsCompact((prev) => {
      const next = !prev;
      AsyncStorage.setItem(LIBRARY_VIEW_KEY, next ? 'grid' : 'list').catch(() => undefined);
      return next;
    });
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setCatalogResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      searchCatalog(q, lang === 'pt' ? 'pt-PT' : 'en-US')
        .then((res) => setCatalogResults(res))
        .catch(() => setCatalogResults([]))
        .finally(() => setSearching(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [query, lang]);

  const isSearchingCatalog = query.trim().length >= 2;

  // Filtered personal library items when not searching catalog
  const filteredMyLibrary = useMemo(() => {
    return library.filter((s) => {
      if (filter === 'series' && s.mediaType === 'movie') return false;
      if (filter === 'movies' && s.mediaType !== 'movie') return false;
      if (query.trim() && !isSearchingCatalog) {
        return s.title.toLowerCase().includes(query.trim().toLowerCase());
      }
      return true;
    });
  }, [library, filter, query, isSearchingCatalog]);

  const filterLabels: Record<Collection, string> = {
    watching: t.watching,
    finished_airing_to_continue: t.finishedToContinue,
    up_to_date: t.upToDate,
  };

  return (
    <View style={styles.flex}>
      <View style={styles.libraryHeader}>
        <Text style={styles.pageTitle}>{t.library}</Text>
        {!isSearchingCatalog && (
          <Pressable onPress={toggleViewMode} style={wlSt.viewModeBtn}>
            <Text style={wlSt.viewModeIcon}>{isCompact ? '☰ List' : '▦ Grid'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.searchBarContainer}>
        <SearchIcon size={16} color={C.bordeaux} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={lang === 'pt' ? 'Pesquisar para adicionar...' : 'Search to add...'}
          placeholderTextColor="#7e6060"
          style={styles.searchBarInput}
        />
        {searching ? (
          <ActivityIndicator size="small" color={C.gold} style={{ marginRight: 6 }} />
        ) : null}
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} style={{ padding: 4 }}>
            <Text style={{ color: C.muted, fontSize: 13, fontWeight: '700' }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {!isSearchingCatalog && (
        <View style={styles.filtersWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            overScrollMode="always"
            bounces
            contentContainerStyle={styles.filters}
          >
            <Chip
              label={t.all}
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <Chip
              label={lang === 'pt' ? 'Minhas Séries' : 'My Series'}
              active={filter === 'series'}
              onPress={() => setFilter('series')}
            />
            <Chip
              label={lang === 'pt' ? 'Meus Filmes' : 'My Movies'}
              active={filter === 'movies'}
              onPress={() => setFilter('movies')}
            />
          </ScrollView>
        </View>
      )}

      {isSearchingCatalog ? (
        catalogResults.length === 0 && !searching ? (
          <View style={{ paddingHorizontal: 22, marginTop: 14 }}>
            <Empty
              text={
                lang === 'pt'
                  ? `Nenhum resultado encontrado para "${query}".`
                  : `No results found for "${query}".`
              }
            />
          </View>
        ) : (
          <FlatList
            data={catalogResults}
            keyExtractor={(item) => `cat-lib-${item.mediaType}-${item.id}`}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            overScrollMode="always"
            bounces
            renderItem={({ item }) => {
              const inLib = library.some(
                (s) => s.tmdbId === item.id && (s.mediaType ?? 'series') === item.mediaType,
              );
              const inWl = watchlist.some(
                (w) => w.id === item.id && (w.mediaType ?? 'series') === item.mediaType,
              );

              return (
                <Pressable onPress={() => open(item)} style={catSt.result}>
                  <PosterThumb posterPath={item.posterPath} title={item.title} size="md" />
                  <View style={[styles.rowBody, { marginLeft: 12 }]}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowMeta}>
                      {item.mediaType === 'movie'
                        ? (lang === 'pt' ? 'Filme' : 'Movie')
                        : (lang === 'pt' ? 'Série' : 'Series')}
                      {inLib ? ` · ${t.inLibrary}` : inWl ? ` · ${t.inWatchlist}` : ''}
                    </Text>
                    <Text numberOfLines={2} style={catSt.overview}>
                      {item.overview || t.noOverview}
                    </Text>
                  </View>
                  <View style={catSt.actionCol}>
                    <Text style={{ color: C.gold, fontSize: 26, fontWeight: '700', paddingHorizontal: 6 }}>›</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )
      ) : isCompact ? (
        <FlatList
          key={`lib-grid-${numColumns}-${filteredMyLibrary.length}`}
          data={filteredMyLibrary}
          extraData={filteredMyLibrary}
          numColumns={numColumns}
          keyExtractor={(s, idx) => `grid-${s.mediaType ?? 'series'}-${s.tmdbId ?? s.title}-${idx}`}
          contentContainerStyle={wlSt.gridContainer}
          columnWrapperStyle={[wlSt.gridRow, { gap }]}
          showsVerticalScrollIndicator={false}
          overScrollMode="always"
          bounces
          ListEmptyComponent={
            <View style={{ marginTop: 14 }}>
              <Empty
                text={
                  filter === 'movies'
                    ? (lang === 'pt'
                        ? 'Não tens filmes na tua biblioteca. Pesquisa acima para adicionar!'
                        : 'No movies in your library. Search above to add!')
                    : filter === 'series'
                    ? (lang === 'pt'
                        ? 'Não tens séries na tua biblioteca. Pesquisa acima para adicionar!'
                        : 'No series in your library. Search above to add!')
                    : (lang === 'pt'
                        ? 'A tua biblioteca está vazia. Pesquisa acima para adicionar filmes e séries!'
                        : 'Your library is empty. Search above to add filmes e séries!')
                }
              />
            </View>
          }
          renderItem={({ item }) => {
            const watched = progress(item);
            const isMovie = item.mediaType === 'movie';
            const isDone = !isMovie && item.totalEpisodes > 0 && watched >= item.totalEpisodes;
            const epSub = isMovie
              ? (watched >= 1 ? (lang === 'pt' ? 'Filme · Visto' : 'Movie · Watched') : (lang === 'pt' ? 'Filme' : 'Movie'))
              : (item.totalEpisodes > 0
                  ? `${watched}/${item.totalEpisodes} eps${isDone ? ' ✓' : ''}`
                  : (lang === 'pt' ? 'Série' : 'Series'));
            const badgeText = isMovie
              ? (watched >= 1 ? (lang === 'pt' ? 'Filme' : 'Movie') : (lang === 'pt' ? 'Filme' : 'Movie'))
              : (item.totalEpisodes > 0 ? `${watched}/${item.totalEpisodes}` : null);

            return (
              <Pressable onPress={() => open(item)} style={[wlSt.gridCard, { width: cardWidth }]}>
                <View style={wlSt.gridPoster}>
                  {item.posterPath ? (
                    <Image source={{ uri: posterUrl(item.posterPath) }} style={wlSt.gridPosterImg} resizeMode="cover" />
                  ) : (
                    <Text style={homeSt.fallbackPosterText}>{item.title.slice(0, 1)}</Text>
                  )}
                  {badgeText ? (
                    <View style={[wlSt.gridEpBadge, isDone && { borderColor: '#2E7D32' }]}>
                      <Text style={[wlSt.gridEpBadgeText, isDone && { color: '#68D391' }]}>{badgeText}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={wlSt.gridTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={[wlSt.gridSubtitle, isDone && { color: '#68D391' }]}>{epSub}</Text>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          key={`lib-list-${filteredMyLibrary.length}`}
          data={filteredMyLibrary}
          keyExtractor={(s, idx) => `list-${s.mediaType ?? 'series'}-${s.tmdbId ?? s.title}-${idx}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          overScrollMode="always"
          bounces
          ListEmptyComponent={
            <View style={{ marginTop: 14 }}>
              <Empty
                text={
                  filter === 'movies'
                    ? (lang === 'pt'
                        ? 'Não tens filmes na tua biblioteca. Pesquisa acima para adicionar!'
                        : 'No movies in your library. Search above to add!')
                    : filter === 'series'
                    ? (lang === 'pt'
                        ? 'Não tens séries na tua biblioteca. Pesquisa acima para adicionar!'
                        : 'No series in your library. Search above to add!')
                    : (lang === 'pt'
                        ? 'A tua biblioteca está vazia. Pesquisa acima para adicionar filmes e séries!'
                        : 'Your library is empty. Search above to add shows and movies!')
                }
              />
            </View>
          }
          renderItem={({ item }) => (
            <SeriesRow
              series={item}
              watched={progress(item)}
              press={() => open(item)}
              collectionLabel={
                item.mediaType === 'movie'
                  ? (lang === 'pt' ? 'Filme' : 'Movie')
                  : filterLabels[item.collection] ?? (lang === 'pt' ? 'Série' : 'Series')
              }
              t={t}
              lang={lang}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Watchlist Screen ─────────────────────────────────────────────────────────

function Watchlist({
  items,
  library,
  progress,
  open,
  onRemove,
  onAddToWatchlist,
  lang,
}: {
  items: TmdbResult[];
  library: Series[];
  progress: (s: Series) => number;
  open: (item: TmdbResult | Series) => void;
  onRemove: (item: TmdbResult) => void;
  onAddToWatchlist: (item: TmdbResult) => void;
  lang: Language;
}) {
  const { numColumns, cardWidth, gap } = useGridMetrics();
  const t = i18n[lang];
  const [isCompact, setIsCompact] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(WATCHLIST_VIEW_KEY)
      .then((val) => {
        if (val !== null) setIsCompact(val === 'grid');
      })
      .catch(() => undefined);
  }, []);

  const toggleViewMode = () => {
    setIsCompact((prev) => {
      const next = !prev;
      AsyncStorage.setItem(WATCHLIST_VIEW_KEY, next ? 'grid' : 'list').catch(() => undefined);
      return next;
    });
  };
  const [searching, setSearching] = useState(false);
  const [catalogResults, setCatalogResults] = useState<TmdbResult[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setCatalogResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      searchCatalog(q, lang === 'pt' ? 'pt-PT' : 'en-US')
        .then((res) => setCatalogResults(res))
        .catch(() => setCatalogResults([]))
        .finally(() => setSearching(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [query, lang]);

  const isSearchingCatalog = query.trim().length >= 2;

  // Local watchlist filtered by single character if typing
  const displayItems = useMemo(() => {
    if (query.trim() && !isSearchingCatalog) {
      return items.filter((w) => w.title.toLowerCase().includes(query.trim().toLowerCase()));
    }
    return items;
  }, [items, query, isSearchingCatalog]);

  return (
    <View style={styles.flex}>
      <View style={styles.libraryHeader}>
        <Text style={styles.pageTitle}>{t.watchlist}</Text>
        {!isSearchingCatalog && (
          <Pressable onPress={toggleViewMode} style={wlSt.viewModeBtn}>
            <Text style={wlSt.viewModeIcon}>{isCompact ? '☰ List' : '▦ Grid'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.searchBarContainer}>
        <SearchIcon size={16} color={C.bordeaux} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={lang === 'pt' ? 'Pesquisar para adicionar à watchlist...' : 'Search to add to watchlist...'}
          placeholderTextColor="#7e6060"
          style={styles.searchBarInput}
        />
        {searching ? (
          <ActivityIndicator size="small" color={C.gold} style={{ marginRight: 6 }} />
        ) : null}
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} style={{ padding: 4 }}>
            <Text style={{ color: C.muted, fontSize: 13, fontWeight: '700' }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {isSearchingCatalog ? (
        catalogResults.length === 0 && !searching ? (
          <View style={{ paddingHorizontal: 22, marginTop: 14 }}>
            <Empty
              text={
                lang === 'pt'
                  ? `Nenhum resultado encontrado para "${query}".`
                  : `No results found for "${query}".`
              }
            />
          </View>
        ) : (
          <FlatList
            data={catalogResults}
            keyExtractor={(item) => `cat-wl-${item.mediaType}-${item.id}`}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            overScrollMode="always"
            bounces
            renderItem={({ item }) => {
              const inLib = library.some(
                (s) => s.tmdbId === item.id && (s.mediaType ?? 'series') === item.mediaType,
              );
              const inWl = items.some(
                (w) => w.id === item.id && (w.mediaType ?? 'series') === item.mediaType,
              );

              return (
                <Pressable onPress={() => open(item)} style={catSt.result}>
                  <PosterThumb posterPath={item.posterPath} title={item.title} size="md" />
                  <View style={[styles.rowBody, { marginLeft: 12 }]}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowMeta}>
                      {item.mediaType === 'movie'
                        ? (lang === 'pt' ? 'Filme' : 'Movie')
                        : (lang === 'pt' ? 'Série' : 'Series')}
                      {inLib ? ` · ${t.inLibrary}` : inWl ? ` · ${t.inWatchlist}` : ''}
                    </Text>
                    <Text numberOfLines={2} style={catSt.overview}>
                      {item.overview || t.noOverview}
                    </Text>
                  </View>
                  <View style={catSt.actionCol}>
                    <Text style={{ color: C.gold, fontSize: 26, fontWeight: '700', paddingHorizontal: 6 }}>›</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )
      ) : displayItems.length === 0 ? (
        <View style={{ paddingHorizontal: 22, marginTop: 14 }}>
          <Empty text={t.emptyWatchlist} />
        </View>
      ) : isCompact ? (
        <FlatList
          key={`compact-grid-${numColumns}-${displayItems.length}`}
          data={displayItems}
          extraData={displayItems}
          numColumns={numColumns}
          keyExtractor={(item, index) => `${item.mediaType || 'item'}-${item.id || item.title || index}-${index}`}
          contentContainerStyle={wlSt.gridContainer}
          columnWrapperStyle={[wlSt.gridRow, { gap }]}
          showsVerticalScrollIndicator={false}
          overScrollMode="always"
          bounces
          renderItem={({ item }) => {
            const libMatch = library.find(
              (s) =>
                (item.id && s.tmdbId === item.id) ||
                (item.title && s.title.trim().toLowerCase() === item.title.trim().toLowerCase())
            );
            const epCount = libMatch?.totalEpisodes ?? item.totalEpisodes;
            const epWatched = libMatch ? progress(libMatch) : 0;
            const isMovie = item.mediaType === 'movie';
            const epSub = isMovie
              ? (lang === 'pt' ? 'Filme' : 'Movie')
              : (epCount ? (epWatched > 0 ? `${epWatched}/${epCount} eps` : `${epCount} eps`) : (lang === 'pt' ? 'Série' : 'Series'));
            const badgeText = isMovie
              ? (lang === 'pt' ? 'Filme' : 'Movie')
              : (epCount ? (epWatched > 0 ? `${epWatched}/${epCount}` : `${epCount} eps`) : null);

            return (
              <Pressable onPress={() => open(item)} style={[wlSt.gridCard, { width: cardWidth }]}>
                <View style={wlSt.gridPoster}>
                  {item.posterPath ? (
                    <Image source={{ uri: posterUrl(item.posterPath) }} style={wlSt.gridPosterImg} resizeMode="cover" />
                  ) : (
                    <Text style={homeSt.fallbackPosterText}>{item.title.slice(0, 1)}</Text>
                  )}
                  {badgeText ? (
                    <View style={wlSt.gridEpBadge}>
                      <Text style={wlSt.gridEpBadgeText}>{badgeText}</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      onRemove(item);
                    }}
                    style={wlSt.removeBadge}
                    hitSlop={8}
                  >
                    <Text style={wlSt.removeBadgeText}>✕</Text>
                  </Pressable>
                </View>
                <Text style={wlSt.gridTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={wlSt.gridSubtitle}>{epSub}</Text>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          key={`detailed-list-${displayItems.length}`}
          data={displayItems}
          extraData={displayItems}
          keyExtractor={(item, index) => `${item.mediaType || 'item'}-${item.id || item.title || index}-${index}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          overScrollMode="always"
          bounces
          renderItem={({ item }) => {
            const libMatch = library.find(
              (s) =>
                (item.id && s.tmdbId === item.id) ||
                (item.title && s.title.trim().toLowerCase() === item.title.trim().toLowerCase())
            );
            const epCount = libMatch?.totalEpisodes ?? item.totalEpisodes;
            const epWatched = libMatch ? progress(libMatch) : 0;
            const isMovie = item.mediaType === 'movie';
            const epLabel = isMovie
              ? (lang === 'pt' ? 'Filme' : 'Movie')
              : (epCount ? (epWatched > 0 ? `${epWatched}/${epCount} eps` : `${epCount} eps`) : (lang === 'pt' ? 'Série' : 'Series'));

            return (
              <Pressable onPress={() => open(item)} style={catSt.watchlistRow}>
                <PosterThumb posterPath={item.posterPath} title={item.title} size="sm" />
                <View style={[styles.rowBody, { marginLeft: 12 }]}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowMeta}>{epLabel}</Text>
                  {item.overview ? (
                    <Text numberOfLines={2} style={catSt.overview}>{item.overview}</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    onRemove(item);
                  }}
                  style={catSt.removeButton}
                  hitSlop={8}
                >
                  <Text style={catSt.removeText}>✕</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Friend Profile Viewer Modal ──────────────────────────────────────────

function FriendProfileModal({
  user,
  currentUserId,
  friendship,
  fallbackLibrary,
  fallbackWatchlist,
  onClose,
  onOpenSeries,
  onSendFriendRequest,
  onRespondFriendRequest,
  onRemoveFriendship,
  lang,
}: {
  user: FriendProfile;
  currentUserId?: string;
  friendship?: Friendship;
  fallbackLibrary?: Series[];
  fallbackWatchlist?: TmdbResult[];
  onClose: () => void;
  onOpenSeries: (item: Series | TmdbResult) => void;
  onSendFriendRequest: (targetUserId: string) => Promise<{ error?: string }>;
  onRespondFriendRequest: (friendshipId: string, accept: boolean) => Promise<void>;
  onRemoveFriendship: (friendshipId: string) => Promise<void>;
  lang: Language;
}) {
  const t = i18n[lang];
  const { width } = useWindowDimensions();
  const safeWidth = width && width > 0 ? width : SCREEN_W;
  const col3Width = Math.floor((Math.min(safeWidth, 480) - 32 - 16) / 3);

  const [profile, setProfile] = useState<FriendProfile>(user);
  const [series, setSeries] = useState<Series[]>(
    fallbackLibrary && user.id === currentUserId ? fallbackLibrary : []
  );
  const [watchlist, setWatchlist] = useState<TmdbResult[]>(fallbackWatchlist && user.id === currentUserId ? fallbackWatchlist : []);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'completed' | 'watching' | 'all' | 'watchlist'>('all');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setProfile(user);
    setActiveTab('all');
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const fetchUserData = async () => {
      if (!supabase || !user.id) {
        if (mounted) setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // 1. Profile details
        try {
          const { data: profData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (mounted && profData) {
            const rawName = profData.username || (profData.email ? profData.email.split('@')[0] : (profData.full_name || `user_${profData.id.slice(0, 6)}`));
            setProfile((prev) => ({
              id: profData.id,
              username: rawName || prev.username,
              bio: profData.bio ?? prev.bio,
              avatarUrl: profData.avatar_url ?? prev.avatarUrl,
              bannerUrl: profData.banner_url ?? prev.bannerUrl,
            }));
          }
        } catch {}

        // 2. Series entries
        try {
          const { data: seriesData, error: sErr } = await supabase
            .from('series_entries')
            .select('*')
            .eq('user_id', user.id)
            .order('title');

          if (!sErr && seriesData && seriesData.length > 0) {
            const parsedSeries: Series[] = seriesData.map((r: any) => ({
              title: r.title,
              collection: r.collection as Collection,
              watchedEpisodes: r.watched_episodes ?? 0,
              totalEpisodes: r.total_episodes ?? 0,
              mediaType: (r.media_type as 'series' | 'movie') || 'series',
              tmdbId: r.tmdb_id ?? undefined,
              posterPath: r.poster_path ?? undefined,
              lastWatched: r.last_watched ? Number(r.last_watched) : undefined,
            }));
            if (mounted) setSeries(parsedSeries);
          } else if (mounted && fallbackLibrary && user.id === currentUserId) {
            setSeries(fallbackLibrary);
          }
        } catch (e) {
          if (mounted && fallbackLibrary && user.id === currentUserId) {
            setSeries(fallbackLibrary);
          }
        }

        // 3. Watchlist
        try {
          const { data: wlData, error: wErr } = await supabase
            .from('watchlist')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (!wErr && wlData && wlData.length > 0) {
            const parsedWl: TmdbResult[] = wlData.map((r: any) => ({
              id: Number(r.tmdb_id) || Number(r.id) || 0,
              mediaType: (r.media_type as 'series' | 'movie') || 'series',
              title: r.title,
              posterPath: r.poster_path ?? undefined,
              overview: r.overview ?? undefined,
            }));
            if (mounted) setWatchlist(parsedWl);
          } else if (mounted && fallbackWatchlist && user.id === currentUserId) {
            setWatchlist(fallbackWatchlist);
          }
        } catch (e) {
          if (mounted && fallbackWatchlist && user.id === currentUserId) {
            setWatchlist(fallbackWatchlist);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUserData();
    return () => {
      mounted = false;
    };
  }, [user.id]);

  const isSeriesCompleted = (s: Series) => {
    if (s.collection === 'up_to_date') return true;
    if (s.mediaType === 'movie') return (s.watchedEpisodes ?? 0) >= 1;
    return (s.watchedEpisodes ?? 0) >= (s.totalEpisodes ?? 0) && (s.totalEpisodes ?? 0) > 0;
  };

  const completedList = useMemo(
    () => series.filter(isSeriesCompleted),
    [series],
  );

  const watchingList = useMemo(
    () => series.filter((s) => !isSeriesCompleted(s) && ((s.watchedEpisodes ?? 0) > 0 || s.collection === 'watching' || s.collection === 'finished_airing_to_continue')),
    [series],
  );

  const totalEpisodes = useMemo(
    () => series.reduce((sum, s) => sum + (s.watchedEpisodes ?? 0), 0),
    [series],
  );

  useEffect(() => {
    if (!loading) {
      if (completedList.length > 0) {
        setActiveTab('completed');
      } else if (watchingList.length > 0) {
        setActiveTab('watching');
      } else if (series.length > 0) {
        setActiveTab('all');
      } else if (watchlist.length > 0) {
        setActiveTab('watchlist');
      }
    }
  }, [loading, completedList.length, watchingList.length, series.length, watchlist.length]);

  const displayedUsername = profile.username ? `@${profile.username}` : `@user_${profile.id.slice(0, 6)}`;
  const isMe = currentUserId === user.id;

  const currentStatus = friendship?.status;
  const isIncoming = currentStatus === 'pending' && friendship?.friendId === currentUserId;
  const isOutgoing = currentStatus === 'pending' && friendship?.userId === currentUserId;
  const isAccepted = currentStatus === 'accepted';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Top Banner with Close Button */}
          <View style={profSt.cleanProfileBanner}>
            {profile.bannerUrl ? (
              <Image source={{ uri: profile.bannerUrl }} style={profSt.cleanProfileBannerImg} resizeMode="cover" />
            ) : (
              <View style={[profSt.cleanProfileBannerImg, { backgroundColor: '#1C1316' }]} />
            )}
            <View style={profSt.cleanBannerOverlay} />
            <Pressable onPress={onClose} style={profSt.cleanCloseBtn} hitSlop={14}>
              <Text style={{ color: C.cream, fontSize: 16, fontWeight: '700' }}>✕</Text>
            </Pressable>
          </View>

          {/* Centered Circular Avatar with Gold Ring */}
          <View style={profSt.cleanAvatarContainer}>
            <View style={profSt.cleanAvatarRing}>
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={profSt.cleanAvatarImg} />
              ) : (
                <Text style={{ fontSize: 34 }}>👤</Text>
              )}
            </View>
          </View>

          {/* Centered Username & Status Pill */}
          <View style={{ alignItems: 'center', marginTop: 10, paddingHorizontal: 20 }}>
            <Text style={profSt.cleanUsername}>{displayedUsername}</Text>
            {profile.bio ? (
              <Text style={profSt.cleanBio} numberOfLines={2}>{profile.bio}</Text>
            ) : null}

            {/* Centered Gold Status Pill / Action */}
            <View style={profSt.cleanPillRow}>
              {isMe ? (
                <View style={profSt.cleanStatusPill}>
                  <Text style={profSt.cleanStatusPillText}>{lang === 'pt' ? 'O teu perfil' : 'Your Profile'}</Text>
                </View>
              ) : isAccepted ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={profSt.cleanStatusPill}>
                    <Text style={profSt.cleanStatusPillText}>✓ {t.alreadyFriends}</Text>
                  </View>
                  {friendship ? (
                    <Pressable
                      onPress={async () => {
                        setActionLoading(true);
                        try {
                          await onRemoveFriendship(friendship.id);
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading}
                      style={profSt.cleanSmallActionBtn}
                    >
                      <Text style={profSt.cleanSmallActionText}>{t.removeFriend}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : isIncoming ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={async () => {
                      if (!friendship) return;
                      setActionLoading(true);
                      try {
                        await onRespondFriendRequest(friendship.id, true);
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                    style={profSt.cleanAcceptPill}
                  >
                    <Text style={profSt.cleanAcceptPillText}>✓ {t.accept}</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      if (!friendship) return;
                      setActionLoading(true);
                      try {
                        await onRespondFriendRequest(friendship.id, false);
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                    style={profSt.cleanDeclinePill}
                  >
                    <Text style={profSt.cleanDeclinePillText}>✕ {t.decline}</Text>
                  </Pressable>
                </View>
              ) : isOutgoing ? (
                <View style={profSt.cleanStatusPill}>
                  <Text style={profSt.cleanStatusPillText}>⌛ {t.requestSent}</Text>
                </View>
              ) : (
                <Pressable
                  onPress={async () => {
                    setActionLoading(true);
                    try {
                      await onSendFriendRequest(user.id);
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  style={profSt.cleanAddPill}
                >
                  <Text style={profSt.cleanAddPillText}>
                    {actionLoading ? '...' : `+ ${t.sendRequest}`}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Clean Stats Row (24 Vistas | 5 A Ver | 142 Eps) */}
          <View style={profSt.cleanStatsRow}>
            <View style={profSt.cleanStatCol}>
              <Text style={profSt.cleanStatNum}>{completedList.length}</Text>
              <Text style={profSt.cleanStatLbl}>{t.watchedSeriesCount}</Text>
            </View>
            <View style={profSt.cleanStatDivider} />
            <View style={profSt.cleanStatCol}>
              <Text style={profSt.cleanStatNum}>{watchingList.length}</Text>
              <Text style={profSt.cleanStatLbl}>{t.currentlyWatching}</Text>
            </View>
            <View style={profSt.cleanStatDivider} />
            <View style={profSt.cleanStatCol}>
              <Text style={profSt.cleanStatNum}>{totalEpisodes}</Text>
              <Text style={profSt.cleanStatLbl}>{t.epsCount}</Text>
            </View>
            <View style={profSt.cleanStatDivider} />
            <View style={profSt.cleanStatCol}>
              <Text style={profSt.cleanStatNum}>{watchlist.length}</Text>
              <Text style={profSt.cleanStatLbl}>{t.userWatchlist}</Text>
            </View>
          </View>

          {/* Minimalist Text Tabs (Todas | A Ver | Por Ver | Visto) */}
          <View style={profSt.cleanTabsRow}>
            <Pressable onPress={() => setActiveTab('all')} style={profSt.cleanTabPressable}>
              <Text style={[profSt.cleanTabText, activeTab === 'all' && profSt.cleanTabTextActive]}>
                {t.allSeries}
              </Text>
            </Pressable>
            <Text style={profSt.cleanTabSep}>|</Text>
            <Pressable onPress={() => setActiveTab('watching')} style={profSt.cleanTabPressable}>
              <Text style={[profSt.cleanTabText, activeTab === 'watching' && profSt.cleanTabTextActive]}>
                {t.currentlyWatching}
              </Text>
            </Pressable>
            <Text style={profSt.cleanTabSep}>|</Text>
            <Pressable onPress={() => setActiveTab('watchlist')} style={profSt.cleanTabPressable}>
              <Text style={[profSt.cleanTabText, activeTab === 'watchlist' && profSt.cleanTabTextActive]}>
                {t.userWatchlist}
              </Text>
            </Pressable>
            <Text style={profSt.cleanTabSep}>|</Text>
            <Pressable onPress={() => setActiveTab('completed')} style={profSt.cleanTabPressable}>
              <Text style={[profSt.cleanTabText, activeTab === 'completed' && profSt.cleanTabTextActive]}>
                {t.watched}
              </Text>
            </Pressable>
          </View>

          {/* 3-Column Posters Grid */}
          <View style={{ paddingHorizontal: 16 }}>
            {loading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={C.gold} />
                <Text style={{ color: C.muted, marginTop: 12, fontSize: 13 }}>{t.loading}</Text>
              </View>
            ) : activeTab === 'completed' ? (
              completedList.length === 0 ? (
                <View style={{ marginTop: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🏆</Text>
                  <Empty text={t.noCompletedSeries} />
                </View>
              ) : (
                <View style={[wlSt.gridRow, { flexWrap: 'wrap', gap: 8 }]}>
                  {completedList.map((s, idx) => {
                    const isMovie = s.mediaType === 'movie';
                    const watched = s.watchedEpisodes ?? 0;
                    const badgeText = isMovie
                      ? (lang === 'pt' ? 'Filme' : 'Movie')
                      : (s.totalEpisodes > 0 ? `${watched}/${s.totalEpisodes}` : `${watched} eps`);
                    const epSub = isMovie
                      ? (lang === 'pt' ? 'Filme · Visto' : 'Movie · Watched')
                      : (s.totalEpisodes > 0 ? `${watched}/${s.totalEpisodes} eps ✓` : `${watched} eps ✓`);
                    return (
                      <Pressable
                        key={`friend-comp-${s.tmdbId ?? s.title}-${idx}`}
                        onPress={() => onOpenSeries(s)}
                        style={[wlSt.gridCard, { width: col3Width }]}
                      >
                        <View style={profSt.cleanGridPoster}>
                          {s.posterPath ? (
                            <Image source={{ uri: posterUrl(s.posterPath) }} style={profSt.cleanGridPosterImg} resizeMode="cover" />
                          ) : (
                            <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                          )}
                          <View style={[wlSt.gridEpBadge, { borderColor: '#2E7D32' }]}>
                            <Text style={[wlSt.gridEpBadgeText, { color: '#68D391' }]}>{badgeText}</Text>
                          </View>
                        </View>
                        <Text style={wlSt.gridTitle} numberOfLines={1}>{s.title}</Text>
                        <Text style={[wlSt.gridSubtitle, { color: '#68D391' }]}>{epSub}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )
            ) : activeTab === 'watching' ? (
              watchingList.length === 0 ? (
                <View style={{ marginTop: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🎬</Text>
                  <Empty text={t.noWatchingSeries} />
                </View>
              ) : (
                <View style={[wlSt.gridRow, { flexWrap: 'wrap', gap: 8 }]}>
                  {watchingList.map((s, idx) => {
                    const watched = s.watchedEpisodes ?? 0;
                    const badgeText = s.totalEpisodes > 0 ? `${watched}/${s.totalEpisodes}` : `${watched} eps`;
                    const epSub = s.totalEpisodes > 0 ? `${watched}/${s.totalEpisodes} eps` : `${watched} eps`;
                    return (
                      <Pressable
                        key={`friend-watching-${s.tmdbId ?? s.title}-${idx}`}
                        onPress={() => onOpenSeries(s)}
                        style={[wlSt.gridCard, { width: col3Width }]}
                      >
                        <View style={profSt.cleanGridPoster}>
                          {s.posterPath ? (
                            <Image source={{ uri: posterUrl(s.posterPath) }} style={profSt.cleanGridPosterImg} resizeMode="cover" />
                          ) : (
                            <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                          )}
                          <View style={wlSt.gridEpBadge}>
                            <Text style={wlSt.gridEpBadgeText}>{badgeText}</Text>
                          </View>
                        </View>
                        <Text style={wlSt.gridTitle} numberOfLines={1}>{s.title}</Text>
                        <Text style={wlSt.gridSubtitle}>{epSub}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )
            ) : activeTab === 'all' ? (
              series.length === 0 ? (
                <View style={{ marginTop: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>📺</Text>
                  <Empty text={t.noCompletedSeries} />
                </View>
              ) : (
                <View style={[wlSt.gridRow, { flexWrap: 'wrap', gap: 8 }]}>
                  {series.map((s, idx) => {
                    const isMovie = s.mediaType === 'movie';
                    const watched = s.watchedEpisodes ?? 0;
                    const isDone = isSeriesCompleted(s);
                    const badgeText = isMovie
                      ? (watched > 0 ? (lang === 'pt' ? 'Filme · Visto' : 'Movie · Watched') : (lang === 'pt' ? 'Filme' : 'Movie'))
                      : (s.totalEpisodes > 0 ? `${watched}/${s.totalEpisodes}` : `${watched} eps`);
                    const epSub = isMovie
                      ? (watched > 0 ? (lang === 'pt' ? 'Filme · Visto' : 'Movie · Watched') : (lang === 'pt' ? 'Filme' : 'Movie'))
                      : (s.totalEpisodes > 0 ? `${watched}/${s.totalEpisodes} eps${isDone ? ' ✓' : ''}` : `${watched} eps`);
                    return (
                      <Pressable
                        key={`friend-all-${s.tmdbId ?? s.title}-${idx}`}
                        onPress={() => onOpenSeries(s)}
                        style={[wlSt.gridCard, { width: col3Width }]}
                      >
                        <View style={profSt.cleanGridPoster}>
                          {s.posterPath ? (
                            <Image source={{ uri: posterUrl(s.posterPath) }} style={profSt.cleanGridPosterImg} resizeMode="cover" />
                          ) : (
                            <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                          )}
                          <View style={[wlSt.gridEpBadge, isDone && { borderColor: '#2E7D32' }]}>
                            <Text style={[wlSt.gridEpBadgeText, isDone && { color: '#68D391' }]}>{badgeText}</Text>
                          </View>
                        </View>
                        <Text style={wlSt.gridTitle} numberOfLines={1}>{s.title}</Text>
                        <Text style={[wlSt.gridSubtitle, isDone && { color: '#68D391' }]}>{epSub}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )
            ) : (
              watchlist.length === 0 ? (
                <View style={{ marginTop: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🔖</Text>
                  <Empty text={t.noWatchlistItems} />
                </View>
              ) : (
                <View style={[wlSt.gridRow, { flexWrap: 'wrap', gap: 8 }]}>
                  {watchlist.map((w, idx) => {
                    const isMovie = w.mediaType === 'movie';
                    const epSub = isMovie ? (lang === 'pt' ? 'Filme' : 'Movie') : (lang === 'pt' ? 'Série' : 'Series');
                    return (
                      <Pressable
                        key={`friend-wl-${w.id}-${idx}`}
                        onPress={() => onOpenSeries(w)}
                        style={[wlSt.gridCard, { width: col3Width }]}
                      >
                        <View style={profSt.cleanGridPoster}>
                          {w.posterPath ? (
                            <Image source={{ uri: posterUrl(w.posterPath) }} style={profSt.cleanGridPosterImg} resizeMode="cover" />
                          ) : (
                            <Text style={homeSt.fallbackPosterText}>{w.title.slice(0, 1)}</Text>
                          )}
                        </View>
                        <Text style={wlSt.gridTitle} numberOfLines={1}>{w.title}</Text>
                        <Text style={wlSt.gridSubtitle}>{epSub}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Friends Screen ──────────────────────────────────────────────────────────

function FriendsScreen({
  friends,
  allUsers,
  loadingUsers,
  currentUserId,
  onSendFriendRequest,
  onRespondFriendRequest,
  onRemoveFriendship,
  onRefreshUsers,
  onOpenSeries,
  lang,
}: {
  friends: Friendship[];
  allUsers: FriendProfile[];
  loadingUsers: boolean;
  currentUserId?: string;
  onSendFriendRequest: (targetUserId: string) => Promise<{ error?: string }>;
  onRespondFriendRequest: (friendshipId: string, accept: boolean) => Promise<void>;
  onRemoveFriendship: (friendshipId: string) => Promise<void>;
  onRefreshUsers: () => void;
  onOpenSeries: (item: Series | TmdbResult) => void;
  lang: Language;
}) {
  const t = i18n[lang];
  const [friendsTab, setFriendsTab] = useState<'my' | 'add' | 'requests'>('my');
  const [friendQuery, setFriendQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<FriendProfile | null>(null);

  useEffect(() => {
    onRefreshUsers();
  }, [friendsTab]);

  const acceptedFriends = friends.filter((f) => f.status === 'accepted');
  const pendingIncoming = friends.filter((f) => f.status === 'pending' && f.friendId === currentUserId);
  const pendingOutgoing = friends.filter((f) => f.status === 'pending' && f.userId === currentUserId);

  const filteredUsers = useMemo(() => {
    const q = friendQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return allUsers;
    return allUsers.filter((u) => {
      const matchUsername = u.username ? u.username.toLowerCase().includes(q) : false;
      const matchBio = u.bio ? u.bio.toLowerCase().includes(q) : false;
      return matchUsername || matchBio;
    });
  }, [allUsers, friendQuery]);

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={styles.libraryHeader}>
        <Text style={styles.pageTitle}>{t.friends}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => setFriendsTab(friendsTab === 'requests' ? 'my' : 'requests')}
            style={[
              wlSt.viewModeBtn,
              { flexDirection: 'row', alignItems: 'center', gap: 6 },
              friendsTab === 'requests' && { borderColor: C.gold, backgroundColor: C.surface2 },
            ]}
          >
            <Text
              style={[
                wlSt.viewModeIcon,
                friendsTab === 'requests' ? { color: C.gold } : { color: C.cream },
              ]}
            >
              {t.pendingRequests}
            </Text>
            {pendingIncoming.length > 0 && (
              <View style={[profSt.friendsBadge, { marginRight: 0 }]}>
                <Text style={profSt.friendsBadgeText}>{pendingIncoming.length}</Text>
              </View>
            )}
          </Pressable>

          <Pressable onPress={onRefreshUsers} style={wlSt.viewModeBtn}>
            <Text style={wlSt.viewModeIcon}>↻ {t.refresh}</Text>
          </Pressable>
        </View>
      </View>

      {/* Segmented Tabs */}
      <View style={profSt.friendsTabsRow}>
        <Pressable
          onPress={() => setFriendsTab('my')}
          style={[profSt.friendsTabBtn, friendsTab === 'my' && profSt.friendsTabBtnActive]}
        >
          <Text style={[profSt.friendsTabBtnText, friendsTab === 'my' && profSt.friendsTabBtnTextActive]}>
            {t.myFriends} ({acceptedFriends.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFriendsTab('add')}
          style={[profSt.friendsTabBtn, friendsTab === 'add' && profSt.friendsTabBtnActive]}
        >
          <Text style={[profSt.friendsTabBtnText, friendsTab === 'add' && profSt.friendsTabBtnTextActive]}>
            {t.addFriend} ({allUsers.length})
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}>
        {friendsTab === 'my' && (
          acceptedFriends.length === 0 ? (
            <View style={{ marginTop: 24, paddingHorizontal: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>👥</Text>
              <Empty text={t.noFriendsYet} />
              <Pressable
                onPress={() => setFriendsTab('add')}
                style={[styles.primaryButton, { paddingHorizontal: 24, marginTop: 16 }]}
              >
                <Text style={styles.primaryButtonText}>+ {t.findFriends}</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={acceptedFriends}
              keyExtractor={(f) => f.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item: f }) => {
                const prof = f.friendProfile;
                const uname = prof?.username ? `@${prof.username}` : (prof?.id ? `@user_${prof.id.slice(0, 6)}` : '@user');
                return (
                  <View style={profSt.friendCard}>
                    <Pressable
                      style={profSt.friendCardLeft}
                      onPress={() => setViewingProfile(prof || { id: f.friendId })}
                    >
                      <View style={profSt.friendAvatar}>
                        {prof?.avatarUrl ? (
                          <Image source={{ uri: prof.avatarUrl }} style={profSt.friendAvatarImg} />
                        ) : (
                          <Text style={{ fontSize: 18 }}>👤</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={profSt.friendUsername}>{uname}</Text>
                        {prof?.bio ? (
                          <Text style={profSt.friendBio} numberOfLines={1}>{prof.bio}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Pressable
                        onPress={() => setViewingProfile(prof || { id: f.friendId })}
                        style={profSt.friendActionBtnSecondary}
                      >
                        <Text style={profSt.friendActionBtnSecondaryText}>{t.viewProfile}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onRemoveFriendship(f.id)}
                        style={profSt.friendActionBtnSecondary}
                      >
                        <Text style={profSt.friendActionBtnSecondaryText}>{t.removeFriend}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )
        )}

        {friendsTab === 'add' && (
          <View style={{ flex: 1 }}>
            {/* Search bar */}
            <View style={[styles.searchBarContainer, { marginHorizontal: 0, marginTop: 0, marginBottom: 12 }]}>
              <SearchIcon size={16} color={C.bordeaux} />
              <TextInput
                value={friendQuery}
                onChangeText={setFriendQuery}
                placeholder={t.searchUsers}
                placeholderTextColor="#7e6060"
                autoCapitalize="none"
                style={styles.searchBarInput}
              />
              {loadingUsers ? (
                <ActivityIndicator size="small" color={C.gold} style={{ marginRight: 6 }} />
              ) : null}
              {friendQuery ? (
                <Pressable onPress={() => setFriendQuery('')} hitSlop={8} style={{ padding: 4 }}>
                  <Text style={{ color: C.muted, fontSize: 13, fontWeight: '700' }}>✕</Text>
                </Pressable>
              ) : null}
            </View>

            {filteredUsers.length === 0 && !loadingUsers ? (
              <View style={{ marginTop: 24 }}>
                <Empty
                  text={
                    friendQuery.trim()
                      ? (lang === 'pt'
                          ? `Nenhum utilizador encontrado com "${friendQuery}".`
                          : `No users found matching "${friendQuery}".`)
                      : (lang === 'pt'
                          ? 'Ainda não foram encontrados outros utilizadores na aplicação.'
                          : 'No other users found in the application yet.')
                  }
                />
              </View>
            ) : (
              <FlatList
                data={filteredUsers}
                keyExtractor={(u) => u.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                renderItem={({ item: u }) => {
                  const isFriend = acceptedFriends.some(
                    (f) => f.userId === u.id || f.friendId === u.id,
                  );
                  const isOutgoing = pendingOutgoing.some(
                    (f) => f.friendId === u.id,
                  );
                  const incomingReq = pendingIncoming.find(
                    (f) => f.userId === u.id,
                  );
                  const uname = u.username ? `@${u.username}` : `@user_${u.id.slice(0, 6)}`;

                  return (
                    <View style={profSt.friendCard}>
                      <Pressable
                        style={profSt.friendCardLeft}
                        onPress={() => setViewingProfile(u)}
                      >
                        <View style={profSt.friendAvatar}>
                          {u.avatarUrl ? (
                            <Image source={{ uri: u.avatarUrl }} style={profSt.friendAvatarImg} />
                          ) : (
                            <Text style={{ fontSize: 18 }}>👤</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={profSt.friendUsername}>{uname}</Text>
                          {u.bio ? (
                            <Text style={profSt.friendBio} numberOfLines={1}>{u.bio}</Text>
                          ) : null}
                        </View>
                      </Pressable>

                      {isFriend ? (
                        <Pressable
                          onPress={() => setViewingProfile(u)}
                          style={[profSt.friendActionBtnSecondary, { borderColor: C.gold }]}
                        >
                          <Text style={[profSt.friendActionBtnSecondaryText, { color: C.gold }]}>
                            ✓ {t.alreadyFriends}
                          </Text>
                        </Pressable>
                      ) : isOutgoing ? (
                        <View style={profSt.friendActionBtnSecondary}>
                          <Text style={profSt.friendActionBtnSecondaryText}>
                            ⌛ {t.requestSent}
                          </Text>
                        </View>
                      ) : incomingReq ? (
                        <Pressable
                          onPress={() => onRespondFriendRequest(incomingReq.id, true)}
                          style={profSt.friendActionBtn}
                        >
                          <Text style={profSt.friendActionBtnText}>✓ {t.accept}</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={async () => {
                            setSendingId(u.id);
                            try {
                              await onSendFriendRequest(u.id);
                            } finally {
                              setSendingId(null);
                            }
                          }}
                          disabled={sendingId === u.id}
                          style={profSt.friendActionBtn}
                        >
                          <Text style={profSt.friendActionBtnText}>
                            {sendingId === u.id ? '...' : `+ ${t.sendRequest}`}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}

        {friendsTab === 'requests' && (
          pendingIncoming.length === 0 ? (
            <View style={{ marginTop: 24 }}>
              <Empty text={t.noRequests} />
            </View>
          ) : (
            <FlatList
              data={pendingIncoming}
              keyExtractor={(f) => f.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item: f }) => {
                const prof = f.friendProfile;
                const uname = prof?.username ? `@${prof.username}` : (prof?.id ? `@user_${prof.id.slice(0, 6)}` : '@user');
                return (
                  <View style={profSt.friendCard}>
                    <Pressable
                      style={profSt.friendCardLeft}
                      onPress={() => setViewingProfile(prof || { id: f.userId })}
                    >
                      <View style={profSt.friendAvatar}>
                        {prof?.avatarUrl ? (
                          <Image source={{ uri: prof.avatarUrl }} style={profSt.friendAvatarImg} />
                        ) : (
                          <Text style={{ fontSize: 18 }}>👤</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={profSt.friendUsername}>{uname}</Text>
                        {prof?.bio ? (
                          <Text style={profSt.friendBio} numberOfLines={1}>{prof.bio}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable
                        onPress={() => onRespondFriendRequest(f.id, true)}
                        style={profSt.friendActionBtn}
                      >
                        <Text style={profSt.friendActionBtnText}>✓ {t.accept}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onRespondFriendRequest(f.id, false)}
                        style={profSt.friendActionBtnSecondary}
                      >
                        <Text style={profSt.friendActionBtnSecondaryText}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )
        )}
      </View>

      {viewingProfile ? (
        <FriendProfileModal
          user={viewingProfile}
          currentUserId={currentUserId}
          friendship={friends.find(
            (f) =>
              (f.userId === viewingProfile.id && f.friendId === currentUserId) ||
              (f.friendId === viewingProfile.id && f.userId === currentUserId),
          )}
          onClose={() => setViewingProfile(null)}
          onOpenSeries={onOpenSeries}
          onSendFriendRequest={onSendFriendRequest}
          onRespondFriendRequest={onRespondFriendRequest}
          onRemoveFriendship={onRemoveFriendship}
          lang={lang}
        />
      ) : null}
    </View>
  );
}

function Profile({
  library,
  watchlist,
  progress,
  lastWatched,
  open,
  avatar,
  banner,
  username,
  bio,
  email,
  onUploadAvatar,
  onUploadBanner,
  onRemoveBanner,
  onSaveProfile,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  onSignOut,
  lang,
  onChangeLang,
  onNavigateTab,
  friends = [],
  currentUserId,
  onSendFriendRequest,
  onRespondFriendRequest,
  onRemoveFriendship,
  onSearchUsers,
}: {
  library: Series[];
  watchlist: TmdbResult[];
  progress: (s: Series) => number;
  lastWatched: (s: Series) => number;
  open: (s: Series | TmdbResult) => void;
  avatar: string | null;
  banner: string | null;
  username: string;
  bio: string;
  email?: string;
  onUploadAvatar: (uri: string) => void;
  onUploadBanner: (uri: string) => void;
  onRemoveBanner: () => void;
  onSaveProfile: (username: string, bio: string) => Promise<void> | void;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onSignOut: () => void;
  lang: Language;
  onChangeLang: (l: Language) => void;
  onNavigateTab: (tab: Tab) => void;
  friends?: Friendship[];
  currentUserId?: string;
  onSendFriendRequest?: (targetUserId: string) => Promise<{ error?: string }>;
  onRespondFriendRequest?: (friendshipId: string, accept: boolean) => Promise<void>;
  onRemoveFriendship?: (friendshipId: string) => Promise<void>;
  onSearchUsers?: (query: string) => Promise<FriendProfile[]>;
}) {
  const { width } = useWindowDimensions();
  const safeWidth = width && width > 0 ? width : SCREEN_W;
  const padding = 24; // 12 on each side
  const gap = 8;
  // Guarantees AT LEAST 4 posters per row on any screen (scales to 5, 6, 8 on larger displays)
  const numCols = Math.max(4, Math.floor((safeWidth - padding + gap) / (76 + gap)));
  const colWidth = Math.floor((safeWidth - padding - gap * (numCols - 1)) / numCols);

  const t = i18n[lang];
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [draftUsername, setDraftUsername] = useState(username);
  const [draftBio, setDraftBio] = useState(bio);

  type ProfileTab = 'all' | 'watching' | 'watchlist' | 'watched';
  const [activeTab, setActiveTab] = useState<ProfileTab>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    setDraftUsername(username);
  }, [username]);

  useEffect(() => {
    setDraftBio(bio);
  }, [bio]);

  const acceptedFriends = useMemo(
    () => (friends || []).filter((f) => f.status === 'accepted'),
    [friends],
  );

  const isSeriesCompleted = (s: Series) => {
    if (s.collection === 'up_to_date') return true;
    if (s.mediaType === 'movie') return progress(s) >= 1;
    return progress(s) >= s.totalEpisodes && s.totalEpisodes > 0;
  };

  const completedSeries = useMemo(
    () => library.filter(isSeriesCompleted),
    [library],
  );

  const continueWatching = useMemo(
    () =>
      library
        .filter((s) => !isSeriesCompleted(s) && (progress(s) > 0 || s.collection === 'watching' || s.collection === 'finished_airing_to_continue'))
        .sort((a, b) => lastWatched(b) - lastWatched(a)),
    [library, progress, lastWatched],
  );

  const displayedUsername = username ? `@${username}` : (email ? `@${email.split('@')[0]}` : '@user');

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        alwaysBounceVertical={false}
        style={{ flex: 1, overscrollBehavior: 'none', overscrollBehaviorY: 'none' } as any}
      >
        {/* Top Banner with Settings Gear (Word "Perfil" removed as requested) */}
        <View style={profSt.cleanProfileBanner}>
          {banner ? (
            <Image source={{ uri: banner }} style={profSt.cleanProfileBannerImg} resizeMode="cover" />
          ) : (
            <View style={[profSt.cleanProfileBannerImg, { backgroundColor: '#161318' }]} />
          )}
          <View style={profSt.cleanBannerOverlay} pointerEvents="none" />

          {/* Header Controls Over Banner: Clean top-right gear button */}
          <View style={[profSt.headerRowOverBanner, {
            justifyContent: 'flex-end',
            position: 'absolute',
            top: (Platform.OS === 'web' ? 'max(18px, calc(env(safe-area-inset-top, 0px) + 12px))' : Platform.OS === 'ios' ? 50 : 18) as any,
            right: 0,
            left: 0,
            zIndex: 30,
          }]}>
            <Pressable onPress={onOpenSettings} style={profSt.gearButton} hitSlop={10}>
              <Text style={profSt.gearIcon}>⚙</Text>
            </Pressable>
          </View>
        </View>

        {/* Centered Circular Avatar with Gold Ring */}
        <View style={profSt.cleanAvatarContainer}>
          <View style={profSt.cleanAvatarRing}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={profSt.cleanAvatarImg} />
            ) : (
              <Text style={{ fontSize: 34 }}>👤</Text>
            )}
          </View>
        </View>

        {/* Centered Username & Bio */}
        <View style={{ alignItems: 'center', marginTop: 10, paddingHorizontal: 20 }}>
          <Text style={profSt.cleanUsername}>{displayedUsername}</Text>
          {bio ? (
            <Text style={profSt.cleanBio} numberOfLines={3}>{bio}</Text>
          ) : null}

          {/* Centered Action Pill (Editar Perfil) */}
          <View style={profSt.cleanPillRow}>
            <Pressable
              onPress={() => {
                setDraftUsername(username);
                setDraftBio(bio);
                setEditModalOpen(true);
              }}
              style={profSt.cleanStatusPill}
            >
              <Text style={profSt.cleanStatusPillText}>✎ {t.editProfile}</Text>
            </Pressable>
          </View>
        </View>

        {/* Clean Open Stats Row (Vistas | A Ver | Por Ver | Amigos) */}
        <View style={profSt.cleanStatsRow}>
          <Pressable onPress={() => setActiveTab('watched')} style={profSt.cleanStatCol}>
            <Text style={profSt.cleanStatNum}>{completedSeries.length}</Text>
            <Text style={profSt.cleanStatLbl}>{t.watched}</Text>
          </Pressable>
          <View style={profSt.cleanStatDivider} />
          <Pressable onPress={() => setActiveTab('watching')} style={profSt.cleanStatCol}>
            <Text style={profSt.cleanStatNum}>{continueWatching.length}</Text>
            <Text style={profSt.cleanStatLbl}>{t.currentlyWatching}</Text>
          </Pressable>
          <View style={profSt.cleanStatDivider} />
          <Pressable onPress={() => setActiveTab('watchlist')} style={profSt.cleanStatCol}>
            <Text style={profSt.cleanStatNum}>{watchlist.length}</Text>
            <Text style={profSt.cleanStatLbl}>{t.userWatchlist}</Text>
          </Pressable>
          <View style={profSt.cleanStatDivider} />
          <Pressable onPress={() => onNavigateTab('friends')} style={profSt.cleanStatCol}>
            <Text style={profSt.cleanStatNum}>{acceptedFriends.length}</Text>
            <Text style={profSt.cleanStatLbl}>{t.friends}</Text>
          </Pressable>
        </View>

        {/* Minimalist Text Tabs: Todas | A Ver | Por Ver | Visto */}
        <View style={profSt.cleanTabsRow}>
          <Pressable onPress={() => setActiveTab('all')} style={profSt.cleanTabPressable}>
            <Text style={[profSt.cleanTabText, activeTab === 'all' && profSt.cleanTabTextActive]}>
              {t.allSeries}
            </Text>
          </Pressable>
          <Text style={profSt.cleanTabSep}>|</Text>

          <Pressable onPress={() => setActiveTab('watching')} style={profSt.cleanTabPressable}>
            <Text style={[profSt.cleanTabText, activeTab === 'watching' && profSt.cleanTabTextActive]}>
              {t.currentlyWatching}
            </Text>
          </Pressable>
          <Text style={profSt.cleanTabSep}>|</Text>

          <Pressable onPress={() => setActiveTab('watchlist')} style={profSt.cleanTabPressable}>
            <Text style={[profSt.cleanTabText, activeTab === 'watchlist' && profSt.cleanTabTextActive]}>
              {t.userWatchlist}
            </Text>
          </Pressable>
          <Text style={profSt.cleanTabSep}>|</Text>

          <Pressable onPress={() => setActiveTab('watched')} style={profSt.cleanTabPressable}>
            <Text style={[profSt.cleanTabText, activeTab === 'watched' && profSt.cleanTabTextActive]}>
              {t.watched}
            </Text>
          </Pressable>
        </View>

        {/* View Mode Toggle Bar (Grelha de 4+ posters vs Linha) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 4, marginBottom: 12 }}>
          <Text style={{ color: C.muted, fontSize: 12.5, fontWeight: '700' }}>
            {activeTab === 'all'
              ? `${library.length} ${lang === 'pt' ? 'títulos' : 'titles'}`
              : activeTab === 'watching'
              ? `${continueWatching.length} ${lang === 'pt' ? 'a ver' : 'watching'}`
              : activeTab === 'watchlist'
              ? `${watchlist.length} ${lang === 'pt' ? 'por ver' : 'in watchlist'}`
              : `${completedSeries.length} ${lang === 'pt' ? 'vistos' : 'watched'}`}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 10, padding: 2, borderWidth: 1, borderColor: C.border }}>
            <Pressable
              onPress={() => setViewMode('grid')}
              style={[
                { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
                viewMode === 'grid' && { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.gold },
              ]}
            >
              <Text style={{ color: viewMode === 'grid' ? C.gold : C.muted, fontSize: 12, fontWeight: '700' }}>
                ▦ {lang === 'pt' ? 'Grelha' : 'Grid'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('list')}
              style={[
                { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
                viewMode === 'list' && { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.gold },
              ]}
            >
              <Text style={{ color: viewMode === 'list' ? C.gold : C.muted, fontSize: 12, fontWeight: '700' }}>
                ☰ {lang === 'pt' ? 'Linha' : 'List'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Content: Grid (at least 4 posters per row) OR List (full horizontal cards) */}
        <View style={{ paddingHorizontal: 12 }}>
          {activeTab === 'all' ? (
            library.length === 0 ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📺</Text>
                <Empty text={t.noCompletedSeries} />
              </View>
            ) : viewMode === 'grid' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {library.map((s, idx) => {
                  const watched = progress(s);
                  const isMovie = s.mediaType === 'movie';
                  const isDone = isSeriesCompleted(s);
                  const badgeText = isMovie
                    ? (watched > 0 ? (lang === 'pt' ? 'Filme · Visto' : 'Movie · Watched') : (lang === 'pt' ? 'Filme' : 'Movie'))
                    : (s.totalEpisodes > 0 ? `${watched}/${s.totalEpisodes}` : `${watched} eps`);
                  const epSub = isMovie
                    ? (watched > 0 ? (lang === 'pt' ? 'Filme · Visto' : 'Movie · Watched') : (lang === 'pt' ? 'Filme' : 'Movie'))
                    : (s.totalEpisodes > 0 ? `${watched}/${s.totalEpisodes} eps${isDone ? ' ✓' : ''}` : `${watched} eps`);
                  return (
                    <Pressable
                      key={`prof-grid-all-${s.mediaType}-${s.tmdbId ?? s.title}-${idx}`}
                      onPress={() => open(s)}
                      style={{ width: colWidth, alignItems: 'center', marginBottom: 12 }}
                    >
                      <View style={profSt.cleanGridPoster}>
                        {s.posterPath ? (
                          <Image source={{ uri: posterUrl(s.posterPath) }} style={profSt.cleanGridPosterImg} resizeMode="cover" />
                        ) : (
                          <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                        )}
                        <View style={[wlSt.gridEpBadge, isDone && { borderColor: '#2E7D32' }]}>
                          <Text style={[wlSt.gridEpBadgeText, isDone && { color: '#68D391' }]}>{badgeText}</Text>
                        </View>
                      </View>
                      <Text style={wlSt.gridTitle} numberOfLines={1}>{s.title}</Text>
                      <Text style={[wlSt.gridSubtitle, isDone && { color: '#68D391' }]}>{epSub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.list}>
                {library.map((s, idx) => (
                  <SeriesRow
                    key={`prof-list-all-${s.mediaType}-${s.tmdbId ?? s.title}-${idx}`}
                    series={s}
                    watched={progress(s)}
                    press={() => open(s)}
                    collectionLabel={s.mediaType === 'movie' ? (lang === 'pt' ? 'Filme' : 'Movie') : (lang === 'pt' ? 'Série' : 'Series')}
                    t={t}
                    lang={lang}
                  />
                ))}
              </View>
            )
          ) : activeTab === 'watching' ? (
            continueWatching.length === 0 ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🎬</Text>
                <Empty text={t.noWatchingSeries} />
              </View>
            ) : viewMode === 'grid' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {continueWatching.map((s, idx) => {
                  const watched = progress(s);
                  const isMovie = s.mediaType === 'movie';
                  const badgeText = isMovie
                    ? (lang === 'pt' ? 'Filme' : 'Movie')
                    : (s.totalEpisodes > 0 ? `${watched}/${s.totalEpisodes}` : `${watched} eps`);
                  const epSub = isMovie
                    ? (lang === 'pt' ? 'Filme' : 'Movie')
                    : (s.totalEpisodes > 0 ? `${watched}/${s.totalEpisodes} eps` : `${watched} eps`);
                  return (
                    <Pressable
                      key={`prof-grid-watching-${s.mediaType}-${s.tmdbId ?? s.title}-${idx}`}
                      onPress={() => open(s)}
                      style={{ width: colWidth, alignItems: 'center', marginBottom: 12 }}
                    >
                      <View style={profSt.cleanGridPoster}>
                        {s.posterPath ? (
                          <Image source={{ uri: posterUrl(s.posterPath) }} style={profSt.cleanGridPosterImg} resizeMode="cover" />
                        ) : (
                          <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                        )}
                        <View style={wlSt.gridEpBadge}>
                          <Text style={wlSt.gridEpBadgeText}>{badgeText}</Text>
                        </View>
                      </View>
                      <Text style={wlSt.gridTitle} numberOfLines={1}>{s.title}</Text>
                      <Text style={wlSt.gridSubtitle}>{epSub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.list}>
                {continueWatching.map((s, idx) => (
                  <SeriesRow
                    key={`prof-list-watching-${s.mediaType}-${s.tmdbId ?? s.title}-${idx}`}
                    series={s}
                    watched={progress(s)}
                    press={() => open(s)}
                    collectionLabel={s.mediaType === 'movie' ? (lang === 'pt' ? 'Filme' : 'Movie') : (lang === 'pt' ? 'A Ver' : 'Watching')}
                    t={t}
                    lang={lang}
                  />
                ))}
              </View>
            )
          ) : activeTab === 'watchlist' ? (
            watchlist.length === 0 ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🔖</Text>
                <Empty text={t.noWatchlistItems} />
              </View>
            ) : viewMode === 'grid' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {watchlist.map((w, idx) => {
                  const isMovie = w.mediaType === 'movie';
                  const epSub = isMovie ? (lang === 'pt' ? 'Filme' : 'Movie') : (lang === 'pt' ? 'Série' : 'Series');
                  return (
                    <Pressable
                      key={`prof-grid-wl-${w.id}-${idx}`}
                      onPress={() => open(w)}
                      style={{ width: colWidth, alignItems: 'center', marginBottom: 12 }}
                    >
                      <View style={profSt.cleanGridPoster}>
                        {w.posterPath ? (
                          <Image source={{ uri: posterUrl(w.posterPath) }} style={profSt.cleanGridPosterImg} resizeMode="cover" />
                        ) : (
                          <Text style={homeSt.fallbackPosterText}>{w.title.slice(0, 1)}</Text>
                        )}
                      </View>
                      <Text style={wlSt.gridTitle} numberOfLines={1}>{w.title}</Text>
                      <Text style={wlSt.gridSubtitle}>{epSub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.list}>
                {watchlist.map((w, idx) => {
                  const isMovie = w.mediaType === 'movie';
                  return (
                    <Pressable
                      key={`prof-list-wl-${w.id}-${idx}`}
                      style={styles.seriesRow}
                      onPress={() => open(w)}
                    >
                      <PosterThumb posterPath={w.posterPath} title={w.title} size="sm" />
                      <View style={styles.rowBody}>
                        <Text style={styles.rowTitle}>{w.title}</Text>
                        <Text style={styles.rowMeta}>{isMovie ? (lang === 'pt' ? 'Filme' : 'Movie') : (lang === 'pt' ? 'Série' : 'Series')}</Text>
                        {w.overview ? (
                          <Text style={[styles.rowMeta, { color: C.muted, marginTop: 4 }]} numberOfLines={2}>{w.overview}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )
          ) : (
            completedSeries.length === 0 ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🏆</Text>
                <Empty text={t.noCompletedSeries} />
              </View>
            ) : viewMode === 'grid' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {completedSeries.map((s, idx) => {
                  const isMovie = s.mediaType === 'movie';
                  const epSub = isMovie
                    ? (lang === 'pt' ? 'Filme · Visto' : 'Movie · Watched')
                    : `${s.totalEpisodes}/${s.totalEpisodes} eps ✓`;
                  const badgeText = isMovie ? (lang === 'pt' ? 'Filme' : 'Movie') : `${s.totalEpisodes}/${s.totalEpisodes}`;
                  return (
                    <Pressable
                      key={`prof-grid-comp-${s.mediaType}-${s.tmdbId ?? s.title}-${idx}`}
                      onPress={() => open(s)}
                      style={{ width: colWidth, alignItems: 'center', marginBottom: 12 }}
                    >
                      <View style={profSt.cleanGridPoster}>
                        {s.posterPath ? (
                          <Image source={{ uri: posterUrl(s.posterPath) }} style={profSt.cleanGridPosterImg} resizeMode="cover" />
                        ) : (
                          <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                        )}
                        <View style={[wlSt.gridEpBadge, { borderColor: '#2E7D32' }]}>
                          <Text style={[wlSt.gridEpBadgeText, { color: '#68D391' }]}>{badgeText}</Text>
                        </View>
                      </View>
                      <Text style={wlSt.gridTitle} numberOfLines={1}>{s.title}</Text>
                      <Text style={[wlSt.gridSubtitle, { color: '#68D391' }]}>{epSub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.list}>
                {completedSeries.map((s, idx) => (
                  <SeriesRow
                    key={`prof-list-comp-${s.mediaType}-${s.tmdbId ?? s.title}-${idx}`}
                    series={s}
                    watched={s.totalEpisodes}
                    press={() => open(s)}
                    collectionLabel={s.mediaType === 'movie' ? (lang === 'pt' ? 'Filme · Concluído' : 'Movie · Completed') : (lang === 'pt' ? 'Série · Concluída' : 'Series · Completed')}
                    t={t}
                    lang={lang}
                  />
                ))}
              </View>
            )
          )}
        </View>

        {/* App Version Footer */}
        <View style={profSt.versionFooter}>
          <Text style={profSt.versionText}>{t.versionText}</Text>
        </View>
      </ScrollView>

      
      {/* Settings Modal (Language, Photo/Cover Customization & Sign out) */}
      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={onCloseSettings}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { maxHeight: '88%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.modalTitle}>{t.settings}</Text>

              {/* Photo & Cover Customization */}
              <Text style={profSt.settingsSectionLabel}>{t.profileCustomization}</Text>
              <View style={profSt.settingsMediaRow}>
                {/* Photo / Avatar Section */}
                <View style={profSt.settingsMediaCard}>
                  <Text style={profSt.settingsMediaTitle}>👤 {t.profilePhoto}</Text>
                  <AvatarPicker
                    avatar={avatar}
                    onPick={onUploadAvatar}
                    label={avatar ? t.changePhoto : t.addPhoto}
                    lang={lang}
                  />
                </View>

                {/* Cover Banner Section */}
                <View style={profSt.settingsMediaCard}>
                  <Text style={profSt.settingsMediaTitle}>🖼 {t.coverImage}</Text>
                  <BannerPicker
                    banner={banner}
                    onPick={onUploadBanner}
                    onRemove={onRemoveBanner}
                    lang={lang}
                  />
                </View>
              </View>

              {/* Language Selector */}
              <Text style={profSt.settingsSectionLabel}>{t.language}</Text>
              <View style={profSt.langRow}>
                <Pressable
                  onPress={() => onChangeLang('pt')}
                  style={[profSt.langBtn, lang === 'pt' && profSt.langBtnActive]}
                >
                  <Text style={[profSt.langBtnText, lang === 'pt' && profSt.langBtnTextActive]}>
                    🇵🇹 Português (PT)
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => onChangeLang('en')}
                  style={[profSt.langBtn, lang === 'en' && profSt.langBtnActive]}
                >
                  <Text style={[profSt.langBtnText, lang === 'en' && profSt.langBtnTextActive]}>
                    🇬🇧 English
                  </Text>
                </Pressable>
              </View>

              {/* Account Info & Sign Out */}
              {email ? (
                <View style={{ marginTop: 20 }}>
                  <Text style={profSt.accountEmail}>{email}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 6 }} />
                    <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '600' }}>
                      {lang === 'pt' ? 'Sincronizado na Nuvem' : 'Cloud Synced'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      onCloseSettings();
                      onSignOut();
                    }}
                    style={profSt.signOutButton}
                  >
                    <Text style={profSt.signOutText}>{t.signOut}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ marginTop: 20 }}>
                  <Text style={profSt.accountEmail}>{t.notSignedIn}</Text>
                  <Pressable
                    onPress={() => {
                      onCloseSettings();
                      onSignOut();
                    }}
                    style={[profSt.signOutButton, { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.gold }]}
                  >
                    <Text style={[profSt.signOutText, { color: C.gold }]}>{t.signInTab}</Text>
                  </Pressable>
                </View>
              )}

              <Pressable onPress={onCloseSettings} style={{ marginTop: 22, alignSelf: 'center', paddingVertical: 6 }}>
                <Text style={styles.cancel}>{t.close}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal (Username & Bio) */}
      <Modal visible={editModalOpen} animationType="slide" transparent onRequestClose={() => setEditModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { minHeight: 330 }]}>
            <Text style={styles.modalTitle}>{t.editProfile}</Text>

            <Text style={profSt.inputLabel}>{t.username}</Text>
            <TextInput
              value={draftUsername}
              onChangeText={setDraftUsername}
              placeholder={t.usernamePlaceholder}
              placeholderTextColor="#7e6060"
              autoCapitalize="none"
              autoCorrect={false}
              style={profSt.textInput}
            />

            <Text style={[profSt.inputLabel, { marginTop: 14 }]}>{t.bio}</Text>
            <TextInput
              value={draftBio}
              onChangeText={setDraftBio}
              placeholder={t.bioPlaceholder}
              placeholderTextColor="#7e6060"
              multiline
              numberOfLines={3}
              style={[profSt.textInput, profSt.bioInput]}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
              <Pressable
                onPress={() => setEditModalOpen(false)}
                style={[styles.primaryButton, { flex: 1, marginTop: 0, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }]}
              >
                <Text style={[styles.primaryButtonText, { color: C.muted }]}>{t.cancel}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  onSaveProfile(draftUsername, draftBio);
                  setEditModalOpen(false);
                }}
                style={[styles.primaryButton, { flex: 1, marginTop: 0 }]}
              >
                <Text style={styles.primaryButtonText}>{t.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Destination Slider (Library <-> Watchlist) ──────────────────────────────

const CONFETTI_PIECES = [
  { emoji: '🎉', dx: -85, dy: -65, rot: -45 },
  { emoji: '✨', dx: -55, dy: -95, rot: 25 },
  { emoji: '🍿', dx: -15, dy: -110, rot: -10 },
  { emoji: '⭐', dx: 30, dy: -110, rot: 35 },
  { emoji: '🎊', dx: 70, dy: -90, rot: 60 },
  { emoji: '🎬', dx: 95, dy: -60, rot: -20 },
  { emoji: '✨', dx: -70, dy: -35, rot: 40 },
  { emoji: '🎉', dx: 65, dy: -35, rot: -30 },
];

function DestinationSlider({
  state,
  onChange,
  lang,
}: {
  state: 'library' | 'watchlist' | 'none';
  onChange: (dest: 'library' | 'watchlist' | 'none') => void;
  lang: Language;
}) {
  const t = i18n[lang];
  const [trackWidth, setTrackWidth] = useState(306);

  const padding = 3;
  const innerWidth = Math.max(90, trackWidth - padding * 2);
  const slotWidth = innerWidth / 3;

  // 3 Target positions for the sliding pill: 0 (library), slotWidth (none), slotWidth * 2 (watchlist)
  const getTargetX = (st: 'library' | 'watchlist' | 'none') => {
    if (st === 'library') return 0;
    if (st === 'watchlist') return slotWidth * 2;
    return slotWidth;
  };

  const targetX = getTargetX(state);
  const translateX = useRef(new Animated.Value(targetX)).current;
  const isDragging = useRef(false);
  const dragStart = useRef(targetX);

  const confettiAnim = useRef(new Animated.Value(0)).current;

  const triggerConfetti = () => {
    confettiAnim.setValue(0);
    Animated.timing(confettiAnim, {
      toValue: 1,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  useEffect(() => {
    if (!isDragging.current) {
      Animated.spring(translateX, {
        toValue: getTargetX(state),
        friction: 7,
        tension: 65,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }
  }, [state, slotWidth]);

  const handleSlotPress = (dest: 'library' | 'watchlist' | 'none') => {
    isDragging.current = false;
    const nextTarget = getTargetX(dest);
    Animated.spring(translateX, {
      toValue: nextTarget,
      friction: 7,
      tension: 65,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    if (state !== dest) {
      if (dest === 'library' || dest === 'watchlist') {
        triggerConfetti();
      }
      onChange(dest);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4,
        onPanResponderGrant: () => {
          isDragging.current = true;
          dragStart.current = getTargetX(state);
        },
        onPanResponderMove: (_e, gestureState) => {
          const nextPos = Math.max(0, Math.min(slotWidth * 2, dragStart.current + gestureState.dx));
          translateX.setValue(nextPos);
        },
        onPanResponderRelease: (_e, gestureState) => {
          isDragging.current = false;
          const currentPos = Math.max(0, Math.min(slotWidth * 2, dragStart.current + gestureState.dx));
          const vx = gestureState.vx ?? 0;

          let nextDest: 'library' | 'watchlist' | 'none' = state;

          if (state === 'library') {
            if (vx > 0.8 || currentPos > slotWidth * 1.4) {
              nextDest = 'watchlist';
            } else if (vx > 0.2 || currentPos > slotWidth * 0.3) {
              nextDest = 'none';
            } else {
              nextDest = 'library';
            }
          } else if (state === 'watchlist') {
            if (vx < -0.8 || currentPos < slotWidth * 0.6) {
              nextDest = 'library';
            } else if (vx < -0.2 || currentPos < slotWidth * 1.7) {
              nextDest = 'none';
            } else {
              nextDest = 'watchlist';
            }
          } else {
            // state === 'none' (center)
            if (vx < -0.2 || currentPos < slotWidth * 0.7) {
              nextDest = 'library';
            } else if (vx > 0.2 || currentPos > slotWidth * 1.3) {
              nextDest = 'watchlist';
            } else {
              nextDest = 'none';
            }
          }

          handleSlotPress(nextDest);
        },
        onPanResponderTerminate: () => {
          isDragging.current = false;
          Animated.spring(translateX, {
            toValue: getTargetX(state),
            friction: 7,
            tension: 65,
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
        },
      }),
    [state, slotWidth, onChange],
  );

  // Watchlist: barra fica amarela (#D49B20 / #F5C518)
  // Biblioteca: barra fica vermelha bordeux (#8B1A2E / #A6223B)
  // None: neutro (#1E1417 / #3D262C)
  const trackBgColor =
    state === 'library'
      ? '#8B1A2E'
      : state === 'watchlist'
      ? '#D49B20'
      : '#1E1417';

  const trackBorderColor =
    state === 'library'
      ? '#A6223B'
      : state === 'watchlist'
      ? '#F5C518'
      : '#3D262C';

  // Text inside the sliding active ball/pill
  const pillLabel =
    state === 'library'
      ? `📚 ${t.library}`
      : state === 'watchlist'
      ? `⭐ ${t.watchlist}`
      : `✕ ${lang === 'pt' ? 'Remover' : 'Remove'}`;

  // Text color inside the white ball/pill
  const pillTextColor =
    state === 'library'
      ? '#8B1A2E'
      : state === 'watchlist'
      ? '#7A5200'
      : '#4A2028';

  // Color for inactive slot labels on the track
  const inactiveTextColor =
    state === 'watchlist'
      ? 'rgba(40, 26, 5, 0.75)'
      : 'rgba(255, 230, 235, 0.65)';

  return (
    <View style={sliderSt.container}>
      {/* Celebratory Confetti Burst */}
      <View pointerEvents="none" style={sliderSt.confettiLayer}>
        {CONFETTI_PIECES.map((p, idx) => (
          <Animated.View
            key={idx}
            style={[
              sliderSt.confettiItem,
              {
                opacity: confettiAnim.interpolate({
                  inputRange: [0, 0.1, 0.7, 1],
                  outputRange: [0, 1, 0.85, 0],
                }),
                transform: [
                  {
                    translateX: confettiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, p.dx],
                    }),
                  },
                  {
                    translateY: confettiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, p.dy],
                    }),
                  },
                  {
                    scale: confettiAnim.interpolate({
                      inputRange: [0, 0.25, 0.7, 1],
                      outputRange: [0.2, 1.35, 1, 0.2],
                    }),
                  },
                  {
                    rotate: confettiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${p.rot * 4}deg`],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={sliderSt.confettiEmoji}>{p.emoji}</Text>
          </Animated.View>
        ))}
      </View>

      <View
        style={[
          sliderSt.track,
          {
            backgroundColor: trackBgColor,
            borderColor: trackBorderColor,
          },
        ]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setTrackWidth(w);
        }}
        {...panResponder.panHandlers}
      >
        {/* Animated Sliding Pill with the word written inside */}
        <Animated.View
          style={[
            sliderSt.slidingPill,
            {
              width: slotWidth,
              transform: [{ translateX }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[sliderSt.pillText, { color: pillTextColor }]} numberOfLines={1}>
            {pillLabel}
          </Text>
        </Animated.View>

        {/* 3 Clickable Track Slots on top of the pill */}
        <Pressable
          onPress={() => handleSlotPress('library')}
          style={[sliderSt.slot, { width: slotWidth }]}
          hitSlop={8}
        >
          <Text
            style={[
              sliderSt.slotText,
              { color: inactiveTextColor },
              state === 'library' && { opacity: 0 },
            ]}
            numberOfLines={1}
          >
            📚 {t.library}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleSlotPress('none')}
          style={[sliderSt.slot, { width: slotWidth }]}
          hitSlop={8}
        >
          <Text
            style={[
              sliderSt.slotText,
              { color: inactiveTextColor },
              state === 'none' && { opacity: 0 },
            ]}
            numberOfLines={1}
          >
            ✕ {lang === 'pt' ? 'Remover' : 'Remove'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleSlotPress('watchlist')}
          style={[sliderSt.slot, { width: slotWidth }]}
          hitSlop={8}
        >
          <Text
            style={[
              sliderSt.slotText,
              { color: inactiveTextColor },
              state === 'watchlist' && { opacity: 0 },
            ]}
            numberOfLines={1}
          >
            ⭐ {t.watchlist}
          </Text>
        </Pressable>
      </View>

     
    </View>
  );
}

// ─── Series & Movie Detail Modal ──────────────────────────────────────────────

function SeriesDetailModal({
  item,
  library,
  watchlist,
  personal,
  onClose,
  onAddToLibrary,
  onRemoveFromLibrary,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onUpdatePersonal,
  lang,
}: {
  item: Series | TmdbResult;
  library: Series[];
  watchlist: TmdbResult[];
  personal: PersonalData;
  progress: number;
  onClose: () => void;
  onAddToLibrary: (tmdbItem: TmdbResult, initialPersonal?: PersonalData) => void;
  onRemoveFromLibrary: () => void;
  onAddToWatchlist: (tmdbItem: TmdbResult) => void;
  onRemoveFromWatchlist: (tmdbItem: TmdbResult) => void;
  onUpdatePersonal: (changes: PersonalData) => void;
  lang: Language;
}) {
  const t = i18n[lang];

  const tmdbId = 'tmdbId' in item ? item.tmdbId : ('id' in item ? item.id : undefined);
  const mediaType: 'series' | 'movie' = item.mediaType ?? 'series';

  const inLibrary = library.some((s) =>
    (tmdbId && s.tmdbId === tmdbId) ||
    (s.title && s.title.trim().toLowerCase() === item.title.trim().toLowerCase())
  );
  const inWatchlist = watchlist.some((w) =>
    (tmdbId && w.id === tmdbId) ||
    (w.title && w.title.trim().toLowerCase() === item.title.trim().toLowerCase())
  );

  const destinationState: 'library' | 'watchlist' | 'none' = inLibrary
    ? 'library'
    : inWatchlist
    ? 'watchlist'
    : 'none';

  const [details, setDetails] = useState<{
    overview?: string;
    backdropPath?: string;
    posterPath?: string;
    totalEpisodes?: number;
    seasons: TmdbSeasonInfo[];
  }>({
    overview: item.overview,
    posterPath: item.posterPath,
    seasons: [],
  });

  const [selectedSeason, setSelectedSeason] = useState<number | 'all'>('all');
  const [seasonEpisodes, setSeasonEpisodes] = useState<Record<number, TmdbEpisodeInfo[]>>({});
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  useEffect(() => {
    setOverviewExpanded(false);
  }, [tmdbId]);

  // Fetch full details (seasons, backdrop, overview)
  useEffect(() => {
    if (!tmdbId) return;
    fetchItemDetails(tmdbId, mediaType, lang === 'pt' ? 'pt-PT' : 'en-US').then((res) => {
      setDetails({
        overview: res.overview || item.overview,
        backdropPath: res.backdropPath,
        posterPath: res.posterPath || item.posterPath,
        totalEpisodes: res.totalEpisodes,
        seasons: res.seasons,
      });
      if (res.seasons.length > 0 && selectedSeason === 'all') {
        setSelectedSeason(res.seasons[0].seasonNumber);
      }
    });
  }, [tmdbId, mediaType, lang]);

  // Load episodes when season changes (only for series)
  useEffect(() => {
    if (!tmdbId || mediaType !== 'series' || selectedSeason === 'all') return;
    if (seasonEpisodes[selectedSeason]) return; // already loaded

    setLoadingEpisodes(true);
    fetchSeasonEpisodes(tmdbId, selectedSeason, lang === 'pt' ? 'pt-PT' : 'en-US')
      .then((eps) => {
        setSeasonEpisodes((prev) => ({ ...prev, [selectedSeason]: eps }));
      })
      .finally(() => setLoadingEpisodes(false));
  }, [tmdbId, selectedSeason, mediaType, lang]);

  // Watched episodes set
  const watchedEpSet = useMemo(() => new Set(personal.watchedEpList || []), [personal.watchedEpList]);

  // Toggle episode watched for series
  const toggleEpisodeWatched = (seasonNum: number, epNum: number) => {
    const epKey = `S${seasonNum}E${epNum}`;
    const nextList = new Set(watchedEpSet);
    if (nextList.has(epKey)) {
      nextList.delete(epKey);
    } else {
      nextList.add(epKey);
    }
    const arr = Array.from(nextList);
    const newCount = arr.filter((k) => k !== 'MOVIE').length;
    const newPersonal: PersonalData = {
      ...personal,
      watchedEpList: arr,
      watchedEpisodes: newCount,
      lastWatched: Date.now(),
    };

    onUpdatePersonal(newPersonal);

    if (destinationState !== 'library') {
      handleDestinationChange('library', newPersonal);
    }
  };

  // Check if a season is fully watched
  const isSeasonFullyWatched = (sNum: number) => {
    const sInfo = details.seasons.find((s) => s.seasonNumber === sNum);
    const count = seasonEpisodes[sNum]?.length ?? sInfo?.episodeCount ?? 0;
    if (count === 0) return false;
    for (let i = 1; i <= count; i++) {
      if (!watchedEpSet.has(`S${sNum}E${i}`)) return false;
    }
    return true;
  };

  // Watched count for a season
  const seasonWatchedCount = (sNum: number) => {
    const sInfo = details.seasons.find((s) => s.seasonNumber === sNum);
    const count = seasonEpisodes[sNum]?.length ?? sInfo?.episodeCount ?? 0;
    let watched = 0;
    for (let i = 1; i <= count; i++) {
      if (watchedEpSet.has(`S${sNum}E${i}`)) watched++;
    }
    return watched;
  };

  // Toggle all episodes in a season
  const toggleSeasonWatched = (sNum: number) => {
    const sInfo = details.seasons.find((s) => s.seasonNumber === sNum);
    const eps = seasonEpisodes[sNum];
    const count = eps?.length ?? sInfo?.episodeCount ?? 0;
    if (count === 0) return;

    const alreadyWatched = isSeasonFullyWatched(sNum);
    const nextList = new Set(watchedEpSet);

    for (let i = 1; i <= count; i++) {
      const key = `S${sNum}E${i}`;
      if (alreadyWatched) {
        nextList.delete(key);
      } else {
        nextList.add(key);
      }
    }
    if (eps) {
      for (const ep of eps) {
        const key = `S${sNum}E${ep.episodeNumber}`;
        if (alreadyWatched) {
          nextList.delete(key);
        } else {
          nextList.add(key);
        }
      }
    }

    const arr = Array.from(nextList);
    const newCount = arr.filter((k) => k !== 'MOVIE').length;
    const newPersonal: PersonalData = {
      ...personal,
      watchedEpList: arr,
      watchedEpisodes: newCount,
      lastWatched: Date.now(),
    };

    onUpdatePersonal(newPersonal);

    if (destinationState !== 'library') {
      handleDestinationChange('library', newPersonal);
    }
  };

  // Check if entire series is fully watched
  const isSeriesFullyWatched = useMemo(() => {
    if (details.seasons.length === 0) return false;
    for (const s of details.seasons) {
      if (s.seasonNumber === 0) continue; // Skip specials
      const count = seasonEpisodes[s.seasonNumber]?.length ?? s.episodeCount;
      if (count === 0) continue;
      for (let i = 1; i <= count; i++) {
        if (!watchedEpSet.has(`S${s.seasonNumber}E${i}`)) return false;
      }
    }
    return true;
  }, [details.seasons, seasonEpisodes, watchedEpSet]);

  // Toggle all episodes across all seasons
  const toggleEntireSeriesWatched = () => {
    const nextList = new Set(watchedEpSet);
    const alreadyWatched = isSeriesFullyWatched;

    for (const s of details.seasons) {
      if (s.seasonNumber === 0) continue; // Skip specials
      const eps = seasonEpisodes[s.seasonNumber];
      const count = eps?.length ?? s.episodeCount;
      for (let i = 1; i <= count; i++) {
        const key = `S${s.seasonNumber}E${i}`;
        if (alreadyWatched) {
          nextList.delete(key);
        } else {
          nextList.add(key);
        }
      }
      if (eps) {
        for (const ep of eps) {
          const key = `S${s.seasonNumber}E${ep.episodeNumber}`;
          if (alreadyWatched) {
            nextList.delete(key);
          } else {
            nextList.add(key);
          }
        }
      }
    }

    const arr = Array.from(nextList);
    const newCount = arr.filter((k) => k !== 'MOVIE').length;
    const newPersonal: PersonalData = {
      ...personal,
      watchedEpList: arr,
      watchedEpisodes: newCount,
      lastWatched: Date.now(),
    };

    onUpdatePersonal(newPersonal);

    if (destinationState !== 'library') {
      handleDestinationChange('library', newPersonal);
    }
  };

  // Toggle watched for Movie
  const isMovieWatched = watchedEpSet.has('MOVIE');
  const toggleMovieWatched = () => {
    if (destinationState !== 'library') {
      handleDestinationChange('library');
    }
    const nextList = new Set(watchedEpSet);
    if (nextList.has('MOVIE')) {
      nextList.delete('MOVIE');
    } else {
      nextList.add('MOVIE');
    }
    const arr = Array.from(nextList);
    onUpdatePersonal({
      watchedEpList: arr,
      watchedEpisodes: arr.includes('MOVIE') ? 1 : 0,
      lastWatched: Date.now(),
    });
  };

  const handleDestinationChange = (newDest: 'library' | 'watchlist' | 'none', customPersonal?: PersonalData) => {
    if (newDest === destinationState) return;

    if (newDest === 'library') {
      if (inWatchlist) {
        onRemoveFromWatchlist({
          id: tmdbId ?? 0,
          mediaType,
          title: item.title,
        });
      }
      onAddToLibrary({
        id: tmdbId ?? 0,
        mediaType,
        title: item.title,
        posterPath: details.posterPath || item.posterPath,
        overview: details.overview || item.overview,
        totalEpisodes: details.totalEpisodes,
      }, customPersonal);
    } else if (newDest === 'watchlist') {
      if (inLibrary) {
        onRemoveFromLibrary();
      }
      onAddToWatchlist({
        id: tmdbId ?? 0,
        mediaType,
        title: item.title,
        posterPath: details.posterPath || item.posterPath,
        overview: details.overview || item.overview,
      });
    } else {
      // 'none' - user slid or tapped to neutral
      if (inLibrary) {
        onRemoveFromLibrary();
      }
      if (inWatchlist) {
        onRemoveFromWatchlist({
          id: tmdbId ?? 0,
          mediaType,
          title: item.title,
        });
      }
    }
  };

  const currentPoster = details.posterPath || item.posterPath;
  const currentBackdrop = details.backdropPath || currentPoster;

  return (
    <View style={detailSt.fullscreen}>
      {/* Blurred Backdrop Background */}
      {currentBackdrop ? (
        <Image
          source={{ uri: posterUrl(currentBackdrop, 'w780') }}
          style={detailSt.backdropBg}
          blurRadius={22}
        />
      ) : null}
      <View style={detailSt.backdropOverlay} />

      <ScrollView
        contentContainerStyle={detailSt.scrollContainer}
        showsVerticalScrollIndicator={false}
        overScrollMode="always"
        bounces
      >
        {/* Back Button */}
        <Pressable onPress={onClose} style={detailSt.backBtn}>
          <Text style={detailSt.backText}>‹ {t.close}</Text>
        </Pressable>

        {/* Center Vertical Poster */}
        <View style={detailSt.posterWrapper}>
          {currentPoster ? (
            <Image
              source={{ uri: posterUrl(currentPoster, 'w500') }}
              style={detailSt.mainPoster}
              resizeMode="cover"
            />
          ) : (
            <View style={detailSt.posterPlaceholder}>
              <Text style={homeSt.fallbackPosterText}>{item.title.slice(0, 1)}</Text>
            </View>
          )}
        </View>

        {/* Centered Title */}
        <Text style={detailSt.titleCenter}>{item.title}</Text>

        {/* Synopsis / Overview (collapsible if long) */}
        {(() => {
          const rawOverview = details.overview || item.overview || '';
          const isLongOverview = rawOverview.length > 140;
          return (
            <View style={detailSt.overviewWrapper}>
              <Text
                style={detailSt.overviewText}
                numberOfLines={!isLongOverview || overviewExpanded ? undefined : 3}
              >
                {rawOverview || t.noOverview}
              </Text>
              {isLongOverview ? (
                <Pressable
                  onPress={() => setOverviewExpanded((prev) => !prev)}
                  style={detailSt.seeMoreBtn}
                  hitSlop={8}
                >
                  <Text style={detailSt.seeMoreText}>
                    {overviewExpanded ? `▴ ${t.showLess}` : `▾ ${t.showMore}`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })()}

        {/* Interactive Drag & Tap Destination Slider: Left (Library) vs Right (Watchlist) vs Center (None) */}
        <DestinationSlider
          state={destinationState}
          onChange={handleDestinationChange}
          lang={lang}
        />

        {/* MOVIE VIEW: No seasons, just Movie status & eye button */}
        {mediaType === 'movie' ? (
          <View style={detailSt.movieSection}>
            <Text style={detailSt.sectionHeading}>{t.movie}</Text>
            <Pressable onPress={toggleMovieWatched} style={detailSt.movieCardRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={detailSt.episodeNameText}>{item.title}</Text>
                <Text style={detailSt.movieSubText}>
                  {isMovieWatched ? t.watched : (lang === 'pt' ? 'Não visto' : 'Unwatched')}
                </Text>
              </View>

              {/* Clear Interactive Watch Button */}
              <View
                style={[
                  detailSt.watchActionBtn,
                  isMovieWatched ? detailSt.watchActionBtnWatched : detailSt.watchActionBtnUnwatched,
                ]}
              >
                <Text style={[detailSt.watchActionIcon, isMovieWatched && detailSt.watchActionIconWatched]}>
                  {isMovieWatched ? '✓' : '👁'}
                </Text>
                <Text style={[detailSt.watchActionText, isMovieWatched && detailSt.watchActionTextWatched]}>
                  {isMovieWatched
                    ? (lang === 'pt' ? 'Visto' : 'Watched')
                    : (lang === 'pt' ? 'Marcar visto' : 'Mark watched')}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : (
          /* SERIES VIEW: Seasons & Episodes Selector */
          details.seasons.length > 0 && (
            <View style={detailSt.seasonsSection}>
              <View style={detailSt.sectionHeadingRow}>
                <Text style={detailSt.sectionHeading}>{t.episodesTitle}</Text>
                <Pressable
                  onPress={toggleEntireSeriesWatched}
                  style={[
                    detailSt.bulkSeriesBtn,
                    isSeriesFullyWatched && detailSt.bulkSeriesBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      detailSt.bulkSeriesBtnText,
                      isSeriesFullyWatched && detailSt.bulkSeriesBtnTextActive,
                    ]}
                  >
                    {isSeriesFullyWatched ? `✓ ${t.allSeriesWatched}` : `+ ${t.markSeriesWatched}`}
                  </Text>
                </Pressable>
              </View>

              {/* Horizontal scroll of seasons */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                overScrollMode="always"
                bounces
                contentContainerStyle={detailSt.seasonPillsRow}
              >
                {details.seasons.map((s) => {
                  const isSeasonDone = isSeasonFullyWatched(s.seasonNumber);
                  return (
                    <Pressable
                      key={`season-${s.seasonNumber}`}
                      onPress={() => setSelectedSeason(s.seasonNumber)}
                      style={[
                        detailSt.seasonPill,
                        selectedSeason === s.seasonNumber && detailSt.seasonPillActive,
                        isSeasonDone && detailSt.seasonPillWatched,
                      ]}
                    >
                      <Text
                        style={[
                          detailSt.seasonPillText,
                          selectedSeason === s.seasonNumber && detailSt.seasonPillTextActive,
                          isSeasonDone && detailSt.seasonPillTextWatched,
                        ]}
                      >
                        {s.name}{isSeasonDone ? ' ✓' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Season Header & Quick Mark Season Button */}
              {typeof selectedSeason === 'number' && (
                <View style={detailSt.seasonHeaderRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={detailSt.seasonTitleText}>
                      {details.seasons.find((s) => s.seasonNumber === selectedSeason)?.name || `${t.season} ${selectedSeason}`}
                    </Text>
                    {(() => {
                      const sWatched = seasonWatchedCount(selectedSeason);
                      const sTotal = details.seasons.find((s) => s.seasonNumber === selectedSeason)?.episodeCount ?? seasonEpisodes[selectedSeason]?.length ?? 0;
                      const sLeft = Math.max(0, sTotal - sWatched);
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <Text style={detailSt.seasonMetaText}>
                            {sWatched} / {sTotal} {t.watchedCount}
                          </Text>
                          {sLeft > 0 ? (
                            <Text style={detailSt.seasonMetaRemaining}>
                              • {lang === 'pt' ? `faltam ${sLeft}` : `${sLeft} left`}
                            </Text>
                          ) : (
                            <Text style={detailSt.seasonMetaCompleted}>
                              • {lang === 'pt' ? 'Concluída ✓' : 'Done ✓'}
                            </Text>
                          )}
                        </View>
                      );
                    })()}
                  </View>

                  <Pressable
                    onPress={() => toggleSeasonWatched(selectedSeason)}
                    style={[
                      detailSt.seasonToggleBtn,
                      isSeasonFullyWatched(selectedSeason) && detailSt.seasonToggleBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        detailSt.seasonToggleBtnText,
                        isSeasonFullyWatched(selectedSeason) && detailSt.seasonToggleBtnTextActive,
                      ]}
                    >
                      {isSeasonFullyWatched(selectedSeason)
                        ? `✓ ${t.unmarkSeasonWatched}`
                        : `+ ${t.markSeasonWatched}`}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Episodes List for selected season */}
              {loadingEpisodes ? (
                <ActivityIndicator color={C.cream} style={{ marginTop: 24 }} />
              ) : typeof selectedSeason === 'number' && seasonEpisodes[selectedSeason] ? (
                <View style={detailSt.episodesList}>
                  {seasonEpisodes[selectedSeason].map((ep) => {
                    const epKey = `S${selectedSeason}E${ep.episodeNumber}`;
                    const isWatched = watchedEpSet.has(epKey);

                    return (
                      <Pressable
                        key={epKey}
                        onPress={() => toggleEpisodeWatched(selectedSeason, ep.episodeNumber)}
                        style={[
                          detailSt.episodeRow,
                          isWatched && detailSt.episodeRowWatched,
                        ]}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={detailSt.episodeNumberText}>
                            {t.ep} {ep.episodeNumber}
                          </Text>
                          <Text style={detailSt.episodeNameText}>{ep.name}</Text>
                          {ep.overview ? (
                            <Text numberOfLines={2} style={detailSt.episodeOverviewText}>
                              {ep.overview}
                            </Text>
                          ) : null}
                        </View>

                        {/* High-Contrast Clear Watch Action Button */}
                        <View
                          style={[
                            detailSt.watchActionBtn,
                            isWatched ? detailSt.watchActionBtnWatched : detailSt.watchActionBtnUnwatched,
                          ]}
                        >
                          <Text style={[detailSt.watchActionIcon, isWatched && detailSt.watchActionIconWatched]}>
                            {isWatched ? '✓' : '👁'}
                          </Text>
                          <Text style={[detailSt.watchActionText, isWatched && detailSt.watchActionTextWatched]}>
                            {isWatched
                              ? (lang === 'pt' ? 'Visto' : 'Watched')
                              : (lang === 'pt' ? 'Marcar visto' : 'Mark watched')}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

// ─── Universal Search Modal ───────────────────────────────────────────────────

function SearchCatalogModal({
  visible,
  close,
  onAddToLibrary,
  onAddToWatchlist,
  library,
  watchlist,
  openDetail,
  lang,
}: {
  visible: boolean;
  close: () => void;
  onAddToLibrary: (item: TmdbResult) => void;
  onAddToWatchlist: (item: TmdbResult) => void;
  library: Series[];
  watchlist: TmdbResult[];
  openDetail: (item: TmdbResult) => void;
  lang: Language;
}) {
  const t = i18n[lang];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTargetItem, setSelectedTargetItem] = useState<TmdbResult | null>(null);

  const search = async () => {
    try {
      setError('');
      setLoading(true);
      setResults(await searchCatalog(query, lang === 'pt' ? 'pt-PT' : 'en-US'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not search the catalogue.');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseDestination = (destination: 'library' | 'watchlist') => {
    if (!selectedTargetItem) return;
    if (destination === 'library') {
      onAddToLibrary(selectedTargetItem);
    } else {
      onAddToWatchlist(selectedTargetItem);
    }
    setSelectedTargetItem(null);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.safe}>
        <View style={catSt.header}>
          <Pressable onPress={close}><Text style={styles.back}>‹ {t.cancel}</Text></Pressable>
          <Text style={catSt.title}>{t.addContent}</Text>
        </View>

        {isTmdbConfigured ? (
          <>
            <View style={catSt.searchRow}>
              <View style={catSt.searchInputContainer}>
                <SearchIcon size={16} color={C.bordeaux} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={search}
                  placeholder={t.searchCatalogPrompt}
                  placeholderTextColor="#7e6060"
                  style={catSt.searchInputWithIcon}
                  autoFocus
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} style={{ padding: 4 }}>
                    <Text style={{ color: C.muted, fontSize: 13, fontWeight: '700' }}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={search} style={[homeSt.searchOutlineBtn, { marginBottom: 0, height: 46, justifyContent: 'center' }]}>
                {loading ? (
                  <ActivityIndicator color={C.cream} size="small" />
                ) : (
                  <>
                    <SearchIcon size={15} color={C.bordeaux} />
                    <Text style={homeSt.searchOutlineText}>{t.search}</Text>
                  </>
                )}
              </Pressable>
            </View>

            {error ? <Text style={catSt.error}>{error}</Text> : null}

            <FlatList
              data={results}
              keyExtractor={(item) => `${item.mediaType}-${item.id}`}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              overScrollMode="always"
              bounces
              renderItem={({ item }) => {
                const inLib = library.some((s) => s.tmdbId === item.id && s.mediaType === item.mediaType);
                const inWl = watchlist.some((w) => w.id === item.id && w.mediaType === item.mediaType);

                return (
                  <Pressable onPress={() => openDetail(item)} style={catSt.result}>
                    <PosterThumb posterPath={item.posterPath} title={item.title} size="md" />
                    <View style={[styles.rowBody, { marginLeft: 12 }]}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowMeta}>
                        {item.mediaType === 'movie' ? 'Movie' : 'Series'}
                        {inLib ? ` · ${t.inLibrary}` : inWl ? ` · ${t.inWatchlist}` : ''}
                      </Text>
                      <Text numberOfLines={2} style={catSt.overview}>{item.overview || t.noOverview}</Text>
                    </View>
                    <View style={catSt.actionCol}>
                      <Text style={{ color: C.gold, fontSize: 26, fontWeight: '700', paddingHorizontal: 6 }}>›</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </>
        ) : (
          <Text style={catSt.error}>Add your TMDB API key to search the catalogue.</Text>
        )}

        {/* Choose Destination modal */}
        <Modal visible={Boolean(selectedTargetItem)} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={[styles.modal, { minHeight: 220 }]}>
              <Text style={styles.modalTitle}>{t.whereToAdd}</Text>
              <Text style={{ color: C.cream, fontSize: 16, fontWeight: '700', marginBottom: 6 }}>
                {selectedTargetItem?.title}
              </Text>
              <Text style={{ color: C.muted, fontSize: 13, marginBottom: 18 }}>
                {t.chooseDestination}
              </Text>

              <View style={{ gap: 10 }}>
                <Pressable
                  style={[styles.primaryButton, { marginTop: 0 }]}
                  onPress={() => handleChooseDestination('library')}
                >
                  <Text style={styles.primaryButtonText}>📚 {t.addToLibrary}</Text>
                </Pressable>

                <Pressable
                  style={[styles.primaryButton, { marginTop: 0, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }]}
                  onPress={() => handleChooseDestination('watchlist')}
                >
                  <Text style={[styles.primaryButtonText, { color: C.gold }]}>⭐ {t.addToWatchlist}</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setSelectedTargetItem(null)}
                style={{ marginTop: 16, alignSelf: 'center' }}
              >
                <Text style={styles.cancel}>{t.cancel}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function FriendsLineIcon({ size = 20, color = C.muted }: { size?: number; color?: string }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  return <Text style={{ color, fontSize: size, fontWeight: '400' }}>⚇</Text>;
}

function SearchIcon({ size = 15, color = C.bordeaux }: { size?: number; color?: string }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.2" y2="16.2" />
      </svg>
    );
  }
  return <Text style={{ color, fontSize: size, fontWeight: '900' }}>⌕</Text>;
}

function PosterThumb({ posterPath, title, size }: { posterPath?: string; title: string; size: 'sm' | 'md' }) {
  const w = size === 'md' ? 52 : 39;
  const h = size === 'md' ? 76 : 56;
  return (
    <View style={[catSt.poster, { width: w, height: h }]}>
      {posterPath ? (
        <Image source={{ uri: posterUrl(posterPath) }} style={catSt.posterImage} />
      ) : (
        <Text style={styles.posterText}>{title.slice(0, 1)}</Text>
      )}
    </View>
  );
}

function SeriesRow({
  series,
  watched,
  press,
  collectionLabel,
  t,
  lang,
}: {
  series: Series;
  watched: number;
  press: () => void;
  collectionLabel: string;
  t: (typeof i18n)['en'];
  lang: Language;
}) {
  const remaining = Math.max(0, series.totalEpisodes - watched);

  return (
    <Pressable style={styles.seriesRow} onPress={press}>
      <PosterThumb posterPath={series.posterPath} title={series.title} size="sm" />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{series.title}</Text>
        <Text style={styles.rowMeta}>{collectionLabel}</Text>
        {series.totalEpisodes > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={styles.rowProgress}>
              {watched} / {series.totalEpisodes} {t.watchedCount}
            </Text>
            {remaining > 0 ? (
              <Text style={styles.rowProgressRemaining}>
                • {lang === 'pt' ? `faltam ${remaining}` : `${remaining} left`}
              </Text>
            ) : (
              <Text style={styles.rowProgressCompleted}>
                • {lang === 'pt' ? 'Concluída ✓' : 'Done ✓'}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.rowProgress}>
            {watched} {t.episodesWatched}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function TabBar({
  tab,
  setTab,
  lang,
  pendingRequestsCount = 0,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  lang: Language;
  pendingRequestsCount?: number;
}) {
  const t = i18n[lang];
  const tabs: [Tab, string, string][] = [
    ['home', '⌂', t.home],
    ['library', '▦', t.library],
    ['watchlist', '☆', t.watchlist],
    ['friends', 'friends_line', t.friends],
    ['profile', '◉', t.profile],
  ];

  return (
    <View style={styles.tabbar}>
      {tabs.map(([key, icon, label]) => {
        const isActive = tab === key;
        const iconColor = isActive ? C.bordeaux : C.muted;
        const hasBadge = key === 'friends' && pendingRequestsCount > 0;
        return (
          <Pressable key={key} onPress={() => setTab(key)} style={styles.tab}>
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', height: 26 }}>
              {key === 'friends' ? (
                <Animated.View style={isActive && styles.tabIconActive}>
                  <FriendsLineIcon size={22} color={iconColor} />
                </Animated.View>
              ) : (
                <Animated.Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                  {icon}
                </Animated.Text>
              )}
              {hasBadge && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;
}

function AvatarPicker({
  avatar,
  onPick,
  label,
  lang,
}: {
  avatar: string | null;
  onPick: (uri: string) => void;
  label: string;
  lang: Language;
}) {
  const [loading, setLoading] = useState(false);

  const processFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new (window as any).Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = Math.min(img.width, img.height);
          const startX = (img.width - size) / 2;
          const startY = (img.height - size) / 2;

          const targetDim = 256;
          canvas.width = targetDim;
          canvas.height = targetDim;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, startX, startY, size, size, 0, 0, targetDim, targetDim);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);

            // Validate: não deve ser possível deixar a mesma fotografia
            if (avatar && (compressed === avatar || rawDataUrl === avatar)) {
              alert(
                lang === 'pt'
                  ? 'Esta fotografia já é a tua foto atual. Escolhe uma fotografia diferente.'
                  : 'This is already your current photo. Please choose a different photo.',
              );
              setLoading(false);
              return;
            }

            onPick(compressed);
          } else {
            if (avatar && rawDataUrl === avatar) {
              alert(
                lang === 'pt'
                  ? 'Esta fotografia já é a tua foto atual. Escolhe uma fotografia diferente.'
                  : 'This is already your current photo. Please choose a different photo.',
              );
              setLoading(false);
              return;
            }
            onPick(rawDataUrl);
          }
        } catch {
          onPick(rawDataUrl);
        } finally {
          setLoading(false);
        }
      };
      img.onerror = () => {
        onPick(rawDataUrl);
        setLoading(false);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => setLoading(false);
    reader.readAsDataURL(file);
  };

  const pick = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        processFile(file);
      };
      input.click();
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IP = await import('expo-image-picker' as any);
        const perm = await IP.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const res = await IP.launchImageLibraryAsync({
          mediaTypes: IP.MediaTypeOptions?.Images ?? 'images',
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
          base64: true,
        });
        if (!res.canceled && res.assets?.[0]) {
          const asset = res.assets[0];
          const newUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
          if (avatar && newUri === avatar) {
            alert(
              lang === 'pt'
                ? 'Esta fotografia já é a tua foto atual. Escolhe uma fotografia diferente.'
                : 'This is already your current photo. Please choose a different photo.',
            );
            return;
          }
          onPick(newUri);
        }
      } catch { /* not installed */ }
    }
  };

  return (
    <View style={profSt.settingMediaBlock}>
      <Pressable onPress={pick} style={profSt.settingAvatarCircle} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={C.bordeaux} size="small" />
        ) : avatar ? (
          <Image source={{ uri: avatar }} style={profSt.settingAvatarImg} />
        ) : (
          <Text style={{ fontSize: 26 }}>👤</Text>
        )}
      </Pressable>
      <Pressable onPress={pick} style={profSt.settingActionBtn} disabled={loading}>
        <Text style={profSt.settingActionBtnText} numberOfLines={1}>
          {loading ? (lang === 'pt' ? 'A guardar...' : 'Saving...') : `📷 ${label}`}
        </Text>
      </Pressable>
    </View>
  );
}

function BannerPicker({
  banner,
  onPick,
  onRemove,
  lang,
}: {
  banner: string | null;
  onPick: (uri: string) => void;
  onRemove: () => void;
  lang: Language;
}) {
  const [loading, setLoading] = useState(false);
  const t = i18n[lang];

  const processFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new (window as any).Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const targetW = 640;
          const targetH = Math.max(260, Math.round((img.height / img.width) * targetW));
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, targetW, targetH);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            if (banner && (compressed === banner || rawDataUrl === banner)) {
              alert(
                lang === 'pt'
                  ? 'Esta fotografia já é a tua imagem de fundo atual. Escolhe uma fotografia diferente.'
                  : 'This is already your current background photo. Please choose a different photo.',
              );
              setLoading(false);
              return;
            }
            onPick(compressed);
          } else {
            onPick(rawDataUrl);
          }
        } catch {
          onPick(rawDataUrl);
        } finally {
          setLoading(false);
        }
      };
      img.onerror = () => {
        onPick(rawDataUrl);
        setLoading(false);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => setLoading(false);
    reader.readAsDataURL(file);
  };

  const pick = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        processFile(file);
      };
      input.click();
    } else {
      try {
        const IP = await import('expo-image-picker' as any);
        const perm = await IP.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const res = await IP.launchImageLibraryAsync({
          mediaTypes: IP.MediaTypeOptions?.Images ?? 'images',
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.75,
          base64: true,
        });
        if (!res.canceled && res.assets?.[0]) {
          const asset = res.assets[0];
          const newUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
          if (banner && newUri === banner) {
            alert(
              lang === 'pt'
                ? 'Esta fotografia já é a tua imagem de fundo atual. Escolhe uma fotografia diferente.'
                : 'This is already your current background photo. Please choose a different photo.',
            );
            return;
          }
          onPick(newUri);
        }
      } catch { /* not installed */ }
    }
  };

  return (
    <View style={profSt.settingMediaBlock}>
      <Pressable onPress={pick} style={profSt.settingBannerPreview} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={C.bordeaux} size="small" />
        ) : banner ? (
          <Image source={{ uri: banner }} style={profSt.settingBannerImg} resizeMode="cover" />
        ) : (
          <View style={profSt.settingBannerEmpty}>
            <Text style={{ fontSize: 22 }}>🖼</Text>
            <Text style={profSt.settingBannerEmptyText}>{t.noCover}</Text>
          </View>
        )}
      </Pressable>
      <View style={profSt.settingBannerBtnRow}>
        <Pressable onPress={pick} style={[profSt.settingActionBtn, { flex: 1 }]} disabled={loading}>
          <Text style={profSt.settingActionBtnText} numberOfLines={1}>
            {loading
              ? (lang === 'pt' ? 'A guardar...' : 'Saving...')
              : (banner ? `📷 ${t.changeBanner}` : `📷 ${t.addBanner}`)}
          </Text>
        </Pressable>
        {banner ? (
          <Pressable onPress={onRemove} style={profSt.settingRemoveBtn} hitSlop={6}>
            <Text style={profSt.settingRemoveBtnText}>✕</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen({ lang }: { lang: Language }) {
  const pulseAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.9,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.55,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]),
    ).start();
  }, [pulseAnim, opacityAnim]);

  return (
    <View style={loadingStyles.container}>
      <Animated.View
        style={[
          loadingStyles.logoWrapper,
          {
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Image
          source={require('./assets/icon.png')}
          style={loadingStyles.logo}
          resizeMode="cover"
        />
      </Animated.View>

      <Text style={loadingStyles.wordmark}>SCREENVAULT</Text>

      <ActivityIndicator size="small" color={C.gold} style={{ marginTop: 22 }} />

      <Text style={loadingStyles.subtext}>
        {lang === 'pt' ? 'A carregar o teu cofre...' : 'Opening your vault...'}
      </Text>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoWrapper: {
    shadowColor: C.bordeaux,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.bordeaux,
  },
  wordmark: {
    color: C.cream,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 4,
    marginTop: 18,
  },
  subtext: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    letterSpacing: 0.5,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const authSt = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, position: 'relative' },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.22,
  },
  bgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 12, 13, 0.88)',
  },
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 26 },
  bottomLangRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 22,
    alignSelf: 'center',
  },
  langPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  langPillActive: {
    backgroundColor: C.bordeaux,
    borderColor: C.bordeaux,
  },
  langPillText: {
    color: C.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  langPillTextActive: {
    color: C.cream,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  appLogo: {
    width: 68,
    height: 68,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  wordmark: {
    color: C.bordeaux,
    fontWeight: '800',
    letterSpacing: 4,
    fontSize: 12,
    marginTop: 8,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: C.bordeaux,
  },
  tabBtnText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: C.cream,
    fontWeight: '800',
  },
  title: { color: C.cream, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  description: {
    color: C.muted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  featurePillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  featureBadge: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  featureBadgeText: {
    color: C.gold,
    fontSize: 12.5,
    fontWeight: '700',
  },
  input: {
    backgroundColor: C.surface,
    color: C.cream,
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  switch: { color: C.gold, textAlign: 'center', fontWeight: '700', marginTop: 16, fontSize: 14 },
  message: { color: C.gold, textAlign: 'center', lineHeight: 20, marginTop: 14, fontSize: 14 },
});

const homeSt = StyleSheet.create({
  versionBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  versionBadgeText: {
    color: C.gold,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: C.bg,
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 110,
    paddingTop: 4,
  },
  titleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  titleIcon: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 4 },
  searchOutlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: C.bordeaux, backgroundColor: 'transparent',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 4,
  },
  searchOutlineIcon: { fontSize: 15, color: C.bordeaux, fontWeight: '800' },
  searchOutlineText: { color: C.cream, fontSize: 14.5, fontWeight: '700' },
  continueWatchingRow: { paddingHorizontal: 22, gap: 12, paddingVertical: 4 },
  compactCard: { width: 88, alignItems: 'center' },
  compactPoster: {
    width: 84, height: 124, borderRadius: 8, overflow: 'hidden',
    backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, position: 'relative',
  },
  compactPosterImg: { width: '100%', height: '100%' },
  fallbackPosterText: { color: C.bordeaux, fontSize: 24, fontWeight: '800' },
  compactTitle: { color: C.cream, fontSize: 14, fontWeight: '600', marginTop: 6, textAlign: 'center', lineHeight: 18 },
  compactSubtitle: {
    color: C.gold,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 15,
  },
  epBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(16,12,13,0.92)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#5C2D37',
  },
  epBadgeText: { color: C.gold, fontSize: 13.5, fontWeight: '900', letterSpacing: 0.5 },
  emptySectionCard: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 6,
    marginBottom: 4,
    alignItems: 'center',
  },
  emptySectionText: {
    color: C.muted,
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

const wlSt = StyleSheet.create({
  viewModeBtn: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
  },
  viewModeIcon: { color: C.gold, fontSize: 14, fontWeight: '700' },
  gridContainer: { paddingHorizontal: 12, paddingBottom: 100, paddingTop: 10 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8, marginBottom: 14 },
  gridCard: { width: Math.floor((SCREEN_W - 24 - 24) / 4), alignItems: 'center' },
  gridPoster: {
    width: '100%', aspectRatio: 2 / 3, borderRadius: 8,
    overflow: 'hidden', backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.border, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  gridPosterImg: { width: '100%', height: '100%' },
  gridTitle: { color: C.cream, fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'center', lineHeight: 15 },
  gridSubtitle: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
    lineHeight: 13,
  },
  gridEpBadge: {
    position: 'absolute', bottom: 3, right: 3,
    backgroundColor: 'rgba(16,12,13,0.92)', borderRadius: 5,
    paddingHorizontal: 4, paddingVertical: 2,
    borderWidth: 1, borderColor: '#5C2D37',
  },
  gridEpBadgeText: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  removeBadge: {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 11,
    width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
  },
  removeBadgeText: { color: C.cream, fontSize: 11, fontWeight: '800' },
});

const catSt = StyleSheet.create({
  addButton: { backgroundColor: C.bordeaux, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 7 },
  addText: { color: C.cream, fontSize: 14, fontWeight: '800' },
  header: { padding: 22, flexDirection: 'row', alignItems: 'center', gap: 18 },
  title: { color: C.cream, fontSize: 22, fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingBottom: 10 },
  searchInput: {
    flex: 1, height: 48, borderRadius: 10, paddingHorizontal: 13,
    color: C.cream, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    fontSize: 16.5,
  },
  searchInputContainer: {
    flex: 1, height: 48, borderRadius: 10, paddingHorizontal: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  searchInputWithIcon: {
    flex: 1, height: '100%', color: C.cream, fontSize: 16.5,
  },
  searchButton: {
    backgroundColor: C.bordeaux, borderRadius: 10, paddingHorizontal: 14,
    justifyContent: 'center', minWidth: 70, alignItems: 'center',
  },
  searchButtonText: { color: C.cream, fontWeight: '800', fontSize: 14.5 },
  result: {
    flexDirection: 'row', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'flex-start',
  },
  watchlistRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'flex-start',
  },
  poster: { borderRadius: 6, overflow: 'hidden', backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  posterImage: { width: '100%', height: '100%' },
  overview: { color: C.muted, fontSize: 13.5, lineHeight: 18, marginTop: 5 },
  error: { color: C.error, paddingHorizontal: 22, marginTop: 10, fontSize: 14 },
  actionCol: { justifyContent: 'center', alignSelf: 'center' },
  removeButton: { padding: 8, justifyContent: 'center' },
  removeText: { color: C.muted, fontSize: 17 },
});

const profSt = StyleSheet.create({
  headerRowOverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerTitle: {
    color: C.cream,
    fontSize: 30,
    fontWeight: '800',
    fontFamily: 'serif',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 110,
    paddingTop: 0,
  },
  gearButton: {
    padding: 7,
    backgroundColor: 'rgba(16, 12, 13, 0.55)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  gearIcon: {
    fontSize: 22,
    color: C.cream,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  bannerContainer: {
    marginHorizontal: -22,
    marginTop: 0,
    paddingHorizontal: 22,
    paddingTop: 0,
    paddingBottom: 18,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    marginBottom: 6,
  },
  bannerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  avatarDisplayWrapper: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
    zIndex: 5,
  },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, borderColor: C.bordeaux },
  avatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: C.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.border,
  },
  avatarIcon: { fontSize: 38 },
  userInfoContainer: { alignItems: 'center', marginBottom: 14, paddingHorizontal: 20 },
  usernameText: {
    color: C.cream, fontSize: 20, fontWeight: '800', marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  bioText: {
    color: C.cream, fontSize: 15, textAlign: 'center', lineHeight: 21, marginBottom: 8,
    opacity: 0.9, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 21, 24, 0.85)',
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 16, marginTop: 4,
  },
  editProfileBtnText: { color: C.gold, fontSize: 14.5, fontWeight: '700' },
  inputLabel: { color: C.gold, fontSize: 14.5, fontWeight: '700', marginBottom: 6 },
  textInput: {
    backgroundColor: C.surface2, color: C.cream, height: 48, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 16.5, borderWidth: 1, borderColor: C.border,
  },
  bioInput: { height: 78, paddingTop: 10, textAlignVertical: 'top' },
  accountEmail: { color: C.muted, fontSize: 15, textAlign: 'center' },
  signOutButton: { marginTop: 14, backgroundColor: C.bordeaux, borderRadius: 10, padding: 13, alignItems: 'center' },
  signOutText: { color: C.cream, fontWeight: '800', fontSize: 15.5 },
  dashBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 6,
  },
  dashItem: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  dashNumber: { color: C.bordeauxLight, fontSize: 19, fontWeight: '800' },
  dashLabel: { color: C.muted, fontSize: 13, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  dashSep: { width: 1, height: 24, backgroundColor: C.border },
  sectionBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  seeAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  seeAllText: { color: C.gold, fontSize: 14.5, fontWeight: '700' },
  hCardRow: { paddingHorizontal: 22, gap: 12, paddingVertical: 4 },
  hCard: { width: 84, alignItems: 'center' },
  hPoster: {
    width: 80, height: 116, borderRadius: 8, overflow: 'hidden',
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  hPosterImg: { width: '100%', height: '100%' },
  hTitle: { color: C.cream, fontSize: 13.5, fontWeight: '600', marginTop: 4, textAlign: 'center', lineHeight: 16 },
  hSubtitle: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 15,
  },
  settingsSectionLabel: { color: C.gold, fontWeight: '700', fontSize: 15.5, marginTop: 16, marginBottom: 8 },
  // Settings Media Customization (Photo & Cover)
  settingsMediaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  settingsMediaCard: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  settingsMediaTitle: { color: C.cream, fontSize: 14, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  settingMediaBlock: { alignItems: 'center', width: '100%' },
  settingAvatarCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: C.surface,
    borderWidth: 2, borderColor: C.bordeaux, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 8,
  },
  settingAvatarImg: { width: '100%', height: '100%' },
  settingBannerPreview: {
    width: '100%', height: 60, borderRadius: 8, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  settingBannerImg: { width: '100%', height: '100%' },
  settingBannerEmpty: { alignItems: 'center', justifyContent: 'center' },
  settingBannerEmptyText: { color: C.muted, fontSize: 13, fontWeight: '600', marginTop: 2 },
  settingBannerBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' },
  settingActionBtn: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, alignItems: 'center',
    justifyContent: 'center', width: '100%',
  },
  settingActionBtnText: { color: C.gold, fontSize: 13.5, fontWeight: '700' },
  settingRemoveBtn: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  settingRemoveBtnText: { color: C.muted, fontSize: 14, fontWeight: '800' },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    paddingVertical: 11, borderRadius: 8, alignItems: 'center',
  },
  langBtnActive: { borderColor: C.bordeaux, backgroundColor: C.bordeaux },
  langBtnText: { color: C.muted, fontWeight: '700', fontSize: 14.5 },
  langBtnTextActive: { color: C.cream },
  versionFooter: {
    marginTop: 40,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.65,
    letterSpacing: 0.8,
  },
  friendsBar: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsBarTitle: {
    color: C.cream,
    fontSize: 15.5,
    fontWeight: '700',
  },
  friendsBarSubtitle: {
    color: C.muted,
    fontSize: 13,
    marginTop: 2,
  },
  friendsBadge: {
    backgroundColor: C.bordeaux,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
  },
  friendsBadgeText: {
    color: C.cream,
    fontSize: 12,
    fontWeight: '800',
  },
  friendsChevron: {
    color: C.muted,
    fontSize: 22,
    fontWeight: '700',
  },
  friendsTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    backgroundColor: C.bg,
  },
  friendsTabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  friendsTabBtnActive: {
    borderBottomColor: C.gold,
  },
  friendsTabBtnText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  friendsTabBtnTextActive: {
    color: C.gold,
  },
  friendCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  friendCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  friendAvatarImg: {
    width: '100%',
    height: '100%',
  },
  friendUsername: {
    color: C.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  friendBio: {
    color: C.muted,
    fontSize: 13,
    marginTop: 2,
  },
  friendActionBtn: {
    backgroundColor: C.bordeaux,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendActionBtnText: {
    color: C.cream,
    fontSize: 13.5,
    fontWeight: '700',
  },
  friendActionBtnSecondary: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendActionBtnSecondaryText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  cleanProfileBanner: {
    width: '100%',
    height: (Platform.OS === 'web' ? 'calc(150px + env(safe-area-inset-top, 0px))' : 170) as any,
    backgroundColor: '#1C1316',
    position: 'relative',
  },
  cleanProfileBannerImg: {
    width: '100%',
    height: '100%',
  },
  cleanBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 12, 13, 0.45)',
  },
  cleanCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 12, 13, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  cleanAvatarContainer: {
    alignItems: 'center',
    marginTop: -42,
  },
  cleanAvatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    borderColor: C.gold,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cleanAvatarImg: {
    width: '100%',
    height: '100%',
  },
  cleanUsername: {
    fontSize: 22,
    fontWeight: '800',
    color: C.cream,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  cleanBio: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  cleanPillRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  cleanStatusPill: {
    backgroundColor: 'rgba(196, 163, 90, 0.18)',
    borderWidth: 1.2,
    borderColor: C.gold,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  cleanStatusPillText: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cleanAddPill: {
    backgroundColor: C.bordeaux,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  cleanAddPillText: {
    color: C.cream,
    fontSize: 13.5,
    fontWeight: '700',
  },
  cleanAcceptPill: {
    backgroundColor: C.bordeaux,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  cleanAcceptPillText: {
    color: C.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  cleanDeclinePill: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  cleanDeclinePillText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  cleanSmallActionBtn: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  cleanSmallActionText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  cleanStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: 18,
    paddingHorizontal: 16,
  },
  cleanStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  cleanStatNum: {
    fontSize: 22,
    fontWeight: '800',
    color: C.cream,
    letterSpacing: 0.2,
  },
  cleanStatLbl: {
    fontSize: 12.5,
    color: C.muted,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  cleanStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cleanTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  cleanTabPressable: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cleanTabText: {
    fontSize: 14,
    color: C.muted,
    fontWeight: '600',
  },
  cleanTabTextActive: {
    color: C.cream,
    fontWeight: '800',
  },
  cleanTabSep: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.2)',
    fontWeight: '300',
  },
  cleanGridPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 10,
    backgroundColor: C.surface2,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cleanGridPosterImg: {
    width: '100%',
    height: '100%',
  },
});

const sliderSt = StyleSheet.create({
  container: {
    marginVertical: 22,
    alignItems: 'center',
    width: '100%',
    position: 'relative',
  },
  confettiLayer: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  confettiItem: {
    position: 'absolute',
  },
  confettiEmoji: {
    fontSize: 22,
  },
  track: {
    width: 316,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: 3,
  },
  slidingPill: {
    position: 'absolute',
    top: 3,
    left: 3,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  pillText: {
    fontSize: 13.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  slot: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    paddingHorizontal: 2,
  },
  slotText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  hintText: {
    color: '#8A6A72',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
});

const detailSt = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: C.bg, position: 'relative' },
  backdropBg: {
    position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_H * 0.45,
    opacity: 0.28,
  },
  backdropOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(16,12,13,0.7)',
  },
  scrollContainer: { padding: 22, paddingBottom: 80 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4, marginBottom: 12 },
  backText: { color: C.gold, fontSize: 17, fontWeight: '700' },
  posterWrapper: {
    alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6, shadowRadius: 14, elevation: 12,
  },
  mainPoster: {
    width: 150, height: 225, borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
  },
  posterPlaceholder: {
    width: 150, height: 225, borderRadius: 12, backgroundColor: C.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border,
  },
  titleCenter: {
    color: C.cream, fontSize: 26, fontWeight: '800', textAlign: 'center',
    marginTop: 16, paddingHorizontal: 12,
  },
  overviewWrapper: {
    marginTop: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
  },
  overviewText: {
    color: C.muted,
    fontSize: 15.5,
    lineHeight: 23,
    textAlign: 'center',
  },
  seeMoreBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
  },
  seeMoreText: {
    color: C.gold,
    fontSize: 13.5,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row', gap: 12, justifyContent: 'center',
    marginTop: 20, marginBottom: 24,
  },
  actionBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10,
    alignItems: 'center', borderWidth: 1,
  },
  actionBtnInactive: {
    backgroundColor: C.surface, borderColor: C.border,
  },
  actionBtnActive: {
    backgroundColor: C.bordeaux, borderColor: C.bordeaux,
  },
  actionBtnText: { color: C.cream, fontWeight: '800', fontSize: 15 },
  actionBtnTextActive: { color: C.cream },
  // Movie specific view
  movieSection: { marginTop: 22 },
  movieCardRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, padding: 18, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border, marginTop: 12,
  },
  movieSubText: { color: C.gold, fontSize: 14.5, marginTop: 4, fontWeight: '600' },
  // Series view
  seasonsSection: { marginTop: 24 },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeading: { color: C.cream, fontSize: 22, fontWeight: '800' },
  bulkSeriesBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  bulkSeriesBtnActive: {
    backgroundColor: C.bordeaux,
    borderColor: C.gold,
  },
  bulkSeriesBtnText: {
    color: C.gold,
    fontSize: 13.5,
    fontWeight: '800',
  },
  bulkSeriesBtnTextActive: {
    color: C.cream,
  },
  seasonPillsRow: { gap: 10, paddingVertical: 6, marginBottom: 16 },
  seasonPill: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface,
  },
  seasonPillActive: {
    backgroundColor: C.bordeaux, borderColor: C.bordeaux,
  },
  seasonPillWatched: {
    borderColor: C.gold,
    backgroundColor: '#261418',
  },
  seasonPillText: { color: C.muted, fontSize: 14.5, fontWeight: '700' },
  seasonPillTextActive: { color: C.cream },
  seasonPillTextWatched: { color: C.gold },
  seasonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    marginTop: 12,
    marginBottom: 16,
  },
  seasonTitleText: {
    color: C.cream,
    fontSize: 17,
    fontWeight: '800',
  },
  seasonMetaText: {
    color: C.gold,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  seasonMetaRemaining: {
    color: '#E0A868',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  seasonMetaCompleted: {
    color: '#68D391',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  seasonToggleBtn: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface2,
  },
  seasonToggleBtnActive: {
    backgroundColor: C.bordeaux,
    borderColor: C.gold,
  },
  seasonToggleBtnText: {
    color: C.cream,
    fontSize: 13.5,
    fontWeight: '700',
  },
  seasonToggleBtnTextActive: {
    color: C.cream,
    fontWeight: '800',
  },
  episodesList: { marginTop: 12, gap: 14 },
  episodeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, padding: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
  },
  episodeRowWatched: {
    borderColor: '#54232E',
    backgroundColor: 'rgba(38, 20, 24, 0.95)',
  },
  episodeNumberText: { color: C.gold, fontSize: 13.5, fontWeight: '800', marginBottom: 3 },
  episodeNameText: { color: C.cream, fontSize: 17, fontWeight: '700' },
  episodeOverviewText: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  // Interactive Episode / Movie Watch Toggle Button
  watchActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1.5,
    marginLeft: 12,
  },
  watchActionBtnUnwatched: {
    backgroundColor: C.surface2,
    borderColor: '#7A3546',
  },
  watchActionBtnWatched: {
    backgroundColor: C.bordeaux,
    borderColor: C.gold,
  },
  watchActionIcon: {
    fontSize: 15,
    color: C.gold,
    fontWeight: '800',
  },
  watchActionIconWatched: {
    color: C.cream,
  },
  watchActionText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: C.gold,
  },
  watchActionTextWatched: {
    color: C.cream,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    height: (Platform.OS === 'web' ? '100dvh' : undefined) as any,
    maxHeight: (Platform.OS === 'web' ? '100dvh' : undefined) as any,
    overflow: 'hidden',
    backgroundColor: C.bg,
    paddingTop: (Platform.OS === 'web' ? 'env(safe-area-inset-top, 0px)' : Platform.OS === 'ios' ? 44 : 0) as any,
  },
  content: { flex: 1 },
  flex: { flex: 1 },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.bordeaux, fontSize: 18, fontWeight: '800', letterSpacing: 3 },
  page: { padding: 22, paddingBottom: 110 },
  wordmark: { color: C.bordeaux, fontWeight: '800', letterSpacing: 3, fontSize: 13, marginTop: 4 },
  pageTitle: { color: C.cream, fontSize: 32, fontWeight: '800', marginTop: 4 },
  sectionHeader: { color: C.cream, fontSize: 20, fontWeight: '800' },
  subtitle: { color: C.muted, fontSize: 14.5, marginBottom: 10 },
  libraryHeader: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bg,
    zIndex: 10,
  },
  search: {
    marginHorizontal: 22, marginTop: 8, marginBottom: 8,
    backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 14,
    height: 44, color: C.cream, fontSize: 16.5, borderWidth: 1, borderColor: C.border,
  },
  searchBarContainer: {
    marginHorizontal: 22,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchBarInput: {
    flex: 1,
    height: '100%',
    color: C.cream,
    fontSize: 16,
  },
  filtersWrapper: { marginBottom: 10, backgroundColor: C.bg, zIndex: 10 },
  filters: { paddingHorizontal: 22, gap: 6 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: C.bordeaux, borderColor: C.bordeaux },
  chipText: { color: C.muted, fontSize: 14.5, fontWeight: '600' },
  chipTextActive: { color: C.cream },
  list: { paddingHorizontal: 22, paddingBottom: 100 },
  seriesRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  poster: { height: 60, width: 42, borderRadius: 6, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  posterText: { color: C.bordeaux, fontSize: 18, fontWeight: '800' },
  rowBody: { flex: 1, marginLeft: 14 },
  rowTitle: { color: C.cream, fontSize: 17.5, fontWeight: '700' },
  rowMeta: { color: C.muted, fontSize: 14.5, marginTop: 3 },
  rowProgress: { color: C.gold, fontSize: 15.5, fontWeight: '800', marginTop: 3 },
  rowProgressRemaining: { color: '#E0A868', fontSize: 15.5, fontWeight: '700', marginTop: 3 },
  rowProgressCompleted: { color: '#68D391', fontSize: 15.5, fontWeight: '800', marginTop: 3 },
  chevron: { color: C.border, fontSize: 22 },
  tabbar: {
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-around', paddingTop: 4,
    paddingBottom: (Platform.OS === 'web'
      ? 'max(4px, calc(env(safe-area-inset-bottom, 16px) - 16px))'
      : Platform.OS === 'ios'
      ? 12
      : 6) as any,
  },
  tab: { alignItems: 'center', minWidth: 60, flex: 1, paddingVertical: 1 },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -10,
    backgroundColor: C.bordeaux,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: C.gold,
  },
  tabBadgeText: { color: C.cream, fontSize: 10, fontWeight: '800' },
  tabIcon: { color: C.muted, fontSize: 22 },
  tabIconActive: { color: C.bordeaux, transform: [{ scale: 1.15 }] },
  tabLabel: { color: C.muted, fontSize: 11, marginTop: 1 },
  tabLabelActive: { color: C.bordeaux, fontWeight: '800' },
  back: { color: C.gold, fontSize: 17 },
  primaryButton: { backgroundColor: C.bordeaux, padding: 14, borderRadius: 11, alignItems: 'center', marginTop: 20 },
  primaryButtonText: { color: C.cream, fontWeight: '800', fontSize: 16.5 },
  empty: { backgroundColor: C.surface, borderRadius: 12, padding: 18, marginTop: 14 },
  emptyText: { color: C.muted, lineHeight: 22, textAlign: 'center', fontSize: 15.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.78)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: C.surface, padding: 22, borderTopLeftRadius: 22,
    borderTopRightRadius: 22, minHeight: 240, borderTopWidth: 1, borderColor: C.border,
  },
  modalTitle: { color: C.cream, fontSize: 22, fontWeight: '800', marginBottom: 14 },
  cancel: { color: C.muted, fontWeight: '700', fontSize: 15.5 },
});
