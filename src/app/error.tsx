"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="unavailable"><h1>Se interrumpió la función</h1>
    <p>Ocurrió un error al cargar esta página.</p><button className="primary-button" onClick={reset}>Reintentar</button></main>;
}