export const TIME_ZONE = "America/Costa_Rica";

export function localDate(date = new Date()): string {
   const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
   }).formatToParts(date);
   const part = (type: string) => parts.find((item) => item.type === type)!.value;
   return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addDays(date: string, offset: number): string {
   const value = new Date(`${date}T12:00:00-06:00`);
   value.setUTCDate(value.getUTCDate() + offset);
   return localDate(value);
}

export function displayDate(date: string, options?: Intl.DateTimeFormatOptions): string {
   return new Intl.DateTimeFormat("es-CR", {
      timeZone: TIME_ZONE, day: "numeric", month: "long", ...options,
   }).format(new Date(`${date}T12:00:00-06:00`));
}

export function displayTime(time: string): string {
   const [hours, minutes] = time.split(":");
   const hour = Number(hours);
   return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "p. m." : "a. m."}`;
}