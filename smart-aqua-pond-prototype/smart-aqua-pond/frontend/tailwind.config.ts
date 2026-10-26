import type { Config } from "tailwindcss";
const config: Config = { content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { ocean: { 950: "#082f35", 900: "#0b3d43", 800: "#10535a", 600: "#14827d", 500: "#1b9b8e", 100: "#e0f4ef" } }, boxShadow: { soft: "0 12px 35px rgba(19, 55, 61, 0.06)" } } }, plugins: [] };
export default config;
