/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{html,js,ts,jsx,tsx}", // Adjust paths based on your project structure
    ],
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1534px',
            },
        },
        extend: {},
        screens: {
            // default norms
            sm: { min: '0px', max: '1023px' },
            md: { min: '1024px' },
        },
    },
    plugins: [],
};