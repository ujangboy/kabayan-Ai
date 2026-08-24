/** @type {import('tailwindcss').Config} */
// Token semantik mengacu ke CSS variables di src/index.css (light/dark via .dark).
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 60% — kanvas
        base: "rgb(var(--bg-base) / <alpha-value>)",
        background: "rgb(var(--bg-base) / <alpha-value>)",
        appbase: "rgb(var(--bg-base) / <alpha-value>)",
        // 30% — container/surface
        rail: "rgb(var(--bg-subtle) / <alpha-value>)",
        sidebar: "rgb(var(--bg-subtle) / <alpha-value>)",
        surface: "rgb(var(--bg-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--bg-surface) / <alpha-value>)",
        popover: "rgb(var(--popover) / <alpha-value>)",
        // wash = tint interaktif tipis yang ikut tema
        wash: {
          DEFAULT: "rgb(var(--wash) / <alpha-value>)",
          strong: "rgb(var(--wash-strong) / <alpha-value>)",
        },
        card: "rgb(var(--wash) / <alpha-value>)",
        subtle: "rgb(var(--bg-subtle) / <alpha-value>)",
        "card-hover": "rgb(var(--wash-strong) / <alpha-value>)",
        border: "var(--border-subtle)",
        strong: "var(--border-strong)",
        glass: {
          DEFAULT: "rgb(var(--bg-surface) / <alpha-value>)",
          card: "rgb(var(--bg-surface) / <alpha-value>)",
          panel: "rgb(var(--bg-subtle) / <alpha-value>)",
          border: "var(--border-subtle)",
          borderStrong: "var(--border-strong)",
        },
        // 10% — aksen tunggal
        primary: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          light: "rgb(var(--accent-light) / <alpha-value>)",
          foreground: "#ffffff",
        },
        text: {
          DEFAULT: "rgb(var(--text-primary) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
        },
        success: "#22c55e",
        danger: "#ef4444",
        warning: "#f59e0b",
        info: "#38bdf8",
        // Palet data-viz terbatas — HANYA untuk chart/kategori/badge status,
        // bukan chrome (button/nav). Nilai mid-tone agar lolos di light & dark.
        accent: {
          blue: "#38bdf8",
          purple: "#818cf8",
          teal: "#2dd4bf",
          pink: "#f472b6",
        },
        // Alias legacy → diarahkan ke token semantik (sweep bertahap)
        violet: "rgb(var(--accent) / <alpha-value>)",
        teal: "#14b8a6",
        orange: "#f97316",
        amber: "#f59e0b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24.8px" }],
        lg: ["18px", { lineHeight: "25.2px" }],
        xl: ["20px", { lineHeight: "26px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["28px", { lineHeight: "33.6px" }],
        "4xl": ["36px", { lineHeight: "40px" }],
        meta: ["13px", { lineHeight: "16.9px" }],
        "2xs": ["11px", { lineHeight: "13.2px" }],
        "3xs": ["10px", { lineHeight: "12px" }],
      },
      letterSpacing: {
        headline: "-0.02em",
        subhead: "-0.015em",
      },
      borderRadius: {
        card: "8px",
        btn: "8px",
        input: "6px",
        dialog: "12px",
        pill: "999px",
      },
      boxShadow: {
        // Dark mode: tanpa drop shadow (elevasi dari surface + border).
        // Light mode: shadow sangat halus.
        card: "var(--shadow-card)",
        modal: "0 4px 24px rgba(0,0,0,0.18)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideIn: { from: { transform: "translateX(-16px)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        slideInRight: { from: { transform: "translateX(16px)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        scaleIn: { from: { transform: "scale(0.96)", opacity: "0" }, to: { transform: "scale(1)", opacity: "1" } },
        pulse2: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        pop: { "0%": { transform: "scale(0.96)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: {
        "fade-in": "fadeIn 0.25s ease-out",
        "slide-in": "slideIn 0.25s ease-out",
        "slide-in-right": "slideInRight 0.25s ease-out",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.32, 0.72, 0, 1)",
        shimmer: "shimmer 2s infinite linear",
        pop: "pop 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};
