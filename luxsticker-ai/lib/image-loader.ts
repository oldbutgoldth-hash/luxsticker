/** Tiny in-memory cache so repeated re-renders (drag/resize) don't re-decode
 * the same PNG data/object URL every frame. */
const cache = new Map<string, HTMLImageElement>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = cache.get(url);
  if (cached && cached.complete) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      cache.set(url, img);
      resolve(img);
    };
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

export function getCachedImage(url: string): HTMLImageElement | undefined {
  return cache.get(url);
}
