// packages/frontend/src/styles/breakpoints.ts

/**
 * Pixel breakpoint values. Mirrors the CSS custom properties in `src/index.css`
 * (`--breakpoint-xs`…`--breakpoint-xxl`). Keep these two in sync.
 *
 * CSS files cannot use `var(...)` inside `@media` queries, so CSS uses literal
 * pixel values that match these numbers (with a comment indicating which token).
 */
export const BREAKPOINTS = {
  xs: 320,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1200,
  xxl: 1440,
} as const;

/**
 * Reusable media-query strings for `window.matchMedia` and the `useMediaQuery` hook.
 *
 * `mobile`  : viewports strictly below `md` (i.e. < 768px).
 * `tablet`  : `md` up to but not including `lg`.
 * `desktop` : `lg` and above.
 */
export const MEDIA = {
  mobile: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.lg}px)`,
} as const;
