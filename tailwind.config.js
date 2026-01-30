/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundColor: {
        'bg-dark': 'var(--bg-dark)',
        'glass': 'var(--glass)',
        'glass-hover': 'var(--glass-hover)',
      },
      textColor: {
        'text-main': 'var(--text-main)',
        'text-dark': 'var(--text-dark)',
        'text-muted': 'var(--text-muted)',
      },
      borderColor: {
        'border': 'var(--border)',
        'border-hover': 'var(--border-hover)',
      },
      colors: {
        'neon-blue': 'var(--neon-blue)',
        'neon-purple': 'var(--neon-purple)',
        'neon-pink': 'var(--neon-pink)',
        'neon-orange': 'var(--neon-orange)',
        'neon-green': 'var(--neon-green)',
        'color-main': 'rgb(var(--color-main) / <alpha-value>)',
        'color-accent': 'rgb(var(--color-accent) / <alpha-value>)',
        'color-mixed': 'rgb(var(--color-mixed) / <alpha-value>)',
      },
      fontFamily: {
        head: ['Space Grotesk', 'Segoe UI', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 20s infinite alternate',
        'progress-glow': 'progressGlow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%': { transform: 'translate(0, 0) rotate(0deg)' },
          '100%': { transform: 'translate(30px, 20px) rotate(5deg)' },
        },
        progressGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      transitionTimingFunction: {
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
}
