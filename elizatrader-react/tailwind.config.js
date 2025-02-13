/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "dark-blue": "#1a1f2e",
        "darker-blue": "#242b3d",
        "border-blue": "#2d3548",
        "text-primary": "#e5e7eb",
        "text-muted": "#9ca3af",
        "button-blue": "#3b82f6",
        "button-hover": "#2563eb",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
