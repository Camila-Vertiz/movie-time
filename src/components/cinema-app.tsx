"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ArrowDownWideNarrow, ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight, Clapperboard, Clock3, ExternalLink, Film, Heart, LayoutGrid, MapPin, Menu, Popcorn, RefreshCw, Search, SlidersHorizontal, Sparkles, Ticket, TrendingUp, X, BarChart3, CircleAlert } from "lucide-react";
import type { Catalog, Movie, Showtime } from "@/domain/models";
import { filterShowtimes, rankMovies } from "@/application/catalog-service";
import { addDays, displayDate, displayTime, localDate, TIME_ZONE } from "@/lib/dates";

type View = "cartelera" | "estrenos" | "favoritos" | "ranking" | "estadisticas" | "cines";
const navigation = [
  { id: "cartelera", label: "Cartelera", icon: LayoutGrid },
  { id: "estrenos", label: "Próximos estrenos", icon: Sparkles },
  { id: "favoritos", label: "Mis favoritos", icon: Heart },
  { id: "ranking", label: "Más populares", icon: TrendingUp },
] as const;

function Poster({ movie, className = "" }: { movie: Movie; className?: string }) {
  const [failed, setFailed] = useState(false);
  return movie.posterUrl && !failed
    ? <img className={className} src={movie.posterUrl} alt={`Póster de ${movie.titulo}`} loading="lazy" onError={() => setFailed(true)} />
    : <div className={`poster-placeholder ${className}`}><Film size={36} /><span>{movie.titulo}</span></div>;
}

