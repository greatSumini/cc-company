/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 커스텀 색상 제거 — Tailwind 기본 팔레트 사용 (예: bg-red-100, text-red-400)
      // 커스텀 shadow 제거 — DDR-006에 따라 shadow 최소 사용
    },
  },
  plugins: [],
}
