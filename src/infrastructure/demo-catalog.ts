import type { Catalog, Movie, Cinema } from "../domain/models";
import { addDays, localDate } from "../lib/dates";

const image = (path: string) => `https://image.tmdb.org/t/p/w500${path}`;

export function getDemoCatalog(): Catalog {
  const today = localDate();
  const updatedAt = `${today}T12:00:00.000Z`;
  const items = [
    ["dune", "Duna: Parte dos", "Ciencia ficción", 166, "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", "Paul Atreides se une a Chani y a los Fremen en un viaje de venganza y esperanza. El destino de todo un universo está en sus manos."],
    ["interstellar", "Interestelar", "Ciencia ficción", 169, "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", "Un equipo de exploradores viaja más allá de esta galaxia para descubrir si la humanidad tiene un futuro entre las estrellas."],
    ["wild-robot", "Robot salvaje", "Animación", 102, "/wTnV3PCVW5O92JMrFvvrRcV39RU.jpg", "Roz, un robot que naufraga en una isla, aprende a convivir con la naturaleza y a cuidar de una pequeña cría de ganso."],
    ["substance", "La sustancia", "Terror", 141, "/lqoMzCcZYEFK729d6rSV98mUjST.jpg", "Una estrella descubre un misterioso tratamiento que promete crear una versión más joven y perfecta de sí misma."],
    ["gladiator", "Gladiador II", "Acción", 148, "/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg", "Lucio entra en el Coliseo y busca la fuerza para devolver al pueblo de Roma su libertad."],
    ["wicked", "Wicked", "Fantasía", 160, "/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg", "Dos jóvenes brujas forjan una amistad inesperada en la tierra de Oz, antes de tomar caminos muy distintos."],
    ["flow", "Flow", "Animación", 85, "/imKSymKBK7o73sajciEmndJoVkR.jpg", "Un gato encuentra refugio en un barco junto a otros animales después de una gran inundación."],
    ["inside-out", "Intensa-Mente 2", "Animación", 96, "/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg", "Nuevas emociones llegan al cuartel general de Riley y ponen a prueba todo lo que Alegría creía saber."],
    ["batman", "The Batman", "Suspenso", 176, "/74xTEgt7R36Fpooo50r9T25onhq.jpg", "Batman se adentra en los rincones más oscuros de Gotham para resolver una serie de enigmas."],
    ["oppenheimer", "Oppenheimer", "Drama", 180, "/ptpr0kGAckfQkJeJIt8st5dglvd.jpg", "La historia del físico J. Robert Oppenheimer y las decisiones que cambiaron el curso de la historia."],
    ["arrival", "La llegada", "Ciencia ficción", 116, "/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg", "Una lingüista intenta descifrar el lenguaje de unos visitantes para comprender el verdadero motivo de su llegada."],
    ["past-lives", "Vidas pasadas", "Drama", 106, "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg", "Dos amigos de la infancia vuelven a encontrarse y reflexionan sobre el destino, el amor y las decisiones que dan forma a una vida."],
  ] as const;
  const movies: Movie[] = items.map(([id, titulo, genero, duracion, poster, sinopsis], index) => ({
    id, titulo, genero, duracion, posterUrl: image(poster), sinopsis,
    backdropUrl: id === "dune" ? "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJvHIopLu8aPM3gYVvJ.jpg" : null,
    fechaEstreno: index > 8 ? addDays(today, 7 + index) : null,
    proximoEstreno: index > 8, fechaActualizacion: updatedAt,
  }));
  movies[0].backdropUrl = "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJvHIopLu8aPM3gY.jpg";
  const cinemas: Cinema[] = [
    { id: "cinepolis-terramall", cadena: "cinepolis", nombre: "Cinépolis Terramall", direccion: "Tres Ríos, Cartago", url: "https://cinepolis.co.cr/" },
    { id: "cinemark-escazu", cadena: "cinemark", nombre: "Cinemark Multiplaza", direccion: "Escazú, San José", url: "https://www.cinemarkca.com/costa-rica/cine?tag=773" },
    { id: "magaly", cadena: "magaly", nombre: "Cine Magaly", direccion: "Barrio La California, San José", url: "https://www.cinemagaly.com/" },
    { id: "nova", cadena: "nova", nombre: "Nova Cinemas", direccion: "Avenida Escazú, San José", url: "https://www.novacinemas.cr/" },
    { id: "ccm", cadena: "ccm", nombre: "CCM Plaza Mayor", direccion: "Rohrmoser, San José", url: "https://www.ccmcinemas.com/" },
    { id: "garbo", cadena: "garbo", nombre: "Sala Garbo", direccion: "Avenida 2, calle 28, San José", url: "https://salagarbo.com/cartelera/" },
    { id: "studio", cadena: "studio", nombre: "Studio Cinemas", direccion: "Santa Ana, San José", url: "https://www.studiocinemascr.com/" },
    { id: "sanpedro", cadena: "sanpedro", nombre: "Cinemas San Pedro", direccion: "San Pedro, San José", url: "https://cinemasanpedro.com/home" },
  ];
  const showtimes = movies.filter((movie) => !movie.proximoEstreno).flatMap((movie, movieIndex) =>
    cinemas.filter((_, index) => (index + movieIndex) % 3 !== 0).flatMap((cinema, cinemaIndex) =>
      Array.from({ length: 7 }, (_, day) => ["13:30", "16:15", "19:00", "21:30"].slice(0, 2 + (movieIndex + cinemaIndex) % 3).map((hora, slot) => ({
        id: `${movie.id}-${cinema.id}-${day}-${slot}`, movieId: movie.id, cinemaId: cinema.id,
        fecha: addDays(today, day), hora, sala: `Sala ${1 + movieIndex % 5}`,
        precio: [3500, 4200, 4500][cinemaIndex % 3], formato: slot === 3 ? "IMAX" : "2D",
        idioma: slot % 2 === 0 ? "Subtitulada" : "Doblada", sourceUrl: cinema.url,
      }))).flat()));
  return { movies, cinemas, showtimes, mode: "demo", updatedAt: null,
    sources: cinemas.map((cinema) => ({ cadena: cinema.cadena, estado: "pendiente", ultimaEjecucion: null, ultimoExito: null, mensaje: "Datos ilustrativos; no representan la cartelera actual." })) };
}