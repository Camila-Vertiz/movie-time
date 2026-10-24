import { createHash } from "node:crypto";
import { localDate } from "../../src/lib/dates";

export function stableId(prefix: string, ...parts: string[]): string {
  const normalized = parts.map((part) => part.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).join("|");
  return `${prefix}-${createHash("sha256").update(normalized).digest("hex").slice(0, 24)}`;
}

export function safeUrl(value: string | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function parseClock(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 23 || (match[3] && (hours < 1 || hours > 12))) return null;
  if (match[3]) hours = hours % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

export function parseGarboDate(value: string): { fecha: string; hora: string } | null {
  const match = value.trim().match(/^(\d{1,2})\s+([A-Za-záé]+)\s+(\d{4}),\s*(\d{1,2}:\d{2})$/);
  if (!match) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months.indexOf(match[2].toLowerCase().slice(0, 3)) + 1;
  const hora = parseClock(match[4]);
  if (!month || !hora) return null;
  const fecha = `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  if (Number.isNaN(Date.parse(`${fecha}T12:00:00-06:00`)) || localDate(new Date(`${fecha}T12:00:00-06:00`)) !== fecha) return null;
  return { fecha, hora };
}

export function parseSpanishDay(label: string, today = localDate()): string | null {
  const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  const match = label.toUpperCase().match(/\b(\d{1,2})\s+(?:DE\s+)?([A-Z]+)(?:\s+(\d{4}))?\b/);
  if (!match) return null;
  const month = months.indexOf(match[2]) + 1;
  if (!month) return null;
  const currentYear = Number(today.slice(0, 4));
  for (const year of match[3] ? [Number(match[3])] : [currentYear, currentYear + 1]) {
    const candidate = `${year}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    const parsed = new Date(`${candidate}T12:00:00-06:00`);
    const days = (parsed.getTime() - new Date(`${today}T12:00:00-06:00`).getTime()) / 86_400_000;
    if (!Number.isNaN(parsed.getTime()) && localDate(parsed) === candidate && days >= 0 && days <= 60) return candidate;
  }
  return null;
}