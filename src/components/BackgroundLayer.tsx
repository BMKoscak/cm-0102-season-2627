/**
 * Full-Window Dynamic Background Layer with Double-Buffered 450ms Crossfade.
 *
 * Renders context-aware stadium/club/competition/player photography behind the CM 01/02 UI:
 *  - Zero white flash: starts immediately with procedural floodlit SVG and only flips slots
 *    once the next image has fully decoded.
 *  - Smooth 450ms crossfade between two buffered <img> layers.
 *  - Authentic CM 01/02 dark readability glass tint (default rgba(8, 14, 26, 0.72)),
 *    club-color atmospheric ambient glow, optional vignette, and optional CRT scanlines.
 *  - Reports live `ResolvedMedia` telemetry via `onMediaResolved` for the TopBar cache badge.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { BackgroundLayerProps } from '../types/contracts';
import type { BackgroundContext } from '../types/game';
import { buildFallbackSvgDataUrl, resolveBackground } from '../services/backgroundService';

interface ImageSlot {
  url: string;
  alt: string;
  isPlayer: boolean;
  accentColor: string;
  secondaryColor?: string;
}

function preloadImageUrl(url: string): Promise<boolean> {
  // Data URLs and Blob URLs decode instantly without remote preloading
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  context,
  audioSettings,
  onMediaResolved,
}) => {
  const initialSvg = useMemo(
    () => buildFallbackSvgDataUrl(context),
    // Only used as synchronous frame-0 seed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [slots, setSlots] = useState<[ImageSlot, ImageSlot]>(() => [
    {
      url: initialSvg,
      alt: context.title,
      isPlayer: context.kind === 'player',
      accentColor: context.accentColor,
      secondaryColor: context.secondaryColor,
    },
    {
      url: initialSvg,
      alt: context.title,
      isPlayer: context.kind === 'player',
      accentColor: context.accentColor,
      secondaryColor: context.secondaryColor,
    },
  ]);

  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const activeSlotRef = useRef<0 | 1>(0);
  const currentUrlRef = useRef<string>(initialSvg);
  const requestSeqRef = useRef<number>(0);
  const onResolvedRef = useRef(onMediaResolved);
  onResolvedRef.current = onMediaResolved;

  // Serialize context identity cleanly to avoid redundant re-fetches on unrelated state updates
  const contextKey = `${context.kind}|${context.slug}|${context.primaryQuery}|${context.directImageUrl ?? ''}`;

  useEffect(() => {
    let cancelled = false;
    const seq = ++requestSeqRef.current;
    const capturedCtx: BackgroundContext = context;

    const commitToInactiveSlot = (url: string, isPlayer: boolean) => {
      if (cancelled || seq !== requestSeqRef.current) return;
      if (url === currentUrlRef.current) return;

      const nextSlot: 0 | 1 = activeSlotRef.current === 0 ? 1 : 0;
      const nextSlotData: ImageSlot = {
        url,
        alt: capturedCtx.subtitle || capturedCtx.title,
        isPlayer,
        accentColor: capturedCtx.accentColor,
        secondaryColor: capturedCtx.secondaryColor,
      };

      setSlots((prev) =>
        nextSlot === 0 ? [nextSlotData, prev[1]] : [prev[0], nextSlotData]
      );

      // Flip visibility on the next animation frame so CSS opacity transitions cleanly over 450ms
      requestAnimationFrame(() => {
        if (cancelled || seq !== requestSeqRef.current) return;
        currentUrlRef.current = url;
        activeSlotRef.current = nextSlot;
        setActiveSlot(nextSlot);
      });
    };

    void (async () => {
      const resolved = await resolveBackground(capturedCtx);
      if (cancelled || seq !== requestSeqRef.current) return;

      onResolvedRef.current?.(resolved);

      const loadedOk = await preloadImageUrl(resolved.url);
      if (cancelled || seq !== requestSeqRef.current) return;

      if (loadedOk) {
        commitToInactiveSlot(resolved.url, capturedCtx.kind === 'player');
      } else {
        const fallbackUrl = buildFallbackSvgDataUrl(capturedCtx);
        onResolvedRef.current?.({
          ...resolved,
          url: fallbackUrl,
          source: 'fallback',
          cached: false,
          attribution: 'Procedural Floodlit Pitch (Fallback)',
        });
        commitToInactiveSlot(fallbackUrl, capturedCtx.kind === 'player');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  const overlayOpacity =
    typeof audioSettings.overlayOpacity === 'number'
      ? Math.max(0.55, Math.min(0.9, audioSettings.overlayOpacity))
      : 0.72;

  const accentGlowStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `radial-gradient(ellipse at 22% 14%, ${context.accentColor || '#1d4ed8'}26 0%, transparent 56%), radial-gradient(ellipse at 82% 84%, ${context.secondaryColor || '#ffd84d'}14 0%, transparent 52%)`,
    transition: 'background 450ms ease',
  };

  return (
    <div className="cm-bg-layer" aria-hidden="true">
      {/* Subtle club/competition ambient glow beneath double-buffered photos */}
      <div style={accentGlowStyle} />

      {/* Double-buffered image slots for zero-flash 450ms crossfade */}
      {slots.map((slot, idx) => {
        const isActive = activeSlot === idx;
        return (
          <img
            key={idx}
            src={slot.url}
            alt=""
            decoding="async"
            referrerPolicy="no-referrer"
            className={`cm-bg-image${isActive ? ' is-visible' : ''}`}
            style={{
              objectPosition: slot.isPlayer ? 'center 20%' : 'center center',
              transition: 'opacity 450ms ease-in-out, transform 900ms ease-out',
              willChange: 'opacity, transform',
            }}
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.startsWith('data:image/svg+xml')) {
                target.src = buildFallbackSvgDataUrl(context);
              }
            }}
          />
        );
      })}

      {/* Authentic CM 01/02 dark-tinted readability glass overlay */}
      <div
        className="cm-bg-tint"
        style={{
          backgroundColor: `rgba(8, 14, 26, ${overlayOpacity})`,
        }}
      />

      {/* Toggleable atmospheric stadium vignette */}
      {audioSettings.vignette && <div className="cm-bg-vignette" />}

      {/* Toggleable retro CRT scanlines */}
      {audioSettings.scanlines && <div className="cm-bg-scanlines" />}
    </div>
  );
};

export default BackgroundLayer;