export function CinemaApp({ initialCatalog }: { initialCatalog: Catalog }) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [view, setView] = useState<View>("cartelera");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [cinema, setCinema] = useState("");
  const [movieId, setMovieId] = useState("");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("popular");
  const [date, setDate] = useState(localDate());
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem("movie-time-favorites") ?? "[]");
      if (Array.isArray(saved) && saved.every((value) => typeof value === "string")) setFavorites(saved);
    } catch { /* Storage may be unavailable in private browsing. */ }
    const timer = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function refresh() {
    setRefreshing(true); setRefreshError(false);
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      setCatalog(await response.json() as Catalog);
    } catch { setRefreshError(true); }
    finally { setRefreshing(false); }
  }

  useEffect(() => {
    if (initialCatalog.mode === "demo") return;
    const timer = setInterval(() => { void refresh(); }, 300_000);
    return () => clearInterval(timer);
  }, [initialCatalog.mode]);

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      try { localStorage.setItem("movie-time-favorites", JSON.stringify(next)); } catch { /* Keep the in-memory choice. */ }
      return next;
    });
  }

  function navigate(next: View) { setView(next); setMobileMenu(false); setQuery(""); setMovieId(""); setGenre(""); setCinema(""); }
  const currentTime = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(clock);
  const today = localDate(clock);
  const availableShowtimes = catalog.showtimes.filter((showtime) => showtime.fecha > today || (showtime.fecha === today && showtime.hora >= currentTime));
  const displayCatalog = { ...catalog, showtimes: availableShowtimes };
  const showtimes = filterShowtimes(displayCatalog, { q: deferredQuery, cinema, movie: movieId, date });
  const movieCounts = new Map<string, number>();
  for (const showtime of showtimes) movieCounts.set(showtime.movieId, (movieCounts.get(showtime.movieId) ?? 0) + 1);
  const ranking = rankMovies(catalog.movies, availableShowtimes);
  const visibleMovies = catalog.movies.filter((movie) => {
    if (genre && movie.genero !== genre) return false;
    if (movieId && movie.id !== movieId) return false;
    if (!movie.titulo.toLocaleLowerCase("es").includes(deferredQuery.toLocaleLowerCase("es"))) return false;
    if (view === "estrenos") return movie.proximoEstreno;
    if (view === "favoritos") return favorites.includes(movie.id);
    return movieCounts.has(movie.id);
  }).sort((first, second) => sort === "title" ? first.titulo.localeCompare(second.titulo, "es") : (movieCounts.get(second.id) ?? 0) - (movieCounts.get(first.id) ?? 0));
  const hero = catalog.movies.find((movie) => movie.backdropUrl && !movie.proximoEstreno) ?? catalog.movies.find((movie) => !movie.proximoEstreno);
  const genres = [...new Set(catalog.movies.map((movie) => movie.genero).filter((value): value is string => Boolean(value)))];
  const totalToday = availableShowtimes.filter((showtime) => showtime.fecha === today).length;
  const cinemaRanking = catalog.cinemas.map((item) => ({ ...item, count: availableShowtimes.filter((showtime) => showtime.cinemaId === item.id).length })).sort((first, second) => second.count - first.count);
  const titles: Record<View, string> = { cartelera: "En cartelera", estrenos: "Próximos estrenos", favoritos: "Mis favoritos", ranking: "Las más populares", estadisticas: "El cine, en números", cines: "Nuestros cines" };
  const isGrid = view === "cartelera" || view === "estrenos" || view === "favoritos";
  const updatedLabel = catalog.updatedAt ? new Intl.DateTimeFormat("es-CR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(new Date(catalog.updatedAt)) : "Sin sincronizar";

  return <div className="app-shell">
    {mobileMenu && <button className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
      <a className="brand" href="/" aria-label="Movie Time, inicio"><span className="brand-icon"><Clapperboard size={25} strokeWidth={2.3} /></span><span>movie<span className="brand-light">time</span><span className="brand-dot">.</span></span></a>
      <div className="sidebar-caption">DESCUBRIR</div>
      <nav aria-label="Navegación principal">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span>{id === "cartelera" && <span className="nav-count">{catalog.movies.filter((movie) => !movie.proximoEstreno).length}</span>}</button>)}</nav>
      <div className="sidebar-rule" />
      <div className="sidebar-caption">EXPLORAR</div>
      <nav aria-label="Explorar"><button className={`nav-item ${view === "cines" ? "active" : ""}`} onClick={() => navigate("cines")}><MapPin size={19} />Cines y ubicaciones</button><button className={`nav-item ${view === "estadisticas" ? "active" : ""}`} onClick={() => navigate("estadisticas")}><BarChart3 size={19} />Estadísticas</button></nav>
      <div className="sidebar-bottom"><div className="country"><span className="costa-rica-flag" /><span>Costa Rica</span><span className="country-code">CR</span></div><div className="source-summary"><span className={`status-dot ${catalog.mode === "demo" ? "demo-dot" : ""}`} />{catalog.mode === "demo" ? "Modo demostración" : `${catalog.sources.filter((source) => source.estado === "ok").length} fuentes sincronizadas`}</div><p>La vida se ve mejor en el cine.</p><div className="sidebar-footer">MOVIE TIME <span>© {clock.getFullYear()}</span></div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="topbar-location"><button className="icon-button menu-button" aria-label="Abrir menú" onClick={() => setMobileMenu(true)}><Menu size={22} /></button><MapPin size={16} /><span>Costa Rica</span><span className="topbar-divider">/</span><span className="topbar-current">{view === "cartelera" ? "Cartelera" : titles[view]}</span></div><div className="topbar-right"><label className="search-field"><Search size={18} /><input aria-label="Buscar película" placeholder="¿Qué película buscas?" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="Borrar búsqueda" className="search-clear" onClick={() => setQuery("")}><X size={15} /></button>}</label><span className={`mode-badge ${catalog.mode === "live" ? "live" : ""}`}><span className="status-dot" />{catalog.mode === "demo" ? "DEMO" : "EN VIVO"}</span></div></header>
      {catalog.mode === "demo" && <div className="demo-banner"><CircleAlert size={13} /><span>Vista de demostración · Películas y horarios ilustrativos, no válidos para comprar entradas.</span></div>}
      {refreshError && <div className="error-banner" role="status">No se pudo actualizar. Se conserva la última información cargada.</div>}

      {view === "cartelera" && !query && hero && <section className="hero" aria-label={`Película destacada: ${hero.titulo}`}>
        <div className="hero-image" style={{ backgroundImage: `url("${hero.backdropUrl ?? hero.posterUrl ?? ""}")` }} />
        <div className="hero-shade" /><div className="hero-content"><div className="hero-eyebrow"><span />EN PANTALLA GRANDE</div><h1>{hero.titulo.includes(":") ? <>{hero.titulo.split(":")[0]}<span>{hero.titulo.split(":").slice(1).join(":")}</span></> : hero.titulo}</h1><div className="hero-meta"><span>{hero.genero ?? "Cine"}</span><i />{hero.duracion && <span>{Math.floor(hero.duracion / 60)} h {hero.duracion % 60} min</span>}<span className="format-badge">{availableShowtimes.some((showtime) => showtime.movieId === hero.id && showtime.formato === "IMAX") ? "IMAX" : "CINE"}</span></div><p>{hero.sinopsis}</p><div className="hero-actions"><button className="primary-button" onClick={() => setSelectedMovie(hero)}><Ticket size={18} />Ver horarios<ArrowRight size={17} /></button><button className={`hero-favorite ${favorites.includes(hero.id) ? "saved" : ""}`} title={favorites.includes(hero.id) ? "Quitar de favoritos" : "Agregar a favoritos"} aria-label={favorites.includes(hero.id) ? "Quitar de favoritos" : "Agregar a favoritos"} aria-pressed={favorites.includes(hero.id)} onClick={() => toggleFavorite(hero.id)}><Heart size={21} fill={favorites.includes(hero.id) ? "currentColor" : "none"} /></button></div><div className="hero-availability"><MapPin size={13} />En {new Set(availableShowtimes.filter((showtime) => showtime.movieId === hero.id).map((showtime) => showtime.cinemaId)).size} cines de Costa Rica</div></div><div className="hero-side-note"><span>LA SELECCIÓN</span><span>MOVIE TIME<span className="hero-note-dot">.</span></span></div><button className="hero-scroll" onClick={() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} aria-label="Ir a la cartelera"><ChevronDown size={17} /></button>
      </section>}

      <main className="content" ref={contentRef}>
        <div className="section-heading"><div><div className="section-kicker">{view === "cartelera" ? "ELIGE TU PRÓXIMA FUNCIÓN" : "MOVIE TIME · COSTA RICA"}</div><div className="title-row"><h2>{titles[view]}</h2>{isGrid && <span className="result-count">{visibleMovies.length}</span>}</div></div><button className="update-button" onClick={() => void refresh()} disabled={refreshing} title="Consultar la última sincronización"><RefreshCw size={13} className={refreshing ? "spinning" : ""} /><span>{catalog.mode === "demo" ? "Datos de demostración" : updatedLabel}</span></button></div>

        {isGrid && <>
          <div className="filter-toolbar"><div className="filter-label"><SlidersHorizontal size={16} /><span>Filtrar</span></div><label className="select-wrap"><MapPin size={15} /><select aria-label="Filtrar por cine" value={cinema} onChange={(event) => setCinema(event.target.value)}><option value="">Todos los cines</option>{catalog.cinemas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><ChevronDown size={13} /></label><label className="select-wrap movie-select"><Film size={15} /><select aria-label="Filtrar por película" value={movieId} onChange={(event) => setMovieId(event.target.value)}><option value="">Todas las películas</option>{catalog.movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.titulo}</option>)}</select><ChevronDown size={13} /></label><label className="select-wrap sort-select"><ArrowDownWideNarrow size={15} /><select aria-label="Ordenar películas" value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Más funciones</option><option value="title">De la A a la Z</option></select><ChevronDown size={13} /></label></div>
          {view !== "estrenos" && <div className="date-toolbar"><div className="date-strip" role="group" aria-label="Fecha de las funciones">{Array.from({ length: 7 }, (_, index) => { const day = addDays(today, index); return <button key={day} className={`date-button ${date === day ? "selected" : ""}`} aria-pressed={date === day} onClick={() => setDate(day)}><span>{index === 0 ? "Hoy" : index === 1 ? "Mañana" : displayDate(day, { weekday: "short", day: undefined, month: undefined }).replace(".", "")}</span><span>{displayDate(day, { day: "2-digit", month: "short" }).replace(" de ", " ").replace(".", "")}</span></button>; })}</div><label className="calendar-input" title="Elegir otra fecha"><CalendarDays size={17} /><input type="date" aria-label="Elegir fecha" min={today} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} /></label></div>}
          <div className="genres" role="group" aria-label="Filtrar por género">{["", ...genres].map((item) => <button key={item} className={genre === item ? "selected" : ""} aria-pressed={genre === item} onClick={() => setGenre(item)}>{item || "Todas"}</button>)}<span className="movie-results">{visibleMovies.length} películas {view === "cartelera" ? "disponibles" : ""}</span></div>
          {visibleMovies.length ? <div className="movie-grid">{visibleMovies.map((movie, index) => {
            const cinemaCount = new Set(showtimes.filter((showtime) => showtime.movieId === movie.id).map((showtime) => showtime.cinemaId)).size;
            const next = showtimes.filter((showtime) => showtime.movieId === movie.id).sort((first, second) => first.hora.localeCompare(second.hora))[0];
            return <article className="movie-card" key={movie.id} style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}><div className="poster-wrap"><button className="poster-open" aria-label={`Ver detalle de ${movie.titulo}`} onClick={() => setSelectedMovie(movie)}><Poster movie={movie} /><span className="poster-gradient" /><span className="poster-cta"><Ticket size={17} />Ver horarios</span></button><div className="poster-badges">{movie.proximoEstreno ? <span className="premiere-badge">PRÓXIMAMENTE</span> : index < 2 && !query && <span className="top-badge"><TrendingUp size={11} />MÁS FUNCIONES</span>}</div><button className={`card-favorite ${favorites.includes(movie.id) ? "saved" : ""}`} onClick={() => toggleFavorite(movie.id)} aria-pressed={favorites.includes(movie.id)} aria-label={`${favorites.includes(movie.id) ? "Quitar" : "Guardar"} ${movie.titulo} en favoritos`} title="Favoritos"><Heart size={16} fill={favorites.includes(movie.id) ? "currentColor" : "none"} /></button>{!movie.proximoEstreno && <span className="poster-cinema-count"><MapPin size={11} />{cinemaCount} {cinemaCount === 1 ? "cine" : "cines"}</span>}</div><button className="movie-title" onClick={() => setSelectedMovie(movie)}>{movie.titulo}</button><div className="movie-meta"><span>{movie.genero ?? "Sin género"}</span><span className="meta-separator">·</span><span>{movie.duracion ? `${movie.duracion} min` : "Duración por confirmar"}</span></div><div className="card-bottom">{movie.proximoEstreno ? <span><CalendarDays size={12} />{movie.fechaEstreno ? displayDate(movie.fechaEstreno) : "Fecha por confirmar"}</span> : <><span className="next-showtime"><span className="status-dot" />{next ? displayTime(next.hora) : "Sin funciones"}</span><button onClick={() => setSelectedMovie(movie)} aria-label={`Ver las ${movieCounts.get(movie.id) ?? 0} funciones de ${movie.titulo}`}>{movieCounts.get(movie.id) ?? 0} funciones<ChevronRight size={13} /></button></>}</div></article>;
          })}</div> : <div className="empty-state"><Popcorn size={42} /><h3>{view === "favoritos" ? "Tu selección empieza aquí" : "No hay películas para estos filtros"}</h3><p>{view === "favoritos" ? "Todavía no tienes películas favoritas." : "No se encontraron funciones confirmadas para esta selección."}</p><button className="secondary-button" onClick={() => { setQuery(""); setCinema(""); setGenre(""); setMovieId(""); setDate(today); if (view === "favoritos") setView("cartelera"); }}>Ver cartelera</button></div>}
        </>}

        {view === "ranking" && <div className="ranking-list">{ranking.length ? ranking.map((movie, index) => <button key={movie.id} className="ranking-row" onClick={() => setSelectedMovie(movie)}><span className="rank-number">{String(index + 1).padStart(2, "0")}</span><Poster movie={movie} /><span className="rank-title"><strong>{movie.titulo}</strong><span>{movie.genero} · {movie.duracion ?? "—"} min</span></span><span className="rank-count">{movie.funciones}<small>funciones</small></span><ChevronRight size={20} /></button>) : <div className="empty-state"><TrendingUp size={36} /><h3>No hay funciones disponibles</h3></div>}</div>}

        {view === "estadisticas" && <><div className="stats-grid">{[{ label: "Películas en cartelera", value: catalog.movies.filter((movie) => !movie.proximoEstreno).length, icon: Film }, { label: "Funciones restantes hoy", value: totalToday, icon: Ticket }, { label: "Cines disponibles", value: catalog.cinemas.length, icon: MapPin }, { label: "Próximos estrenos", value: catalog.movies.filter((movie) => movie.proximoEstreno).length, icon: Sparkles }].map(({ label, value, icon: Icon }) => <div key={label} className="stat-item"><Icon size={20} /><strong>{value}</strong><span>{label}</span></div>)}</div><h3 className="subheading">Funciones por cine <span>Próximos días</span></h3><div className="bar-chart">{cinemaRanking.map((item, index) => <div key={item.id} className="bar-row"><span>{item.nombre}{index === 0 && item.count > 0 && <span className="leader-badge">MÁS HORARIOS</span>}</span><div className="bar-track"><div style={{ width: `${item.count / Math.max(cinemaRanking[0]?.count ?? 1, 1) * 100}%` }} /></div><strong>{item.count}</strong></div>)}</div><h3 className="subheading">Estado de las fuentes</h3><SourceTable catalog={catalog} /></>}

        {view === "cines" && <div className="cinemas-list">{cinemaRanking.map((item, index) => <article key={item.id} className="cinema-row"><span className="cinema-symbol"><Clapperboard size={23} /></span><div><h3>{item.nombre}</h3><p><MapPin size={13} />{item.direccion || "Dirección no publicada por la fuente"}</p><span className="cinema-function-count">{item.count} funciones disponibles</span></div>{index === 0 && item.count > 0 && <span className="leader-badge">MÁS HORARIOS</span>}<a className="icon-button" href={item.url} target="_blank" rel="noopener noreferrer" title={`Visitar ${item.nombre}`} aria-label={`Visitar ${item.nombre}`}><ExternalLink size={18} /></a></article>)}<h3 className="subheading">Estado de actualización</h3><SourceTable catalog={catalog} /></div>}

        <footer className="page-footer"><span><Clapperboard size={15} />Historias que merecen una pantalla grande.</span><span>Costa Rica <span className="footer-dot">·</span> {catalog.mode === "demo" ? "Vista de demostración" : "Horarios sujetos a cambios"}</span></footer>
      </main>
    </div>
    {selectedMovie && <MovieDialog movie={selectedMovie} catalog={displayCatalog} initialDate={date} initialCinema={cinema} onClose={() => setSelectedMovie(null)} favorite={favorites.includes(selectedMovie.id)} toggleFavorite={() => toggleFavorite(selectedMovie.id)} />}
  </div>;
}

