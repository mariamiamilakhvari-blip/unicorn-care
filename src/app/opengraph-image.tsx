import { ImageResponse } from 'next/og';

import { APP_NAME } from '@/shared/const/app.const';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${APP_NAME} — plastic surgery patient management software`;

/**
 * The card shown when the site is shared. Generated rather than a static asset so it stays in step
 * with the brand colours, and because a link with no image is materially less likely to be opened.
 *
 * Inline styles are what `next/og` accepts — it renders through Satori, not the browser, so no
 * stylesheet or Tailwind class reaches it. CLAUDE.md §0 governs the React UI, not this.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#092B4D',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: '#A8B33A', letterSpacing: 2 }}>
          {APP_NAME}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            marginTop: 24,
            lineHeight: 1.15,
          }}
        >
          Post-op care your clinic actually controls.
        </div>
        <div style={{ display: 'flex', fontSize: 28, marginTop: 28, color: '#C7D2E0' }}>
          Plastic surgery patient management software
        </div>
      </div>
    ),
    size
  );
}
