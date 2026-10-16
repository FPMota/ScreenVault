import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
const LANG_KEY = '@screenvault/lang-v1';
const USERNAME_KEY = '@screenvault/username-v1';
const BIO_KEY = '@screenvault/bio-v1';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Translations ─────────────────────────────────────────────────────────────

const i18n = {
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
    all: 'All',
    watching: 'Watching',
    finishedToContinue: 'Finished – To Continue',
    upToDate: 'Up to Date',
    episodesWatched: 'episodes watched',
    episodes: 'episodes',
    of: 'of',
    ep: 'Ep',
    emptyHome: 'No activity yet. Tap Search to discover shows and movies!',
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
    all: 'Todas',
    watching: 'A ver',
    finishedToContinue: 'Terminadas por ver',
    upToDate: 'Em dia',
    episodesWatched: 'episódios vistos',
    episodes: 'episódios',
    of: 'de',
    ep: 'Ep',
    emptyHome: 'Ainda sem atividade. Clica em Pesquisar para adicionar séries e filmes!',
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

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [lang, setLang] = useState<Language>('en');

  const [tab, setTab] = useState<Tab>('home');
  const [selected, setSelected] = useState<Series | TmdbResult | null>(null);
  const [personal, setPersonal] = useState<Record<string, PersonalData>>({});
  const [library, setLibrary] = useState<Series[]>([]);
  const [watchlist, setWatchlist] = useState<TmdbResult[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Tab switch horizontal animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const tabOpacity = useRef(new Animated.Value(1)).current;
  const tabIndexRef = useRef(0);

  const goToTab = (next: Tab) => {
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

  // Load initial local data
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(LIBRARY_KEY),
      AsyncStorage.getItem(WATCHLIST_KEY),
      AsyncStorage.getItem(AVATAR_KEY),
      AsyncStorage.getItem(LANG_KEY),
      AsyncStorage.getItem(USERNAME_KEY),
      AsyncStorage.getItem(BIO_KEY),
    ])
      .then(([p, l, w, a, la, un, bi]) => {
        if (p) setPersonal(JSON.parse(p));
        if (l) setLibrary(JSON.parse(l));
        if (w) setWatchlist(JSON.parse(w));
        if (a) setAvatar(a);
        if (la === 'en' || la === 'pt') setLang(la);
        if (un) setUsername(un);
        if (bi) setBio(bi);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    AsyncStorage.setItem(LANG_KEY, newLang).catch(() => undefined);
  };

  // Supabase Auth listener
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // Supabase Cloud Sync
  useEffect(() => {
    if (!supabase || !session) return;

    supabase.from('series_entries').select('*').order('title').then(({ data, error }) => {
      if (error || !data) return;
      const cl: Series[] = data.map((r) => ({
        title: r.title,
        collection: r.collection as Collection,
        watchedEpisodes: r.watched_episodes,
        totalEpisodes: r.total_episodes,
        mediaType: r.media_type as 'series' | 'movie',
        tmdbId: r.tmdb_id ?? undefined,
        posterPath: r.poster_path ?? undefined,
        lastWatched: r.last_watched ?? undefined,
      }));
      const cp = Object.fromEntries(
        data
          .filter((r) => r.rating || r.review || r.last_watched)
          .map((r) => [
            r.title,
            {
              rating: r.rating ?? undefined,
              review: r.review ?? undefined,
              lastWatched: r.last_watched ?? undefined,
            },
          ]),
      );
      setLibrary(cl);
      setPersonal((cur) => ({ ...cur, ...cp }));
      AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(cl)).catch(() => undefined);
    });

    supabase.storage.from('avatars').createSignedUrl(`${session.user.id}/avatar`, 3600)
      .then(({ data }) => { if (data?.signedUrl) setAvatar(data.signedUrl); })
      .catch(() => undefined);

    supabase.from('profiles').select('username, bio, avatar_url').eq('id', session.user.id).single()
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
        }
      }, () => undefined);

    supabase.from('watchlist').select('*').then(({ data }) => {
      if (!data) return;
      const items: TmdbResult[] = data.map((r) => ({
        id: r.tmdb_id,
        mediaType: r.media_type as 'series' | 'movie',
        title: r.title,
        posterPath: r.poster_path ?? undefined,
        overview: r.overview ?? undefined,
      }));
      setWatchlist(items);
      AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(items)).catch(() => undefined);
    }).then(undefined, () => undefined);
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
    const result = mode === 'signIn'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    return result.error?.message ?? (mode === 'signUp' && !result.data.session ? 'Check your email and confirm your account.' : null);
  };

  const signOut = () => supabase?.auth.signOut();

  const uploadAvatar = async (uri: string) => {
    setAvatar(uri);
    AsyncStorage.setItem(AVATAR_KEY, uri).catch(() => undefined);
    if (!supabase || !session) return;

    // Persist directly to profiles table so all devices (mobile + PC) sync the photo
    try {
      await supabase.from('profiles').upsert({
        id: session.user.id,
        avatar_url: uri,
        updated_at: new Date().toISOString(),
      });
    } catch { /* ignore if column not yet added */ }

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });
      await supabase.storage.from('avatars')
        .upload(`${session.user.id}/avatar`, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
    } catch { /* keep local */ }
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
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>SCREENVAULT</Text>
      </View>
    );
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
          progress={progress}
          open={setSelected}
          onOpenSearch={() => setSearchModalOpen(true)}
          lang={lang}
        />
      )}
      {tab === 'watchlist' && (
        <Watchlist
          items={watchlist}
          open={setSelected}
          onRemove={removeFromWatchlist}
          onOpenSearch={() => setSearchModalOpen(true)}
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
          username={username}
          bio={bio}
          email={session?.user.email}
          onUploadAvatar={uploadAvatar}
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
          <TabBar tab={tab} setTab={goToTab} lang={lang} />
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

      <SafeAreaView style={styles.safe}>
        {/* Language switcher on top right */}
        <View style={authSt.topLangRow}>
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

        {/* Bordeaux Outline Search icon button */}
        <Pressable onPress={onOpenSearch} style={homeSt.searchOutlineBtn}>
          <Text style={homeSt.searchOutlineIcon}>⚲</Text>
          <Text style={homeSt.searchOutlineText}>{t.search}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={homeSt.scrollContent}
        showsVerticalScrollIndicator={false}
        overScrollMode="always"
        bounces
      >

      {/* Continue Watching: Compact Posters, horizontal scroll, no mark watched button */}
      {continueWatching.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.sectionHeader}>{t.continueWatching}</Text>
          <Text style={styles.subtitle}>{t.pickUp}</Text>

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
        </View>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <View style={{ marginTop: continueWatching.length > 0 ? 24 : 12 }}>
          <Text style={styles.sectionHeader}>{t.recentActivity}</Text>
          <Text style={styles.subtitle}>{t.recentActivitySub}</Text>

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
        </View>
      )}

      {continueWatching.length === 0 && recentActivity.length === 0 && (
        <View style={{ marginTop: 24 }}>
          <Empty text={t.emptyHome} />
        </View>
      )}
      </ScrollView>
    </View>
  );
}

