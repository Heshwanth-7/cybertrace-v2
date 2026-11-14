CyberTrace v2: React + TypeScript (strict) + Vite + Tailwind CSS v4 + shadcn/ui.
Tailwind v4 is CSS-first: use @import "tailwindcss" and @theme in src/index.css. NEVER create tailwind.config.js or use v3 syntax.
Animation: GSAP with @gsap/react (useGSAP) and Lenis. Hand tracking: @mediapipe/tasks-vision, browser only. State: Zustand.
Structure: src/components/{layout,sections,studio,ui}, src/lib/{hand,draw}, src/hooks, src/store. legacy/ is the v1 reference: read it, never edit it, never import from it.
Edit ONLY the files named in the prompt. No new dependencies without asking. No any. No console.log left behind.
lib/hand code is pure functions with no DOM or React. Per-frame data lives in refs or the Zustand store's getState(), never React state.
Clean up every effect: cancel requestAnimationFrame, stop media tracks, close the landmarker, destroy Lenis, and use useGSAP for GSAP. StrictMode runs effects twice in dev.
Palette and fonts are tokens in @theme, never hard-coded hex in components. Use shadcn only for toolbar, dialog, tooltip and toasts, restyled to the theme.
Respect prefers-reduced-motion. No external images. Run no terminal commands unless asked.
Use Context7 only for React, GSAP, Lenis, MediaPipe or shadcn API questions.
Do not explain. Reply "done" and one line of what changed.
