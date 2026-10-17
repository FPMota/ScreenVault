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

type Tab = 'home' | 'library' | 'watchlist' | 'profile';

const TABS: Tab[] = ['home', 'library', 'watchlist', 'profile'];
const STORAGE_KEY = '@screenvault/personal-data-v1';
const LIBRARY_KEY = '@screenvault/library-v1';
const WATCHLIST_KEY = '@screenvault/watchlist-v1';
const AVATAR_KEY = '@screenvault/avatar-v1';
const BANNER_KEY = '@screenvault/banner-v1';
const LANG_KEY = '@screenvault/lang-v1';
const USERNAME_KEY = '@screenvault/username-v1';
const BIO_KEY = '@screenvault/bio-v1';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
    versionText: 'Version 1.3 - 17/10/2026',
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
    markSeriesWatched: 'Mark Entire Series',
    allSeriesWatched: 'Series Watched',
    markSeasonWatched: 'Mark Season',
    unmarkSeasonWatched: 'Season Watched',
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
    versionText: 'Versão 1.3 - 17/10/2026',
    all: 'Todas',
    watching: 'A ver',
    finishedToContinue: 'Terminadas por ver',
    upToDate: 'Em dia',
    episodesWatched: 'episódios vistos',
    episodes: 'episódios',
    of: 'de',
    ep: 'Ep',
    emptyHome: 'Ainda sem atividade. Clica em Adicionar para adicionar séries e filmes!',
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
    markSeriesWatched: 'Marcar Série Toda',
    allSeriesWatched: 'Série Toda Vista',
    markSeasonWatched: 'Marcar Temporada',
    unmarkSeasonWatched: 'Temporada Vista',
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
  },
};

