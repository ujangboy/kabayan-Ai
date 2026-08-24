/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0E1520",
        background: "#0E1520",
        rail: "#0B111B",
        // PRD palette (Apple/Google-grade dark depth)
        appbase: "#0B0D13",
        sidebar: "#11141D",
        "surface-2": "#171B26",
        surface: "#121A27",
        card: "#1A2332",
        "card-hover": "#212D40",
        border: "#263349",
        glass: {
          DEFAULT: "rgba(15, 23, 42, 0.6)",
          card: "rgba(15, 23, 42, 0.65)",
          panel: "rgba(30, 41, 59, 0.5)",
          border: "rgba(255, 255, 255, 0.08)",
          borderStrong: "rgba(255, 255, 255, 0.14)",
        },
        // Aksen tunggal terkalibrasi: teal #14B8A6 (satu-satunya warna brand)
        primary: {
          DEFAULT: "#14B8A6",
          hover: "#2DD4BF",
          light: "#5EEAD4",
          foreground: "#FFFFFF",
        },
        text: {
          DEFAULT: "#EDF1F7",
          secondary: "#8C97A9",
          muted: "#5C6675",
        },
        success: "#22C55E",
        danger: "#EF4444",
        warning: "#F6B93B",
        info: "#29A8DF",
        orange: "#F97316",
        violet: "#14B8A6", // legacy token → dipetakan ke aksen teal (sweep bertahap)
        teal: "#10B981",
        amber: "#F6B93B",
        accent: {
          blue: "#29A8DF",
          purple: "#14B8A6", // legacy token → aksen teal
          teal: "#10B981",
          pink: "#EC4899",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      // Gemini scale — explicit agar tidak drift (Inter fallback Google Sans Text)
      // body default 16px/1.55, composer 18px, metadata 13px, label 11px
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }], // caption
        sm: ["14px", { lineHeight: "20px" }], // chip / secondary (was body)
        base: ["16px", { lineHeight: "24.8px" }], // Gemini answer body 16/1.55 (was 14px)
        lg: ["18px", { lineHeight: "25.2px" }], // composer 18/1.4 + section-header 18
        xl: ["20px", { lineHeight: "26px" }], // heading 20/1.3
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["28px", { lineHeight: "33.6px" }], // greeting 28/1.2
        "4xl": ["36px", { lineHeight: "40px" }],
        "5xl": ["48px", { lineHeight: "1" }],
        "6xl": ["60px", { lineHeight: "1" }],
        "7xl": ["72px", { lineHeight: "1" }],
        // Gemini micro tokens
        "2xs": ["11px", { lineHeight: "13.2px" }], // label-upper
        "3xs": ["10px", { lineHeight: "14px" }], // legacy micro (migrasi ke xs)
        meta: ["13px", { lineHeight: "16.9px" }], // metadata
      },
      letterSpacing: {
        headline: "-0.02em",
        subhead: "-0.015em",
      },
      borderRadius: {
        card: "12px",
        btn: "8px",
        input: "8px",
        dialog: "16px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)",
        glow: "0 0 20px rgba(20,184,166,0.22)",
        "glow-sm": "0 0 12px rgba(20,184,166,0.14)",
        "btn-primary": "0 1px 4px rgba(0,0,0,0.35), 0 0 0 1px rgba(20,184,166,0.2)",
        modal: "0 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
        "card-hover": "0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(45,212,191,0.18)",
        glass: "0 8px 24px rgba(0,0,0,0.4)",
        "glass-lg": "0 20px 48px rgba(0,0,0,0.55)",
        "glow-primary": "0 0 24px rgba(20,184,166,0.25)",
        sidebar: "4px 0 24px rgba(0,0,0,0.3)",
      },
      backgroundImage: {
        // Solid accent — gradien dihapus; nilai flat agar semua pemakaian
        // lama langsung jadi warna solid tanpa perlu sweep 35 file sekaligus.
        "gradient-primary": "linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)",
        "gradient-primary-soft": "linear-gradient(135deg, rgba(20,184,166,0.14) 0%, rgba(13,148,136,0.14) 100%)",
        "gradient-app": "#0E1520",
        "gradient-hero": "linear-gradient(135deg, rgba(20,184,166,0.5) 0%, rgba(13,148,136,0.35) 100%)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fadeInUp: { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideIn: { from: { transform: "translateX(-16px)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        slideInRight: { from: { transform: "translateX(16px)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(24px) scale(0.98)" }, to: { opacity: "1", transform: "translateY(0) scale(1)" } },
        scaleIn: { from: { transform: "scale(0.95)", opacity: "0" }, to: { transform: "scale(1)", opacity: "1" } },
        fadeScale: { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        pulse2: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
        breathe: { "0%,100%": { opacity: "0.7", transform: "scale(1)" }, "50%": { opacity: "1", transform: "scale(1.05)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        pop: { "0%": { transform: "scale(0.8)", opacity: "0" }, "60%": { transform: "scale(1.05)" }, "100%": { transform: "scale(1)", opacity: "1" } },
        spin: { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "fade-in-up": "fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-in": "slideIn 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scaleIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-scale": "fadeScale 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 2s infinite linear",
        float: "float 3s ease-in-out infinite",
        breathe: "breathe 2.5s ease-in-out infinite",
        pop: "pop 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
