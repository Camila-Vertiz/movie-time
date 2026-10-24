create table if not exists public.movies (
  id text primary key,
  titulo text not null check (length(trim(titulo)) > 0),
  genero text,
  duracion integer check (duracion is null or duracion > 0),
  "posterUrl" text,
  "backdropUrl" text,
  sinopsis text,
  "fechaEstreno" date,
  "proximoEstreno" boolean not null default false,
  "fechaActualizacion" timestamptz not null,
  constraint movies_poster_url_http check ("posterUrl" is null or "posterUrl" ~ '^https?://'),
  constraint movies_backdrop_url_http check ("backdropUrl" is null or "backdropUrl" ~ '^https?://')
);

create table if not exists public.cinemas (
  id text primary key,
  cadena text not null check (length(trim(cadena)) > 0),
  nombre text not null check (length(trim(nombre)) > 0),
  direccion text not null default '',
  url text not null check (url ~ '^https?://')
);

create table if not exists public.showtimes (
  id text primary key,
  "movieId" text not null references public.movies(id) on update cascade on delete restrict,
  "cinemaId" text not null references public.cinemas(id) on update cascade on delete restrict,
  fecha date not null,
  hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  sala text,
  precio numeric check (precio is null or precio >= 0),
  formato text,
  idioma text,
  "sourceUrl" text not null check ("sourceUrl" ~ '^https?://')
);

create index if not exists showtimes_fecha_id_idx
  on public.showtimes (fecha, id);
create index if not exists showtimes_movie_date_idx
  on public.showtimes ("movieId", fecha);
create index if not exists showtimes_cinema_date_idx
  on public.showtimes ("cinemaId", fecha);

create table if not exists public.source_status (
  cadena text primary key,
  estado text not null default 'pendiente'
    check (estado in ('ok', 'error', 'pendiente')),
  "ultimaEjecucion" timestamptz,
  "ultimoExito" timestamptz,
  mensaje text
);

alter table public.movies enable row level security;
alter table public.cinemas enable row level security;
alter table public.showtimes enable row level security;
alter table public.source_status enable row level security;

drop policy if exists "Public can read movies" on public.movies;
create policy "Public can read movies" on public.movies
  for select to anon, authenticated using (true);

drop policy if exists "Public can read cinemas" on public.cinemas;
create policy "Public can read cinemas" on public.cinemas
  for select to anon, authenticated using (true);

drop policy if exists "Public can read showtimes" on public.showtimes;
create policy "Public can read showtimes" on public.showtimes
  for select to anon, authenticated using (true);

drop policy if exists "Public can read source status" on public.source_status;
create policy "Public can read source status" on public.source_status
  for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.movies, public.cinemas, public.showtimes, public.source_status
  to anon, authenticated;
grant all on public.movies, public.cinemas, public.showtimes, public.source_status
  to service_role;

