import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: {
          950: "#060d1f",
          900: "#0a1428",
          800: "#0f1f3d",
          700: "#162952",
        },
        "cold-blue": "#3b7dd8",
        "muted-gray": "#6b7280",
        "risk-red": "#9b2c2c",
        "risk-amber": "#92400e",
      },
    },
  },
  plugins: [],
};
export default config;