// ─── Library Screen ───────────────────────────────────────────────────────────

function Library({
  library,
  progress,
  open,
  onOpenSearch,
  lang,
}: {
  library: Series[];
  progress: (s: Series) => number;
  open: (s: Series) => void;
  onOpenSearch: () => void;
  lang: Language;
}) {
  const t = i18n[lang];
  const [filter, setFilter] = useState<Collection | 'all'>('all');
  const [query, setQuery] = useState('');

  const filterLabels: Record<Collection, string> = {
    watching: t.watching,
    finished_airing_to_continue: t.finishedToContinue,
    up_to_date: t.upToDate,
  };

  const results = useMemo(() =>
    library.filter((s) =>
      (filter === 'all' || s.collection === filter) &&
      s.title.toLowerCase().includes(query.toLowerCase())),
    [library, filter, query]);

  return (
    <View style={styles.flex}>
      <View style={styles.libraryHeader}>
        <Text style={styles.pageTitle}>{t.library}</Text>
        <Pressable onPress={onOpenSearch} style={catSt.addButton}>
          <Text style={catSt.addText}>+ {t.search}</Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t.searchPlaceholder}
        placeholderTextColor="#7e6060"
        style={styles.search}
      />

      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          overScrollMode="always"
          bounces
          contentContainerStyle={styles.filters}
        >
          <Chip label={t.all} active={filter === 'all'} onPress={() => setFilter('all')} />
          {(Object.keys(filterLabels) as Collection[]).map((k) => (
            <Chip key={k} label={filterLabels[k]} active={filter === k} onPress={() => setFilter(k)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={(s) => `${s.mediaType ?? 'series'}-${s.tmdbId ?? s.title}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        overScrollMode="always"
        bounces
        renderItem={({ item }) => (
          <SeriesRow
            series={item}
            watched={progress(item)}
            press={() => open(item)}
            collectionLabel={filterLabels[item.collection]}
            t={t}
          />
        )}
      />
    </View>
  );
}

// ─── Watchlist Screen ─────────────────────────────────────────────────────────

function Watchlist({
  items,
  open,
  onRemove,
  onOpenSearch,
  lang,
}: {
  items: TmdbResult[];
  open: (item: TmdbResult) => void;
  onRemove: (item: TmdbResult) => void;
  onOpenSearch: () => void;
  lang: Language;
}) {
  const t = i18n[lang];
  const [isCompact, setIsCompact] = useState(true);

  return (
    <View style={styles.flex}>
      <View style={styles.libraryHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={styles.pageTitle}>{t.watchlist}</Text>
          <Pressable onPress={() => setIsCompact(!isCompact)} style={wlSt.viewModeBtn}>
            <Text style={wlSt.viewModeIcon}>{isCompact ? '☰ List' : '▦ Grid'}</Text>
          </Pressable>
        </View>
        <Pressable onPress={onOpenSearch} style={catSt.addButton}>
          <Text style={catSt.addText}>+ {t.search}</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={{ paddingHorizontal: 22, marginTop: 14 }}>
          <Empty text={t.emptyWatchlist} />
        </View>
      ) : isCompact ? (
        <FlatList
          key="compact-grid"
          data={items}
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
          data={items}
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
  username,
  bio,
  email,
  onUploadAvatar,
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
  username: string;
  bio: string;
  email?: string;
  onUploadAvatar: (uri: string) => void;
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

  return (
    <View style={styles.flex}>
      {/* Fixed Sticky Header at Top */}
      <View style={profSt.headerRow}>
        <Text style={styles.pageTitle}>{t.profile}</Text>
        <Pressable onPress={onOpenSettings} style={profSt.gearButton}>
          <Text style={profSt.gearIcon}>⚙</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={profSt.scrollContent}
        showsVerticalScrollIndicator={false}
        overScrollMode="always"
        bounces
      >
        <AvatarPicker avatar={avatar} onPick={onUploadAvatar} label={t.changePhoto} />

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

        {/* Ultra-compact Dashboard line */}
        <View style={profSt.dashBar}>
          <View style={profSt.dashItem}>
            <Text style={profSt.dashNumber}>{seriesWatched}</Text>
            <Text style={profSt.dashLabel} numberOfLines={1}>{t.seriesWatched}</Text>
          </View>
          <View style={profSt.dashSep} />
          <View style={profSt.dashItem}>
            <Text style={profSt.dashNumber}>{episodesWatched}</Text>
            <Text style={profSt.dashLabel} numberOfLines={1}>{t.episodesWatchedStat}</Text>
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

      {/* Continue Watching section in Profile (Limited to 6, then See All) */}
      {continueWatching.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <View style={profSt.sectionBar}>
            <Text style={styles.sectionHeader}>{t.continueWatching}</Text>
            {continueWatching.length > 6 ? (
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
            ) : null}
          </View>

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
        </View>
      )}

      {/* Recent Activity section in Profile (Limited to 6, then See All) */}
      {recentActivity.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <View style={profSt.sectionBar}>
            <Text style={styles.sectionHeader}>{t.recentActivity}</Text>
            {recentActivity.length > 6 ? (
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
            ) : null}
          </View>

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
        </View>
      )}

      {/* Watchlist section in Profile (Limited to 6, then See All) */}
      {watchlist.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <View style={profSt.sectionBar}>
            <Text style={styles.sectionHeader}>{t.watchlist}</Text>
            {watchlist.length > 6 ? (
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
            ) : null}
          </View>

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
        </View>
      )}

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

      {/* Settings Modal (Language & Sign out) */}
      <Modal visible={settingsOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t.settings}</Text>

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
              <Text style={profSt.accountEmail}>{t.notSignedIn}</Text>
            )}

            <Pressable onPress={onCloseSettings} style={{ marginTop: 20, alignSelf: 'center' }}>
              <Text style={styles.cancel}>{t.close}</Text>
            </Pressable>
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

// ─── Destination Slider (Library <-> None <-> Watchlist) ─────────────────────

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
  const [trackWidth, setTrackWidth] = useState(0);

  const knobWidth = trackWidth > 0 ? (trackWidth - 8) / 3 : 108;
  const travel = knobWidth;

  const targetX = state === 'library' ? -travel : state === 'watchlist' ? travel : 0;
  const translateX = useRef(new Animated.Value(targetX)).current;
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isDragging.current && trackWidth > 0) {
      Animated.timing(translateX, {
        toValue: targetX,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [state, targetX, trackWidth]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3,
        onPanResponderGrant: () => {
          isDragging.current = true;
        },
        onPanResponderMove: (_e, gestureState) => {
          const currentBase = state === 'library' ? -travel : state === 'watchlist' ? travel : 0;
          const clamped = Math.max(-travel, Math.min(travel, currentBase + gestureState.dx));
          translateX.setValue(clamped);
        },
        onPanResponderRelease: (_e, gestureState) => {
          isDragging.current = false;
          const currentBase = state === 'library' ? -travel : state === 'watchlist' ? travel : 0;
          const finalPos = currentBase + gestureState.dx;
          const threshold = travel * 0.35;

          let nextDest: 'library' | 'watchlist' | 'none' = 'none';
          if (finalPos < -threshold) {
            nextDest = 'library';
          } else if (finalPos > threshold) {
            nextDest = 'watchlist';
          } else {
            nextDest = 'none';
          }

          onChange(nextDest);
          const nextTarget = nextDest === 'library' ? -travel : nextDest === 'watchlist' ? travel : 0;
          Animated.timing(translateX, {
            toValue: nextTarget,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        },
      }),
    [state, travel, onChange],
  );

  const handleSlotPress = (dest: 'library' | 'watchlist' | 'none') => {
    const next = state === dest ? 'none' : dest;
    onChange(next);
  };

  return (
    <View style={sliderSt.container}>
      <View
        style={sliderSt.track}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setTrackWidth(w);
        }}
      >
        {/* Animated Sliding Knob */}
        {trackWidth > 0 && (
          <Animated.View
            style={[
              sliderSt.knob,
              {
                width: knobWidth,
                left: '50%',
                marginLeft: -knobWidth / 2,
                transform: [{ translateX }],
                backgroundColor:
                  state === 'library'
                    ? C.bordeaux
                    : state === 'watchlist'
                    ? '#9E1C33'
                    : '#221619',
                borderColor:
                  state === 'library'
                    ? C.bordeauxLight
                    : state === 'watchlist'
                    ? '#D93856'
                    : '#3D252B',
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Text
              style={[
                sliderSt.knobText,
                state !== 'none' && sliderSt.knobTextActive,
              ]}
              numberOfLines={1}
            >
              {state === 'library'
                ? `✓ ${t.inLibrary}`
                : state === 'watchlist'
                ? `⭐ ${t.inWatchlist}`
                : `⚪ ${t.neutralNone}`}
            </Text>
          </Animated.View>
        )}

        {/* 3 Clickable Slots behind knob */}
        <Pressable
          onPress={() => handleSlotPress('library')}
          style={[sliderSt.slot, { width: '33.33%' }]}
        >
          <Text
            style={[
              sliderSt.slotLabel,
              state === 'library' && sliderSt.slotLabelActive,
            ]}
          >
            📚 {t.library}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleSlotPress('none')}
          style={[sliderSt.slot, { width: '33.33%' }]}
        >
          <Text
            style={[
              sliderSt.slotLabel,
              state === 'none' && sliderSt.slotLabelActive,
            ]}
          >
            —
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleSlotPress('watchlist')}
          style={[sliderSt.slot, { width: '33.33%' }]}
        >
          <Text
            style={[
              sliderSt.slotLabel,
              state === 'watchlist' && sliderSt.slotLabelActive,
            ]}
          >
            ⭐ {t.watchlist}
          </Text>
        </Pressable>
      </View>

      <Text style={sliderSt.hintText}>{t.dragHint}</Text>
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

  // Soft and smooth popcorn animation
  const popcornScale = useRef(new Animated.Value(0)).current;
  const popcornOpacity = useRef(new Animated.Value(0)).current;

  const triggerPopcornAnimation = () => {
    popcornScale.setValue(0.25);
    popcornOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(popcornScale, {
        toValue: 1.25,
        duration: 320,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(220),
        Animated.timing(popcornOpacity, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

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
      watchedEpisodes: arr.length,
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
      triggerPopcornAnimation();
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
      triggerPopcornAnimation();
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

        {/* Floating Popcorn Animation overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            detailSt.popcornContainer,
            {
              transform: [{ scale: popcornScale }],
              opacity: popcornOpacity,
            },
          ]}
        >
          <Text style={detailSt.popcornEmoji}>🍿✨</Text>
        </Animated.View>

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

        {/* Synopsis / Overview */}
        <Text style={detailSt.overviewText}>
          {details.overview || t.noOverview}
        </Text>

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
              <Text style={detailSt.sectionHeading}>{t.episodesTitle}</Text>

              {/* Horizontal scroll of seasons */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                overScrollMode="always"
                bounces
                contentContainerStyle={detailSt.seasonPillsRow}
              >
                {details.seasons.map((s) => (
                  <Pressable
                    key={`season-${s.seasonNumber}`}
                    onPress={() => setSelectedSeason(s.seasonNumber)}
                    style={[
                      detailSt.seasonPill,
                      selectedSeason === s.seasonNumber && detailSt.seasonPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        detailSt.seasonPillText,
                        selectedSeason === s.seasonNumber && detailSt.seasonPillTextActive,
                      ]}
                    >
                      {s.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

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
          <Text style={catSt.title}>{t.search}</Text>
        </View>

        {isTmdbConfigured ? (
          <>
            <View style={catSt.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={search}
                placeholder={t.searchCatalogPrompt}
                placeholderTextColor="#7e6060"
                style={catSt.searchInput}
                autoFocus
              />
              <Pressable onPress={search} style={catSt.searchButton}>
                {loading ? <ActivityIndicator color={C.cream} size="small" /> :
                  <Text style={catSt.searchButtonText}>{t.search}</Text>}
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
}: {
  series: Series;
  watched: number;
  press: () => void;
  collectionLabel: string;
  t: (typeof i18n)['en'];
}) {
  return (
    <Pressable style={styles.seriesRow} onPress={press}>
      <PosterThumb posterPath={series.posterPath} title={series.title} size="sm" />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{series.title}</Text>
        <Text style={styles.rowMeta}>{collectionLabel}</Text>
        <Text style={styles.rowProgress}>
          {series.totalEpisodes > 0
            ? `${watched} / ${series.totalEpisodes} ${t.episodes}`
            : `${watched} ${t.episodesWatched}`}
        </Text>
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
}: {
  avatar: string | null;
  onPick: (uri: string) => void;
  label: string;
}) {
  const pick = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => onPick(reader.result as string);
        reader.readAsDataURL(file);
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
          quality: 0.8,
        });
        if (!res.canceled && res.assets?.[0]) onPick(res.assets[0].uri);
      } catch { /* not installed */ }
    }
  };

  return (
    <Pressable onPress={pick} style={profSt.avatarContainer}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={profSt.avatar} />
      ) : (
        <View style={profSt.avatarPlaceholder}><Text style={profSt.avatarIcon}>👤</Text></View>
      )}
      <Text style={profSt.avatarLabel}>{label}</Text>
    </Pressable>
  );
}

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
  topLangRow: {
    position: 'absolute',
    top: 14,
    right: 20,
    flexDirection: 'row',
    gap: 6,
    zIndex: 20,
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
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
    fontSize: 11,
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
    fontSize: 13,
    lineHeight: 18,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureBadgeText: {
    color: C.gold,
    fontSize: 11,
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
  switch: { color: C.gold, textAlign: 'center', fontWeight: '700', marginTop: 16, fontSize: 13 },
  message: { color: C.gold, textAlign: 'center', lineHeight: 19, marginTop: 14, fontSize: 13 },
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
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 4,
  },
  searchOutlineIcon: { fontSize: 15, color: C.bordeaux, fontWeight: '800' },
  searchOutlineText: { color: C.cream, fontSize: 13, fontWeight: '700' },
  continueWatchingRow: { paddingHorizontal: 22, gap: 12, paddingVertical: 4 },
  compactCard: { width: 84, alignItems: 'center' },
  compactPoster: {
    width: 80, height: 118, borderRadius: 8, overflow: 'hidden',
    backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, position: 'relative',
  },
  compactPosterImg: { width: '100%', height: '100%' },
  fallbackPosterText: { color: C.bordeaux, fontSize: 24, fontWeight: '800' },
  compactTitle: { color: C.cream, fontSize: 11, fontWeight: '600', marginTop: 5, textAlign: 'center', lineHeight: 14 },
  epBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(16,12,13,0.85)', borderRadius: 5,
    paddingHorizontal: 4, paddingVertical: 2,
  },
  epBadgeText: { color: C.gold, fontSize: 9, fontWeight: '700' },
});

const wlSt = StyleSheet.create({
  viewModeBtn: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
  },
  viewModeIcon: { color: C.gold, fontSize: 11, fontWeight: '700' },
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
  gridTitle: { color: C.cream, fontSize: 11, fontWeight: '600', marginTop: 5, textAlign: 'center', lineHeight: 14 },
  removeBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  removeBadgeText: { color: C.cream, fontSize: 10, fontWeight: '800' },
});

const catSt = StyleSheet.create({
  addButton: { backgroundColor: C.bordeaux, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addText: { color: C.cream, fontSize: 13, fontWeight: '800' },
  header: { padding: 22, flexDirection: 'row', alignItems: 'center', gap: 18 },
  title: { color: C.cream, fontSize: 20, fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingBottom: 10 },
  searchInput: {
    flex: 1, height: 46, borderRadius: 10, paddingHorizontal: 13,
    color: C.cream, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: C.bordeaux, borderRadius: 10, paddingHorizontal: 13,
    justifyContent: 'center', minWidth: 70, alignItems: 'center',
  },
  searchButtonText: { color: C.cream, fontWeight: '800' },
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
  overview: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  error: { color: C.error, paddingHorizontal: 22, marginTop: 10 },
  actionCol: { justifyContent: 'center', alignSelf: 'center' },
  removeButton: { padding: 8, justifyContent: 'center' },
  removeText: { color: C.muted, fontSize: 16 },
});

const profSt = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: C.bg,
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 110,
    paddingTop: 6,
  },
  gearButton: { padding: 8 },
  gearIcon: { fontSize: 22, color: C.muted },
  avatarContainer: { alignItems: 'center', marginBottom: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: C.bordeaux },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.border,
  },
  avatarIcon: { fontSize: 34 },
  avatarLabel: { color: C.gold, fontSize: 12, marginTop: 7, fontWeight: '600' },
  userInfoContainer: { alignItems: 'center', marginBottom: 16, paddingHorizontal: 20 },
  usernameText: { color: C.cream, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  bioText: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 8 },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, marginTop: 4,
  },
  editProfileBtnText: { color: C.gold, fontSize: 12, fontWeight: '700' },
  inputLabel: { color: C.gold, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  textInput: {
    backgroundColor: C.surface2, color: C.cream, height: 44, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 16, borderWidth: 1, borderColor: C.border,
  },
  bioInput: { height: 75, paddingTop: 10, textAlignVertical: 'top' },
  accountEmail: { color: C.muted, fontSize: 14, textAlign: 'center' },
  signOutButton: { marginTop: 14, backgroundColor: C.bordeaux, borderRadius: 10, padding: 12, alignItems: 'center' },
  signOutText: { color: C.cream, fontWeight: '800', fontSize: 14 },
  dashBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 4,
  },
  dashItem: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  dashNumber: { color: C.bordeauxLight, fontSize: 16, fontWeight: '800' },
  dashLabel: { color: C.muted, fontSize: 9, fontWeight: '700', marginTop: 1, textAlign: 'center' },
  dashSep: { width: 1, height: 20, backgroundColor: C.border },
  sectionBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  seeAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  seeAllText: { color: C.gold, fontSize: 13, fontWeight: '700' },
  hCardRow: { paddingHorizontal: 22, gap: 12, paddingVertical: 4 },
  hCard: { width: 78, alignItems: 'center' },
  hPoster: {
    width: 74, height: 108, borderRadius: 8, overflow: 'hidden',
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  hPosterImg: { width: '100%', height: '100%' },
  hTitle: { color: C.cream, fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'center', lineHeight: 13 },
  settingsSectionLabel: { color: C.gold, fontWeight: '700', fontSize: 13, marginTop: 16, marginBottom: 8 },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    paddingVertical: 10, borderRadius: 8, alignItems: 'center',
  },
  langBtnActive: { borderColor: C.bordeaux, backgroundColor: C.bordeaux },
  langBtnText: { color: C.muted, fontWeight: '700', fontSize: 12 },
  langBtnTextActive: { color: C.cream },
});

const sliderSt = StyleSheet.create({
  container: {
    marginVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  track: {
    width: '100%',
    maxWidth: 360,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#150D10',
    borderWidth: 1.5,
    borderColor: '#382026',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: 3,
  },
  knob: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 4,
    paddingHorizontal: 4,
  },
  knobText: {
    color: '#8A6D75',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  knobTextActive: {
    color: C.cream,
  },
  slot: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  slotLabel: {
    color: '#6E5259',
    fontSize: 11,
    fontWeight: '700',
  },
  slotLabelActive: {
    color: '#B3959C',
    fontWeight: '800',
  },
  hintText: {
    color: '#7A5C63',
    fontSize: 11,
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
  backText: { color: C.gold, fontSize: 16, fontWeight: '700' },
  popcornContainer: {
    position: 'absolute', top: 180, alignSelf: 'center', zIndex: 100,
  },
  popcornEmoji: { fontSize: 60 },
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
    color: C.cream, fontSize: 24, fontWeight: '800', textAlign: 'center',
    marginTop: 16, paddingHorizontal: 12,
  },
  overviewText: {
    color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center',
    marginTop: 10, paddingHorizontal: 14,
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
  actionBtnText: { color: C.cream, fontWeight: '800', fontSize: 13 },
  actionBtnTextActive: { color: C.cream },
  // Movie specific view
  movieSection: { marginTop: 10 },
  movieCardRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, padding: 18, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, marginTop: 10,
  },
  movieSubText: { color: C.gold, fontSize: 12, marginTop: 4, fontWeight: '600' },
  // Series view
  seasonsSection: { marginTop: 10 },
  sectionHeading: { color: C.cream, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  seasonPillsRow: { gap: 8, paddingBottom: 12 },
  seasonPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  seasonPillActive: {
    backgroundColor: C.bordeaux, borderColor: C.bordeaux,
  },
  seasonPillText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  seasonPillTextActive: { color: C.cream },
  episodesList: { marginTop: 8, gap: 10 },
  episodeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
  },
  episodeNumberText: { color: C.gold, fontSize: 11, fontWeight: '800', marginBottom: 2 },
  episodeNameText: { color: C.cream, fontSize: 14, fontWeight: '700' },
  episodeOverviewText: { color: C.muted, fontSize: 11, lineHeight: 15, marginTop: 4 },
  // Eye icon - High visibility badge
  eyeCircle: {
    width: 44, height: 44, borderRadius: 22,
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
  wordmark: { color: C.bordeaux, fontWeight: '800', letterSpacing: 3, fontSize: 12, marginTop: 4 },
  pageTitle: { color: C.cream, fontSize: 30, fontWeight: '800', marginTop: 4 },
  sectionHeader: { color: C.cream, fontSize: 18, fontWeight: '800' },
  subtitle: { color: C.muted, fontSize: 13, marginBottom: 10 },
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
    height: 40, color: C.cream, fontSize: 16, borderWidth: 1, borderColor: C.border,
  },
  filtersWrapper: { marginBottom: 10, backgroundColor: C.bg, zIndex: 10 },
  filters: { paddingHorizontal: 22, gap: 6 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: C.bordeaux, borderColor: C.bordeaux },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: C.cream },
  list: { paddingHorizontal: 22, paddingBottom: 100 },
  seriesRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  poster: { height: 56, width: 39, borderRadius: 5, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  posterText: { color: C.bordeaux, fontSize: 18, fontWeight: '800' },
  rowBody: { flex: 1, marginLeft: 14 },
  rowTitle: { color: C.cream, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: C.muted, fontSize: 11, marginTop: 2 },
  rowProgress: { color: C.gold, fontSize: 11, marginTop: 3 },
  chevron: { color: C.border, fontSize: 22 },
  tabbar: {
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10,
    paddingBottom: (Platform.OS === 'web' ? 'max(20px, calc(10px + env(safe-area-inset-bottom, 0px)))' : 24) as any,
  },
  tab: { alignItems: 'center', minWidth: 60, flex: 1 },
  tabIcon: { color: C.muted, fontSize: 20 },
  tabIconActive: { color: C.bordeaux, transform: [{ scale: 1.15 }] },
  tabLabel: { color: C.muted, fontSize: 10, marginTop: 2 },
  tabLabelActive: { color: C.bordeaux, fontWeight: '800' },
  back: { color: C.gold, fontSize: 16 },
  primaryButton: { backgroundColor: C.bordeaux, padding: 14, borderRadius: 11, alignItems: 'center', marginTop: 20 },
  primaryButtonText: { color: C.cream, fontWeight: '800', fontSize: 15 },
  empty: { backgroundColor: C.surface, borderRadius: 12, padding: 18, marginTop: 14 },
  emptyText: { color: C.muted, lineHeight: 20, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.78)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: C.surface, padding: 22, borderTopLeftRadius: 22,
    borderTopRightRadius: 22, minHeight: 240, borderTopWidth: 1, borderColor: C.border,
  },
  modalTitle: { color: C.cream, fontSize: 20, fontWeight: '800', marginBottom: 14 },
  cancel: { color: C.muted, fontWeight: '700' },
});