create or replace function public.sync_cinema_snapshot(
  p_chain text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  item_count bigint;
  distinct_count bigint;
begin
  if p_chain is null or length(trim(p_chain)) = 0 then
    raise exception 'Chain is required';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload ->> 'cadena' is distinct from p_chain then
    raise exception 'Payload chain does not match the requested chain';
  end if;
  if jsonb_typeof(p_payload -> 'movies') is distinct from 'array'
     or jsonb_typeof(p_payload -> 'cinemas') is distinct from 'array'
     or jsonb_typeof(p_payload -> 'showtimes') is distinct from 'array' then
    raise exception 'Payload must contain movies, cinemas, and showtimes arrays';
  end if;
  if jsonb_array_length(p_payload -> 'movies') = 0
     or jsonb_array_length(p_payload -> 'cinemas') = 0
     or jsonb_array_length(p_payload -> 'showtimes') = 0 then
    raise exception 'Refusing to replace a snapshot with empty data';
  end if;

  select count(*), count(distinct value ->> 'id')
    into item_count, distinct_count
    from jsonb_array_elements(p_payload -> 'movies');
  if item_count <> distinct_count
     or exists (
       select 1 from jsonb_array_elements(p_payload -> 'movies') as item(value)
       where jsonb_typeof(value) is distinct from 'object'
          or nullif(trim(value ->> 'id'), '') is null
          or nullif(trim(value ->> 'titulo'), '') is null
     ) then
    raise exception 'Movies must have unique IDs and non-empty titles';
  end if;

  select count(*), count(distinct value ->> 'id')
    into item_count, distinct_count
    from jsonb_array_elements(p_payload -> 'cinemas');
  if item_count <> distinct_count
     or exists (
       select 1 from jsonb_array_elements(p_payload -> 'cinemas') as item(value)
       where jsonb_typeof(value) is distinct from 'object'
          or nullif(trim(value ->> 'id'), '') is null
          or nullif(trim(value ->> 'nombre'), '') is null
          or value ->> 'cadena' is distinct from p_chain
     ) then
    raise exception 'Cinemas must have unique IDs and belong to the requested chain';
  end if;

  select count(*), count(distinct value ->> 'id')
    into item_count, distinct_count
    from jsonb_array_elements(p_payload -> 'showtimes');
  if item_count <> distinct_count
     or exists (
       select 1
       from jsonb_array_elements(p_payload -> 'showtimes') as item(value)
       where jsonb_typeof(value) is distinct from 'object'
          or nullif(trim(value ->> 'id'), '') is null
          or not exists (
            select 1 from jsonb_array_elements(p_payload -> 'movies') as movie(value)
            where movie.value ->> 'id' = item.value ->> 'movieId'
          )
          or not exists (
            select 1 from jsonb_array_elements(p_payload -> 'cinemas') as cinema(value)
            where cinema.value ->> 'id' = item.value ->> 'cinemaId'
          )
     ) then
    raise exception 'Showtimes must have unique IDs and refer to movies and cinemas in the snapshot';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.sync_cinema_snapshot'));

  insert into public.movies (
    id, titulo, genero, duracion, "posterUrl", "backdropUrl", sinopsis,
    "fechaEstreno", "proximoEstreno", "fechaActualizacion"
  )
  select
    item.id, item.titulo, item.genero, item.duracion, item."posterUrl",
    item."backdropUrl", item.sinopsis, item."fechaEstreno",
    coalesce(item."proximoEstreno", false), item."fechaActualizacion"
  from jsonb_to_recordset(p_payload -> 'movies') as item(
    id text,
    titulo text,
    genero text,
    duracion integer,
    "posterUrl" text,
    "backdropUrl" text,
    sinopsis text,
    "fechaEstreno" date,
    "proximoEstreno" boolean,
    "fechaActualizacion" timestamptz
  )
  on conflict (id) do update set
    titulo = excluded.titulo,
    genero = excluded.genero,
    duracion = excluded.duracion,
    "posterUrl" = excluded."posterUrl",
    "backdropUrl" = excluded."backdropUrl",
    sinopsis = excluded.sinopsis,
    "fechaEstreno" = excluded."fechaEstreno",
    "proximoEstreno" = excluded."proximoEstreno",
    "fechaActualizacion" = excluded."fechaActualizacion";

  insert into public.cinemas (id, cadena, nombre, direccion, url)
  select item.id, item.cadena, item.nombre, coalesce(item.direccion, ''), item.url
  from jsonb_to_recordset(p_payload -> 'cinemas') as item(
    id text,
    cadena text,
    nombre text,
    direccion text,
    url text
  )
  on conflict (id) do update set
    cadena = excluded.cadena,
    nombre = excluded.nombre,
    direccion = excluded.direccion,
    url = excluded.url;

  delete from public.showtimes as current_showtime
  using public.cinemas as current_cinema
  where current_showtime."cinemaId" = current_cinema.id
    and current_cinema.cadena = p_chain
    and not exists (
      select 1 from jsonb_array_elements(p_payload -> 'showtimes') as incoming(value)
      where incoming.value ->> 'id' = current_showtime.id
    );

  insert into public.showtimes (
    id, "movieId", "cinemaId", fecha, hora, sala, precio, formato, idioma, "sourceUrl"
  )
  select
    item.id, item."movieId", item."cinemaId", item.fecha, item.hora, item.sala,
    item.precio, item.formato, item.idioma, item."sourceUrl"
  from jsonb_to_recordset(p_payload -> 'showtimes') as item(
    id text,
    "movieId" text,
    "cinemaId" text,
    fecha date,
    hora text,
    sala text,
    precio numeric,
    formato text,
    idioma text,
    "sourceUrl" text
  )
  on conflict (id) do update set
    "movieId" = excluded."movieId",
    "cinemaId" = excluded."cinemaId",
    fecha = excluded.fecha,
    hora = excluded.hora,
    sala = excluded.sala,
    precio = excluded.precio,
    formato = excluded.formato,
    idioma = excluded.idioma,
    "sourceUrl" = excluded."sourceUrl";

  delete from public.cinemas as old_cinema
  where old_cinema.cadena = p_chain
    and not exists (
      select 1 from jsonb_array_elements(p_payload -> 'cinemas') as incoming(value)
      where incoming.value ->> 'id' = old_cinema.id
    )
    and not exists (
      select 1 from public.showtimes as remaining
      where remaining."cinemaId" = old_cinema.id
    );

  insert into public.source_status (
    cadena, estado, "ultimaEjecucion", "ultimoExito", mensaje
  )
  values (p_chain, 'ok', now(), now(), null)
  on conflict (cadena) do update set
    estado = excluded.estado,
    "ultimaEjecucion" = excluded."ultimaEjecucion",
    "ultimoExito" = excluded."ultimoExito",
    mensaje = null;
end;
$function$;

revoke all on function public.sync_cinema_snapshot(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_cinema_snapshot(text, jsonb)
  to service_role;
