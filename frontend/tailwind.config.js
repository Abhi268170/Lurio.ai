/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: "#C19A83",
                "navy-dark": "#1B263B",
                "background-light": "#F9FAFB",
                "background-dark": "#0F172A",
            },
            fontFamily: {
                display: ["Playfair Display", "serif"],
                sans: ["Inter", "sans-serif"],
            },
            borderRadius: {
                DEFAULT: "0.75rem",
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
