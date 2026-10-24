import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { canvas: "#101113", accent: "#f05a47" } } },
  plugins: [],
} satisfies Config;