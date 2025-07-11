/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            animation: {
                'gradient': 'gradient 6s ease infinite',
                'pulse': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            colors: {
                purple: {
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    900: '#4c1d95',
                },
                blue: {
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    900: '#1e3a8a',
                },
                gray: {
                    300: '#d1d5db',
                    400: '#9ca3af',
                    500: '#6b7280',
                    600: '#4b5563',
                    700: '#374151',
                    800: '#1f2937',
                    900: '#111827',
                }
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