function SourceTable({ catalog }: { catalog: Catalog }) {
  return <div className="source-table">{catalog.sources.length ? catalog.sources.map((source) => <div key={source.cadena}><strong>{source.cadena}</strong><span className={`source-state ${source.estado}`}><span className="status-dot" />{source.estado === "ok" ? "Sincronizado" : source.estado === "error" ? "Requiere revisión" : "Pendiente"}</span><span>{source.ultimoExito ? new Intl.DateTimeFormat("es-CR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(new Date(source.ultimoExito)) : "Sin sincronización real"}</span></div>) : <p>No se han ejecutado los scrapers.</p>}</div>;
}

function MovieDialog({ movie, catalog, initialDate, initialCinema, onClose, favorite, toggleFavorite }: { movie: Movie; catalog: Catalog; initialDate: string; initialCinema: string; onClose: () => void; favorite: boolean; toggleFavorite: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(initialDate);
  const [cinema, setCinema] = useState(initialCinema);
  const today = localDate();
  const showtimes = catalog.showtimes.filter((showtime) => showtime.movieId === movie.id && showtime.fecha === date && (!cinema || showtime.cinemaId === cinema));
  const groups = catalog.cinemas.map((item) => ({ cinema: item, showtimes: showtimes.filter((showtime) => showtime.cinemaId === item.id).sort((first, second) => first.hora.localeCompare(second.hora)) })).filter((group) => group.showtimes.length);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);

  return <dialog className="movie-dialog" ref={dialogRef} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="dialog-title"><div className="dialog-inner"><button className="dialog-close icon-button" onClick={onClose} title="Cerrar detalle" aria-label="Cerrar detalle"><X size={21} /></button><div className="dialog-header"><Poster movie={movie} /><div><div className="section-kicker">{movie.proximoEstreno ? "PRÓXIMO ESTRENO" : "EN CARTELERA"}</div><h2 id="dialog-title">{movie.titulo}</h2><div className="dialog-meta">{movie.genero && <span>{movie.genero}</span>}{movie.duracion && <span><Clock3 size={14} />{movie.duracion} min</span>}</div><p>{movie.sinopsis || "La fuente aún no ha publicado una sinopsis."}</p><button className={`favorite-text ${favorite ? "saved" : ""}`} aria-pressed={favorite} onClick={toggleFavorite}>{favorite ? <Check size={15} /> : <Heart size={15} />}{favorite ? "En tus favoritos" : "Agregar a favoritos"}</button></div></div><div className="dialog-schedule"><h3><Ticket size={18} />Horarios disponibles</h3>{catalog.mode === "demo" && <p className="dialog-demo">Horarios de demostración. Consulta la cartelera oficial antes de comprar.</p>}<div className="dialog-filters"><label><CalendarDays size={16} /><input aria-label="Fecha de funciones" type="date" min={today} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} /></label><label><MapPin size={16} /><select aria-label="Cine en el detalle" value={cinema} onChange={(event) => setCinema(event.target.value)}><option value="">Todos los cines</option>{catalog.cinemas.map((item) => <option value={item.id} key={item.id}>{item.nombre}</option>)}</select></label></div>{groups.length ? groups.map((group) => <div className="schedule-group" key={group.cinema.id}><div className="schedule-cinema"><div><h4>{group.cinema.nombre}</h4><p><MapPin size={12} />{group.cinema.direccion}</p></div><a href={group.cinema.url} target="_blank" rel="noopener noreferrer" title="Ver cartelera oficial" aria-label={`Cartelera oficial de ${group.cinema.nombre}`}><ExternalLink size={16} /></a></div><div className="showtime-grid">{group.showtimes.map((showtime: Showtime) => <a href={showtime.sourceUrl} target="_blank" rel="noopener noreferrer" className="showtime-chip" key={showtime.id} title={catalog.mode === "demo" ? "Horario ilustrativo · Abrir página oficial" : "Consultar disponibilidad en la página oficial"}><strong>{displayTime(showtime.hora)}<ExternalLink size={11} /></strong><span>{[showtime.formato, showtime.idioma, showtime.sala].filter(Boolean).join(" · ") || "Formato por confirmar"}</span>{showtime.precio !== null && <small>{new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(showtime.precio)}</small>}</a>)}</div></div>) : <div className="schedule-empty"><CalendarDays size={26} /><p>{movie.proximoEstreno ? "Los horarios se publicarán próximamente." : "No hay funciones confirmadas para esta fecha y cine."}</p>{movie.fechaEstreno && <span>Estreno: {displayDate(movie.fechaEstreno)}</span>}</div>}</div></div></dialog>;
}