// ─── Colour palette (Vintage Cinema Bordeaux) ─────────────────────────────────
const C = {
  bg: '#100C0D',
  surface: '#1E1518',
  surface2: '#2A1D21',
  bordeaux: '#8B1A2E',
  bordeauxLight: '#B22040',
  gold: '#C4A35A',
  cream: '#F5ECD7',
  muted: '#A89080',
  border: '#3D2830',
  error: '#FF8080',
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
        const cp = Object.fromEntries(
          data.map((r) => [
            r.title,
            {
              watchedEpisodes: r.watched_episodes ?? 0,
              rating: r.rating ?? undefined,
              review: r.review ?? undefined,
              lastWatched: r.last_watched ? Number(r.last_watched) : undefined,
            },
          ]),
        );
        setLibrary(cl);
        setPersonal((cur) => ({ ...cur, ...cp }));
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
        useNativeDriver: true,
      }),
      Animated.timing(tabOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
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
            useNativeDriver: true,
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
        const [p, l, w, a, ban, la, un, bi] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(LIBRARY_KEY),
          AsyncStorage.getItem(WATCHLIST_KEY),
          AsyncStorage.getItem(AVATAR_KEY),
          AsyncStorage.getItem(BANNER_KEY),
          AsyncStorage.getItem(LANG_KEY),
          AsyncStorage.getItem(USERNAME_KEY),
          AsyncStorage.getItem(BIO_KEY),
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
                  const cp = Object.fromEntries(
                    data.map((r) => [
                      r.title,
                      {
                        watchedEpisodes: r.watched_episodes ?? 0,
                        rating: r.rating ?? undefined,
                        review: r.review ?? undefined,
                        lastWatched: r.last_watched ? Number(r.last_watched) : undefined,
                      },
                    ]),
                  );

                  setLibrary(cl);
                  setPersonal((cur) => ({ ...cur, ...cp }));
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

    // Check user_metadata for avatar & banner
    if (session.user.user_metadata?.avatar_url) {
      setAvatar(session.user.user_metadata.avatar_url);
      AsyncStorage.setItem(AVATAR_KEY, session.user.user_metadata.avatar_url).catch(() => undefined);
    }
    if (session.user.user_metadata?.banner_url) {
      setBanner(session.user.user_metadata.banner_url);
      AsyncStorage.setItem(BANNER_KEY, session.user.user_metadata.banner_url).catch(() => undefined);
    }

    supabase.storage.from('avatars').createSignedUrl(`${session.user.id}/avatar`, 3600)
      .then(({ data }) => { if (data?.signedUrl) setAvatar(data.signedUrl); })
      .catch(() => undefined);

    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
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
      visibilityCleanup();
      appStateSub.remove();
    };
  }, [session]);

  const syncSeries = (series: Series, entry: PersonalData) => {
    if (!supabase || !session) return;
    supabase.from('series_entries').upsert({
      user_id: session.user.id,
      media_type: series.mediaType ?? 'series',
      tmdb_id: series.tmdbId ?? null,
      poster_path: series.posterPath ?? null,
      title: series.title,
      collection: series.collection,
      watched_episodes: entry.watchedEpisodes ?? series.watchedEpisodes,
      total_episodes: series.totalEpisodes,
      rating: entry.rating ?? null,
      review: entry.review ?? null,
      last_watched: entry.lastWatched ?? null,
    }, { onConflict: 'user_id,media_type,title' }).then(() => undefined);
  };

  const update = (title: string, changes: PersonalData) =>
    setPersonal((cur) => {
      const next = { ...cur, [title]: { ...cur[title], ...changes } };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      const series = library.find((s) => s.title === title);
      if (series) syncSeries(series, next[title]);
      return next;
    });

  const addFromCatalog = async (item: TmdbResult) => {
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

    const entry: Series = {
      title: item.title,
      mediaType: item.mediaType,
      tmdbId: item.id,
      posterPath,
      backdropPath,
      overview,
      collection: 'watching',
      watchedEpisodes: 0,
      totalEpisodes,
    };

    setLibrary((cur) => {
      const filtered = cur.filter((s) => !(s.tmdbId === item.id && s.mediaType === item.mediaType));
      const next = [entry, ...filtered];
      AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(next)).catch(() => undefined);
      syncSeries(entry, {});
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

  const addToWatchlist = (item: TmdbResult) => {
    // If it's already in library, remove from library
    removeFromLibrary(item.title, item.id);

    setWatchlist((cur) => {
      if (cur.some((w) => w.id === item.id && w.mediaType === item.mediaType)) return cur;
      const next = [item, ...cur];
      AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)).catch(() => undefined);
      if (supabase && session) {
        supabase.from('watchlist').upsert({
          user_id: session.user.id,
          tmdb_id: item.id,
          media_type: item.mediaType,
          title: item.title,
          poster_path: item.posterPath ?? null,
          overview: item.overview ?? null,
        }, { onConflict: 'user_id,tmdb_id,media_type' }).then(() => undefined);
      }
      return next;
    });
  };

  const removeFromWatchlist = (item: { id?: number; title?: string; mediaType?: string }) => {
    setWatchlist((cur) => {
      const next = cur.filter((w) => {
        const idMatch = Boolean(item.id && item.id !== 0 && w.id === item.id);
        const titleMatch = Boolean(item.title && w.title && w.title.trim().toLowerCase() === item.title.trim().toLowerCase());
        return !(idMatch || titleMatch);
      });
      AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)).catch(() => undefined);
      if (supabase && session) {
        if (item.id && item.id !== 0) {
          supabase.from('watchlist').delete()
            .match({ user_id: session.user.id, tmdb_id: item.id })
            .then(() => undefined);
        } else if (item.title) {
          supabase.from('watchlist').delete()
            .match({ user_id: session.user.id, title: item.title })
            .then(() => undefined);
        }
      }
      return next;
    });
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
      if (result.data?.session?.user?.id) {
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

    // 1. Persist directly to profiles table so all devices (mobile + PC) sync the photo
    try {
      await supabase.from('profiles').upsert({
        id: session.user.id,
        avatar_url: uri,
        updated_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }

    // 2. Also persist to user_metadata in Supabase Auth
    try {
      await supabase.auth.updateUser({
        data: { avatar_url: uri },
      });
    } catch { /* ignore */ }

    // 3. Try to upload to storage bucket
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
      await supabase.auth.updateUser({
        data: { banner_url: uri },
      });
    } catch { /* ignore */ }

    try {
      await supabase.from('profiles').upsert({
        id: session.user.id,
        banner_url: uri,
        updated_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }
  };

  const removeBanner = async () => {
    setBanner(null);
    AsyncStorage.removeItem(BANNER_KEY).catch(() => undefined);
    if (!supabase || !session) return;

    try {
      await supabase.auth.updateUser({
        data: { banner_url: null },
      });
    } catch { /* ignore */ }

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
      {...panResponder.panHandlers}
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
          open={setSelected}
          onRemove={removeFromWatchlist}
          onAddToWatchlist={addToWatchlist}
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
        />
      )}
    </Animated.View>
  );

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      {selected ? (
        <SeriesDetailModal
          item={selected}
          library={library}
          watchlist={watchlist}
          personal={personal[selected.title] ?? {}}
          progress={'collection' in selected ? progress(selected) : 0}
          onClose={() => setSelected(null)}
          onAddToLibrary={addFromCatalog}
          onRemoveFromLibrary={() => {
            // Keep modal open, just remove from library state
            const tid = 'tmdbId' in selected ? selected.tmdbId : ('id' in selected ? selected.id : undefined);
            removeFromLibrary(selected.title, tid);
          }}
          onAddToWatchlist={(tmdbItem) => {
            addToWatchlist(tmdbItem);
          }}
          onRemoveFromWatchlist={(tmdbItem) => {
            // Keep modal open, just remove from watchlist state
            removeFromWatchlist(tmdbItem);
          }}
          onUpdatePersonal={(changes) => update(selected.title, changes)}
          lang={lang}
        />
      ) : (
        <>
          {tabContent}
          <View style={{ backgroundColor: C.surface }}>
            <TabBar tab={tab} setTab={goToTab} lang={lang} />
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
      .filter((s) => s.collection === 'watching' && progress(s) < s.totalEpisodes)
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
          <View style={homeSt.titleWithIcon}>
            <Image source={require('./assets/icon.png')} style={homeSt.titleIcon} />
            <Text style={[styles.pageTitle, { marginTop: 0 }]}>{t.home}</Text>
          </View>
        </View>

        {/* Bordeaux Outline Add icon button */}
        <Pressable onPress={onOpenSearch} style={homeSt.searchOutlineBtn}>
          <SearchIcon size={14} color={C.bordeaux} />
          <Text style={homeSt.searchOutlineText}>{t.addContent}</Text>
        </Pressable>
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
            {continueWatching.map((s) => (
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
                    <Text style={homeSt.epBadgeText}>
                      {progress(s)}/{s.totalEpisodes}
                    </Text>
                  </View>
                </View>
                <Text style={homeSt.compactTitle} numberOfLines={2}>{s.title}</Text>
              </Pressable>
            ))}
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
            {recentActivity.map((s) => (
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
                </View>
                <Text style={homeSt.compactTitle} numberOfLines={2}>{s.title}</Text>
              </Pressable>
            ))}
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
  const t = i18n[lang];
  const [filter, setFilter] = useState<'all' | 'series' | 'movies'>('all');
  const [query, setQuery] = useState('');
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
                    <Pressable
                      style={[
                        catSt.addButton,
                        inLib && { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (!inLib) {
                          onAddToLibrary(item);
                        } else {
                          open(item);
                        }
                      }}
                    >
                      <Text style={[catSt.addText, inLib && { color: C.muted }]}>
                        {inLib ? '✓' : `+ ${lang === 'pt' ? 'Adicionar' : 'Add'}`}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
          />
        )
      ) : (
        <FlatList
          data={filteredMyLibrary}
          keyExtractor={(s) => `${s.mediaType ?? 'series'}-${s.tmdbId ?? s.title}`}
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
  open,
  onRemove,
  onAddToWatchlist,
  lang,
}: {
  items: TmdbResult[];
  library: Series[];
  open: (item: TmdbResult | Series) => void;
  onRemove: (item: TmdbResult) => void;
  onAddToWatchlist: (item: TmdbResult) => void;
  lang: Language;
}) {
  const t = i18n[lang];
  const [isCompact, setIsCompact] = useState(true);
  const [query, setQuery] = useState('');
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={styles.pageTitle}>{t.watchlist}</Text>
          {!isSearchingCatalog && (
            <Pressable onPress={() => setIsCompact(!isCompact)} style={wlSt.viewModeBtn}>
              <Text style={wlSt.viewModeIcon}>{isCompact ? '☰ List' : '▦ Grid'}</Text>
            </Pressable>
          )}
        </View>
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
                    <Pressable
                      style={[
                        catSt.addButton,
                        inWl
                          ? { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }
                          : { backgroundColor: '#C4A35A' },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (!inWl) {
                          onAddToWatchlist(item);
                        } else {
                          open(item);
                        }
                      }}
                    >
                      <Text style={[catSt.addText, inWl && { color: C.muted }]}>
                        {inWl ? '✓' : `⭐ + ${lang === 'pt' ? 'Watchlist' : 'Watchlist'}`}
                      </Text>
                    </Pressable>
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
          key="compact-grid"
          data={displayItems}
          numColumns={3}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          contentContainerStyle={wlSt.gridContainer}
          columnWrapperStyle={wlSt.gridRow}
          showsVerticalScrollIndicator={false}
          overScrollMode="always"
          bounces
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} style={wlSt.gridCard}>
              <View style={wlSt.gridPoster}>
                {item.posterPath ? (
                  <Image source={{ uri: posterUrl(item.posterPath) }} style={wlSt.gridPosterImg} resizeMode="cover" />
                ) : (
                  <Text style={homeSt.fallbackPosterText}>{item.title.slice(0, 1)}</Text>
                )}
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onRemove(item);
                  }}
                  style={wlSt.removeBadge}
                >
                  <Text style={wlSt.removeBadgeText}>✕</Text>
                </Pressable>
              </View>
              <Text style={wlSt.gridTitle} numberOfLines={2}>{item.title}</Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          key="detailed-list"
          data={displayItems}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          overScrollMode="always"
          bounces
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} style={catSt.watchlistRow}>
              <PosterThumb posterPath={item.posterPath} title={item.title} size="sm" />
              <View style={[styles.rowBody, { marginLeft: 12 }]}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>{item.mediaType === 'movie' ? 'Movie' : 'Series'}</Text>
                {item.overview ? (
                  <Text numberOfLines={2} style={catSt.overview}>{item.overview}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => onRemove(item)} style={catSt.removeButton}>
                <Text style={catSt.removeText}>✕</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

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
}) {
  const t = i18n[lang];
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [draftUsername, setDraftUsername] = useState(username);
  const [draftBio, setDraftBio] = useState(bio);

  useEffect(() => {
    setDraftUsername(username);
  }, [username]);

  useEffect(() => {
    setDraftBio(bio);
  }, [bio]);

  const [seeAllModal, setSeeAllModal] = useState<{
    visible: boolean;
    title: string;
    items: (Series | TmdbResult)[];
  }>({ visible: false, title: '', items: [] });

  const seriesWatched = library.filter((s) => progress(s) >= s.totalEpisodes && s.totalEpisodes > 0).length;
  const episodesWatched = library.reduce((sum, s) => sum + progress(s), 0);
  const seriesRemaining = library.filter((s) => progress(s) < s.totalEpisodes && s.collection !== 'up_to_date').length;
  const episodesRemaining = library.reduce((sum, s) => sum + Math.max(0, s.totalEpisodes - progress(s)), 0);
  const toWatch = watchlist.length;

  // Continue watching list (sorted by lastWatched)
  const continueWatching = useMemo(() =>
    library
      .filter((s) => s.collection === 'watching' && progress(s) < s.totalEpisodes)
      .sort((a, b) => lastWatched(b) - lastWatched(a)),
    [library, progress, lastWatched],
  );

  // Recent activity list
  const recentActivity = useMemo(() =>
    library
      .filter((s) => lastWatched(s) > 0)
      .sort((a, b) => lastWatched(b) - lastWatched(a)),
    [library, lastWatched],
  );

  // Completed / watched series
  const completedSeries = useMemo(() =>
    library.filter((s) => progress(s) >= s.totalEpisodes && s.totalEpisodes > 0),
    [library, progress],
  );

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={profSt.scrollContent}
        showsVerticalScrollIndicator={false}
        overScrollMode="always"
        bounces
      >
        {/* Banner Area (wrapping Header, Avatar, Username, Bio, Edit Profile & Fading out towards bottom) */}
        <View style={profSt.bannerContainer}>
          {banner ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Image source={{ uri: banner }} style={profSt.bannerImage} resizeMode="cover" />
              {/* Fade gradient overlay before entering dashBar */}
              <View
                style={[
                  profSt.bannerGradient,
                  Platform.OS === 'web' && ({
                    backgroundImage:
                      'linear-gradient(to bottom, rgba(16, 12, 13, 0.25) 0%, rgba(16, 12, 13, 0.45) 45%, rgba(16, 12, 13, 0.8) 75%, rgba(16, 12, 13, 0.98) 95%, #100C0D 100%)',
                  } as any),
                ]}
              />
              <svg
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              >
                <defs>
                  <linearGradient id="bannerBottomFade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#100C0D" stopOpacity="0.25" />
                    <stop offset="45%" stopColor="#100C0D" stopOpacity="0.45" />
                    <stop offset="75%" stopColor="#100C0D" stopOpacity="0.85" />
                    <stop offset="95%" stopColor="#100C0D" stopOpacity="0.98" />
                    <stop offset="100%" stopColor="#100C0D" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <rect width="100" height="100" fill="url(#bannerBottomFade)" />
              </svg>
            </View>
          ) : null}

          {/* Header Row over the cover banner */}
          <View style={profSt.headerRowOverBanner}>
            <Text style={profSt.headerTitle}>{t.profile}</Text>
            <Pressable onPress={onOpenSettings} style={profSt.gearButton} hitSlop={10}>
              <Text style={profSt.gearIcon}>⚙</Text>
            </Pressable>
          </View>

          {/* Clean Avatar Display (photo change controls are inside the gear ⚙) */}
          <View style={profSt.avatarDisplayWrapper}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={profSt.avatar} />
            ) : (
              <View style={profSt.avatarPlaceholder}>
                <Text style={profSt.avatarIcon}>👤</Text>
              </View>
            )}
          </View>

          {/* User Info (Username, Bio, Edit Profile button) */}
          <View style={profSt.userInfoContainer}>
            <Text style={profSt.usernameText}>
              {username ? `@${username}` : (email ? `@${email.split('@')[0]}` : '@user')}
            </Text>
            {bio ? <Text style={profSt.bioText}>{bio}</Text> : null}
            <Pressable
              onPress={() => {
                setDraftUsername(username);
                setDraftBio(bio);
                setEditModalOpen(true);
              }}
              style={profSt.editProfileBtn}
            >
              <Text style={profSt.editProfileBtnText}>✎ {t.editProfile}</Text>
            </Pressable>
          </View>
        </View>

        {/* Ultra-compact Dashboard line: Séries Vistas, Séries por Acabar, Watchlist */}
        <View style={profSt.dashBar}>
          <View style={profSt.dashItem}>
            <Text style={profSt.dashNumber}>{seriesWatched}</Text>
            <Text style={profSt.dashLabel} numberOfLines={1}>{t.seriesWatched}</Text>
          </View>
          <View style={profSt.dashSep} />
          <View style={profSt.dashItem}>
            <Text style={profSt.dashNumber}>{seriesRemaining}</Text>
            <Text style={profSt.dashLabel} numberOfLines={1}>{t.seriesToFinish}</Text>
          </View>
          <View style={profSt.dashSep} />
          <View style={profSt.dashItem}>
            <Text style={profSt.dashNumber}>{toWatch}</Text>
            <Text style={profSt.dashLabel} numberOfLines={1}>{t.onWatchlist}</Text>
          </View>
        </View>

        {/* Continue Watching section in Profile */}
        <View style={{ marginTop: 22 }}>
          <View style={profSt.sectionBar}>
            <Text style={styles.sectionHeader}>{t.continueWatching}</Text>
            <Pressable
              onPress={() =>
                setSeeAllModal({
                  visible: true,
                  title: t.continueWatching,
                  items: continueWatching,
                })
              }
              style={profSt.seeAllBtn}
            >
              <Text style={profSt.seeAllText}>{t.seeAll} ›</Text>
            </Pressable>
          </View>

          {continueWatching.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              overScrollMode="always"
              bounces
              contentContainerStyle={profSt.hCardRow}
              style={{ marginHorizontal: -22, marginTop: 8 }}
            >
              {continueWatching.slice(0, 6).map((s) => (
                <Pressable
                  key={`prof-cw-${s.mediaType}-${s.tmdbId ?? s.title}`}
                  onPress={() => open(s)}
                  style={profSt.hCard}
                >
                  <View style={profSt.hPoster}>
                    {s.posterPath ? (
                      <Image source={{ uri: posterUrl(s.posterPath) }} style={profSt.hPosterImg} resizeMode="cover" />
                    ) : (
                      <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                    )}
                  </View>
                  <Text style={profSt.hTitle} numberOfLines={2}>{s.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={homeSt.emptySectionCard}>
              <Text style={homeSt.emptySectionText}>
                {lang === 'pt' ? 'Nenhuma série a decorrer.' : 'No series in progress.'}
              </Text>
            </View>
          )}
        </View>

        {/* Recent Activity section in Profile */}
        <View style={{ marginTop: 22 }}>
          <View style={profSt.sectionBar}>
            <Text style={styles.sectionHeader}>{t.recentActivity}</Text>
            <Pressable
              onPress={() =>
                setSeeAllModal({
                  visible: true,
                  title: t.recentActivity,
                  items: recentActivity,
                })
              }
              style={profSt.seeAllBtn}
            >
              <Text style={profSt.seeAllText}>{t.seeAll} ›</Text>
            </Pressable>
          </View>

          {recentActivity.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              overScrollMode="always"
              bounces
              contentContainerStyle={profSt.hCardRow}
              style={{ marginHorizontal: -22, marginTop: 8 }}
            >
              {recentActivity.slice(0, 6).map((s) => (
                <Pressable
                  key={`prof-ra-${s.mediaType}-${s.tmdbId ?? s.title}`}
                  onPress={() => open(s)}
                  style={profSt.hCard}
                >
                  <View style={profSt.hPoster}>
                    {s.posterPath ? (
                      <Image source={{ uri: posterUrl(s.posterPath) }} style={profSt.hPosterImg} resizeMode="cover" />
                    ) : (
                      <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                    )}
                  </View>
                  <Text style={profSt.hTitle} numberOfLines={2}>{s.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={homeSt.emptySectionCard}>
              <Text style={homeSt.emptySectionText}>
                {lang === 'pt' ? 'Sem atividade recente.' : 'No recent activity.'}
              </Text>
            </View>
          )}
        </View>

        {/* Watchlist section in Profile */}
        <View style={{ marginTop: 22 }}>
          <View style={profSt.sectionBar}>
            <Text style={styles.sectionHeader}>{t.watchlist}</Text>
            <Pressable
              onPress={() =>
                setSeeAllModal({
                  visible: true,
                  title: t.watchlist,
                  items: watchlist,
                })
              }
              style={profSt.seeAllBtn}
            >
              <Text style={profSt.seeAllText}>{t.seeAll} ›</Text>
            </Pressable>
          </View>

          {watchlist.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              overScrollMode="always"
              bounces
              contentContainerStyle={profSt.hCardRow}
              style={{ marginHorizontal: -22, marginTop: 8 }}
            >
              {watchlist.slice(0, 6).map((w) => (
                <Pressable
                  key={`prof-wl-${w.mediaType}-${w.id}`}
                  onPress={() => open(w)}
                  style={profSt.hCard}
                >
                  <View style={profSt.hPoster}>
                    {w.posterPath ? (
                      <Image source={{ uri: posterUrl(w.posterPath) }} style={profSt.hPosterImg} resizeMode="cover" />
                    ) : (
                      <Text style={homeSt.fallbackPosterText}>{w.title.slice(0, 1)}</Text>
                    )}
                  </View>
                  <Text style={profSt.hTitle} numberOfLines={2}>{w.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={homeSt.emptySectionCard}>
              <Text style={homeSt.emptySectionText}>
                {lang === 'pt' ? 'A tua watchlist está vazia.' : 'Your watchlist is empty.'}
              </Text>
            </View>
          )}
        </View>

        {/* Watched Series section in Profile (under Watchlist) */}
        <View style={{ marginTop: 22 }}>
          <View style={profSt.sectionBar}>
            <Text style={styles.sectionHeader}>{t.seriesWatched}</Text>
            <Pressable
              onPress={() =>
                setSeeAllModal({
                  visible: true,
                  title: t.seriesWatched,
                  items: completedSeries,
                })
              }
              style={profSt.seeAllBtn}
            >
              <Text style={profSt.seeAllText}>{t.seeAll} ›</Text>
            </Pressable>
          </View>

          {completedSeries.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              overScrollMode="always"
              bounces
              contentContainerStyle={profSt.hCardRow}
              style={{ marginHorizontal: -22, marginTop: 8 }}
            >
              {completedSeries.slice(0, 6).map((s) => (
                <Pressable
                  key={`prof-comp-${s.mediaType}-${s.tmdbId ?? s.title}`}
                  onPress={() => open(s)}
                  style={profSt.hCard}
                >
                  <View style={profSt.hPoster}>
                    {s.posterPath ? (
                      <Image source={{ uri: posterUrl(s.posterPath) }} style={profSt.hPosterImg} resizeMode="cover" />
                    ) : (
                      <Text style={homeSt.fallbackPosterText}>{s.title.slice(0, 1)}</Text>
                    )}
                  </View>
                  <Text style={profSt.hTitle} numberOfLines={2}>{s.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={homeSt.emptySectionCard}>
              <Text style={homeSt.emptySectionText}>
                {lang === 'pt' ? 'Ainda não terminaste nenhuma série.' : 'No completed series yet.'}
              </Text>
            </View>
          )}
        </View>

        {/* App Version Footer */}
        <View style={profSt.versionFooter}>
          <Text style={profSt.versionText}>{t.versionText}</Text>
        </View>

      {/* See All Full Modal */}
      <Modal visible={seeAllModal.visible} animationType="slide">
        <SafeAreaView style={styles.safe}>
          <View style={catSt.header}>
            <Pressable onPress={() => setSeeAllModal({ visible: false, title: '', items: [] })}>
              <Text style={styles.back}>‹ {t.close}</Text>
            </Pressable>
            <Text style={catSt.title}>{seeAllModal.title}</Text>
          </View>

          <FlatList
            data={seeAllModal.items}
            numColumns={3}
            keyExtractor={(it, idx) => ('tmdbId' in it ? `s-${it.tmdbId ?? it.title}` : `w-${'id' in it ? it.id : idx}`)}
            contentContainerStyle={wlSt.gridContainer}
            columnWrapperStyle={wlSt.gridRow}
            showsVerticalScrollIndicator={false}
            overScrollMode="always"
            bounces
            renderItem={({ item: it }) => (
              <Pressable
                onPress={() => {
                  setSeeAllModal({ visible: false, title: '', items: [] });
                  open(it);
                }}
                style={wlSt.gridCard}
              >
                <View style={wlSt.gridPoster}>
                  {it.posterPath ? (
                    <Image source={{ uri: posterUrl(it.posterPath) }} style={wlSt.gridPosterImg} resizeMode="cover" />
                  ) : (
                    <Text style={homeSt.fallbackPosterText}>{it.title.slice(0, 1)}</Text>
                  )}
                </View>
                <Text style={wlSt.gridTitle} numberOfLines={2}>{it.title}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Settings Modal (Language, Photo/Cover Customization & Sign out) */}
      <Modal visible={settingsOpen} animationType="slide" transparent>
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
      <Modal visible={editModalOpen} animationType="slide" transparent>
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
      </ScrollView>
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
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (!isDragging.current) {
      Animated.spring(translateX, {
        toValue: getTargetX(state),
        friction: 7,
        tension: 65,
        useNativeDriver: true,
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
      useNativeDriver: true,
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
            useNativeDriver: true,
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

      <Text style={sliderSt.hintText}>
        {lang === 'pt'
          ? '← Biblioteca • Centro para remover • Watchlist →'
          : '← Library • Center to remove • Watchlist →'}
      </Text>
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
  onAddToLibrary: (tmdbItem: TmdbResult) => void;
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
    onUpdatePersonal({
      watchedEpList: arr,
      watchedEpisodes: arr.filter((k) => k !== 'MOVIE').length,
      lastWatched: Date.now(),
    });
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
    onUpdatePersonal({
      watchedEpList: arr,
      watchedEpisodes: arr.filter((k) => k !== 'MOVIE').length,
      lastWatched: Date.now(),
    });
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
    onUpdatePersonal({
      watchedEpList: arr,
      watchedEpisodes: arr.filter((k) => k !== 'MOVIE').length,
      lastWatched: Date.now(),
    });
  };

  // Toggle watched for Movie
  const isMovieWatched = watchedEpSet.has('MOVIE');
  const toggleMovieWatched = () => {
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

  const handleDestinationChange = (newDest: 'library' | 'watchlist' | 'none') => {
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
      });
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
              <View style={{ flex: 1 }}>
                <Text style={detailSt.episodeNameText}>{item.title}</Text>
                <Text style={detailSt.movieSubText}>
                  {isMovieWatched ? t.watched : t.markAsWatched}
                </Text>
              </View>

              {/* Bold Golden High-Contrast Eye Button */}
              <View style={[detailSt.eyeCircle, isMovieWatched && detailSt.eyeCircleWatched]}>
                <Text style={detailSt.eyeLargeGlyph}>
                  {isMovieWatched ? '👁' : '👁‍🗨'}
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
                  <View>
                    <Text style={detailSt.seasonTitleText}>
                      {details.seasons.find((s) => s.seasonNumber === selectedSeason)?.name || `${t.season} ${selectedSeason}`}
                    </Text>
                    {(() => {
                      const sWatched = seasonWatchedCount(selectedSeason);
                      const sTotal = details.seasons.find((s) => s.seasonNumber === selectedSeason)?.episodeCount ?? seasonEpisodes[selectedSeason]?.length ?? 0;
                      const sLeft = Math.max(0, sTotal - sWatched);
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
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
                <ActivityIndicator color={C.cream} style={{ marginTop: 20 }} />
              ) : typeof selectedSeason === 'number' && seasonEpisodes[selectedSeason] ? (
                <View style={detailSt.episodesList}>
                  {seasonEpisodes[selectedSeason].map((ep) => {
                    const epKey = `S${selectedSeason}E${ep.episodeNumber}`;
                    const isWatched = watchedEpSet.has(epKey);

                    return (
                      <Pressable
                        key={epKey}
                        onPress={() => toggleEpisodeWatched(selectedSeason, ep.episodeNumber)}
                        style={detailSt.episodeRow}
                      >
                        <View style={{ flex: 1 }}>
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

                        {/* High-Contrast Large Eye Button */}
                        <View style={[detailSt.eyeCircle, isWatched && detailSt.eyeCircleWatched]}>
                          <Text style={detailSt.eyeLargeGlyph}>
                            {isWatched ? '👁' : '👁‍🗨'}
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
                      <Pressable
                        style={catSt.addButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedTargetItem(item);
                        }}
                      >
                        <Text style={catSt.addText}>+ Add</Text>
                      </Pressable>
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

function TabBar({ tab, setTab, lang }: { tab: Tab; setTab: (t: Tab) => void; lang: Language }) {
  const t = i18n[lang];
  const tabs: [Tab, string, string][] = [
    ['home', '⌂', t.home],
    ['library', '▦', t.library],
    ['watchlist', '☆', t.watchlist],
    ['profile', '◉', t.profile],
  ];

  return (
    <View style={styles.tabbar}>
      {tabs.map(([key, icon, label]) => {
        const isActive = tab === key;
        return (
          <Pressable key={key} onPress={() => setTab(key)} style={styles.tab}>
            <Animated.Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
              {icon}
            </Animated.Text>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
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
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.9,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.55,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
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
  titleIcon: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: C.border },
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
  compactTitle: { color: C.cream, fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center', lineHeight: 16 },
  epBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(16,12,13,0.92)', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: '#5C2D37',
  },
  epBadgeText: { color: C.gold, fontSize: 12.5, fontWeight: '900', letterSpacing: 0.5 },
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
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

const wlSt = StyleSheet.create({
  viewModeBtn: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12,
  },
  viewModeIcon: { color: C.gold, fontSize: 13, fontWeight: '700' },
  gridContainer: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 10 },
  gridRow: { justifyContent: 'flex-start', gap: 12, marginBottom: 16 },
  gridCard: { width: (SCREEN_W - 32 - 24) / 3, alignItems: 'center' },
  gridPoster: {
    width: '100%', aspectRatio: 2 / 3, borderRadius: 8,
    overflow: 'hidden', backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.border, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  gridPosterImg: { width: '100%', height: '100%' },
  gridTitle: { color: C.cream, fontSize: 13, fontWeight: '600', marginTop: 5, textAlign: 'center', lineHeight: 16 },
  removeBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10,
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
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 16, marginTop: 4,
  },
  editProfileBtnText: { color: C.gold, fontSize: 13.5, fontWeight: '700' },
  inputLabel: { color: C.gold, fontSize: 13.5, fontWeight: '700', marginBottom: 6 },
  textInput: {
    backgroundColor: C.surface2, color: C.cream, height: 46, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 16.5, borderWidth: 1, borderColor: C.border,
  },
  bioInput: { height: 78, paddingTop: 10, textAlignVertical: 'top' },
  accountEmail: { color: C.muted, fontSize: 15, textAlign: 'center' },
  signOutButton: { marginTop: 14, backgroundColor: C.bordeaux, borderRadius: 10, padding: 13, alignItems: 'center' },
  signOutText: { color: C.cream, fontWeight: '800', fontSize: 15 },
  dashBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 4,
  },
  dashItem: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  dashNumber: { color: C.bordeauxLight, fontSize: 18, fontWeight: '800' },
  dashLabel: { color: C.muted, fontSize: 11.5, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  dashSep: { width: 1, height: 22, backgroundColor: C.border },
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
  hTitle: { color: C.cream, fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'center', lineHeight: 15 },
  settingsSectionLabel: { color: C.gold, fontWeight: '700', fontSize: 15, marginTop: 16, marginBottom: 8 },
  // Settings Media Customization (Photo & Cover)
  settingsMediaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  settingsMediaCard: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  settingsMediaTitle: { color: C.cream, fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
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
  settingBannerEmptyText: { color: C.muted, fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  settingBannerBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' },
  settingActionBtn: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, alignItems: 'center',
    justifyContent: 'center', width: '100%',
  },
  settingActionBtnText: { color: C.gold, fontSize: 12, fontWeight: '700' },
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
  langBtnText: { color: C.muted, fontWeight: '700', fontSize: 13.5 },
  langBtnTextActive: { color: C.cream },
  versionFooter: {
    marginTop: 40,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionText: {
    color: C.muted,
    fontSize: 13.5,
    fontWeight: '600',
    opacity: 0.65,
    letterSpacing: 0.8,
  },
});

const sliderSt = StyleSheet.create({
  container: {
    marginVertical: 18,
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
    height: 50,
    borderRadius: 25,
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
    height: 42,
    borderRadius: 21,
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
    fontSize: 12.5,
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
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  hintText: {
    color: '#8A6A72',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
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
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  seeMoreBtn: {
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
  },
  seeMoreText: {
    color: C.gold,
    fontSize: 12.5,
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
  actionBtnText: { color: C.cream, fontWeight: '800', fontSize: 14.5 },
  actionBtnTextActive: { color: C.cream },
  // Movie specific view
  movieSection: { marginTop: 10 },
  movieCardRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, padding: 18, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, marginTop: 10,
  },
  movieSubText: { color: C.gold, fontSize: 13.5, marginTop: 4, fontWeight: '600' },
  // Series view
  seasonsSection: { marginTop: 10 },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: { color: C.cream, fontSize: 20, fontWeight: '800' },
  bulkSeriesBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  bulkSeriesBtnActive: {
    backgroundColor: C.bordeaux,
    borderColor: C.bordeaux,
  },
  bulkSeriesBtnText: {
    color: C.gold,
    fontSize: 12.5,
    fontWeight: '800',
  },
  bulkSeriesBtnTextActive: {
    color: C.cream,
  },
  seasonPillsRow: { gap: 8, paddingBottom: 12 },
  seasonPill: {
    paddingHorizontal: 15, paddingVertical: 8, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  seasonPillActive: {
    backgroundColor: C.bordeaux, borderColor: C.bordeaux,
  },
  seasonPillWatched: {
    borderColor: C.bordeaux,
    backgroundColor: '#261418',
  },
  seasonPillText: { color: C.muted, fontSize: 13.5, fontWeight: '700' },
  seasonPillTextActive: { color: C.cream },
  seasonPillTextWatched: { color: C.gold },
  seasonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 8,
    marginBottom: 10,
  },
  seasonTitleText: {
    color: C.cream,
    fontSize: 16,
    fontWeight: '800',
  },
  seasonMetaText: {
    color: C.gold,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  seasonMetaRemaining: {
    color: '#E0A868',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  seasonMetaCompleted: {
    color: '#68D391',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  seasonToggleBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
  },
  seasonToggleBtnActive: {
    backgroundColor: C.bordeaux,
    borderColor: C.bordeaux,
  },
  seasonToggleBtnText: {
    color: C.cream,
    fontSize: 12.5,
    fontWeight: '700',
  },
  seasonToggleBtnTextActive: {
    color: C.cream,
    fontWeight: '800',
  },
  episodesList: { marginTop: 8, gap: 10 },
  episodeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
  },
  episodeNumberText: { color: C.gold, fontSize: 12.5, fontWeight: '800', marginBottom: 2 },
  episodeNameText: { color: C.cream, fontSize: 16, fontWeight: '700' },
  episodeOverviewText: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  // Eye icon - High visibility badge
  eyeCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
  },
  eyeCircleWatched: {
    backgroundColor: C.bordeaux, borderColor: C.gold,
  },
  eyeLargeGlyph: {
    fontSize: 22,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
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
  chipText: { color: C.muted, fontSize: 13.5, fontWeight: '600' },
  chipTextActive: { color: C.cream },
  list: { paddingHorizontal: 22, paddingBottom: 100 },
  seriesRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  poster: { height: 60, width: 42, borderRadius: 6, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  posterText: { color: C.bordeaux, fontSize: 18, fontWeight: '800' },
  rowBody: { flex: 1, marginLeft: 14 },
  rowTitle: { color: C.cream, fontSize: 17, fontWeight: '700' },
  rowMeta: { color: C.muted, fontSize: 13, marginTop: 2 },
  rowProgress: { color: C.gold, fontSize: 14.5, fontWeight: '800', marginTop: 3 },
  rowProgressRemaining: { color: '#E0A868', fontSize: 14.5, fontWeight: '700', marginTop: 3 },
  rowProgressCompleted: { color: '#68D391', fontSize: 14.5, fontWeight: '800', marginTop: 3 },
  chevron: { color: C.border, fontSize: 22 },
  tabbar: {
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6,
    paddingBottom: (Platform.OS === 'web'
      ? 'max(10px, env(safe-area-inset-bottom, 10px))'
      : Platform.OS === 'ios'
      ? 28
      : 8) as any,
  },
  tab: { alignItems: 'center', minWidth: 60, flex: 1, paddingVertical: 2 },
  tabIcon: { color: C.muted, fontSize: 22 },
  tabIconActive: { color: C.bordeaux, transform: [{ scale: 1.15 }] },
  tabLabel: { color: C.muted, fontSize: 11.5, marginTop: 2 },
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
