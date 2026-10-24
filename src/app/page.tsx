import { getCatalog } from "@/application/catalog-service";
import { CinemaApp } from "@/components/cinema-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const catalog = await getCatalog();
    return <CinemaApp initialCatalog={catalog} />;
  } catch {
    return <main className="unavailable"><div className="brand-mark">m.</div>
      <h1>La cartelera no está disponible</h1>
      <p>No pudimos conectar con la base de datos. La información de demostración no sustituirá los datos reales.</p>
      <a href="/">Volver a intentar</a>
    </main>;
  }
}