/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Redefining zinc to match the requested Google Pay dark theme
        zinc: {
          100: '#FFFFFF', // Primary text (90-100% opacity)
          200: '#E0E0E0', 
          300: '#B0B0B0', // Secondary text
          400: '#B0B0B0', 
          500: '#7A7A7A', // Muted text/Inactive icons
          600: '#4A4A4A', 
          700: '#2C2C2C', // Focus borders
          800: '#2A2A2A', // Card borders / grid lines
          900: '#1E1E1E', // Secondary surface (cards / inputs)
          950: '#121212', // Primary background
        },
        // Accent Colors (Google Pay Vibe)
        indigo: {
          300: '#5A95F5', // Hover CTA
          400: '#5A95F5', 
          500: '#4285F4', // Primary Accent (main actions / active nav)
          600: '#4285F4', 
        },
        emerald: {
          400: '#34A853', // Secondary Accent (positive / money in)
          500: '#34A853',
        },
        red: {
          400: '#EA4335', // Error / Expense
          500: '#EA4335',
        },
        amber: {
          400: '#FB8C00', // Warning / Expense Highlight
          500: '#FB8C00',
        },
        fuchsia: {
          400: '#4285F4', // Redirecting old fuchsia to primary blue for consistency
          500: '#4285F4',
        }
      }
    },
  },
  plugins: [],
}
