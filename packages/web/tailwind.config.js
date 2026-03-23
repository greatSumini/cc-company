/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 모노톤 기본 팔레트 (gray 사용)
        // 파스텔톤 강조색 (뱃지용)
        'badge-blue': {
          bg: '#dbeafe',      // blue-100
          text: '#2563eb',    // blue-600
        },
        'badge-green': {
          bg: '#dcfce7',      // green-100
          text: '#16a34a',    // green-600
        },
        'badge-yellow': {
          bg: '#fef9c3',      // yellow-100
          text: '#ca8a04',    // yellow-600
        },
        'badge-red': {
          bg: '#fee2e2',      // red-100
          text: '#dc2626',    // red-600
        },
        'badge-purple': {
          bg: '#f3e8ff',      // purple-100
          text: '#9333ea',    // purple-600
        },
        'badge-gray': {
          bg: '#f3f4f6',      // gray-100
          text: '#4b5563',    // gray-600
        },
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'soft-md': '0 2px 6px 0 rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
}
