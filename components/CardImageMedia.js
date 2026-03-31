/**
 * Shared product/menu image frame: full image visible (object-contain), fixed heights.
 * Same system on /order and /admin list cards.
 */

const CARD_MEDIA_BASE =
  "relative h-[140px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-stone-100 via-amber-50/45 to-orange-50/35 ring-1 ring-stone-200/55 sm:h-[160px]";

/** /order product grid: slightly taller media, same contain + frame. */
const CARD_MEDIA_ORDER_GRID_BASE =
  "relative h-[156px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-stone-100 via-amber-50/45 to-orange-50/35 ring-1 ring-stone-200/55 sm:h-[176px]";

/** List/grid cards: full width, fixed height, overflow hidden, neutral gradient. */
export const CARD_MEDIA_OUTER = `${CARD_MEDIA_BASE} w-full`;

export const CARD_MEDIA_ORDER_GRID_OUTER = `${CARD_MEDIA_ORDER_GRID_BASE} w-full`;

/** Admin edit modal preview: slightly shorter, same contain + background system. */
export const CARD_MEDIA_PREVIEW_OUTER =
  "relative h-[120px] w-full shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-stone-100 via-amber-50/45 to-orange-50/35 ring-1 ring-stone-200/55 sm:h-[128px]";

/** Inner: padding 8px mobile, 12px sm (within 8–12px spec). */
export const CARD_MEDIA_INNER = "flex h-full w-full items-center justify-center p-2 sm:p-3";

/** Tighter inner padding for /order product cards. */
export const CARD_MEDIA_INNER_COMPACT = "flex h-full w-full items-center justify-center p-1.5 sm:p-2";

/** Image: fully visible, centered, not stretched (never object-cover). */
export const CARD_MEDIA_IMG = "max-h-full max-w-full object-contain object-center";

/** Menu row thumb: same heights, width = 4/3 × height. */
export const CARD_MEDIA_THUMB_OUTER = `${CARD_MEDIA_BASE} w-[calc(140px*4/3)] sm:w-[calc(160px*4/3)]`;

export function CardImageMedia({ src, alt, emojiFallback = "🥐", variant = "default" }) {
  const safe = typeof src === "string" ? src.trim() : "";
  const bad = !safe || /^https?:\/\/https?:\/\//i.test(safe);
  const outer = variant === "orderGrid" ? CARD_MEDIA_ORDER_GRID_OUTER : CARD_MEDIA_OUTER;
  const inner = variant === "orderGrid" ? CARD_MEDIA_INNER_COMPACT : CARD_MEDIA_INNER;

  return (
    <div className={outer}>
      <div className={inner}>
        {bad ? (
          <span className="text-4xl opacity-90" aria-hidden>
            {emojiFallback}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safe} alt={alt || ""} className={CARD_MEDIA_IMG} loading="lazy" />
        )}
      </div>
    </div>
  );
}

export function CardImageMediaPreview({ src, alt, emojiFallback = "🥐" }) {
  const safe = typeof src === "string" ? src.trim() : "";
  const bad = !safe || /^https?:\/\/https?:\/\//i.test(safe);
  return (
    <div className={CARD_MEDIA_PREVIEW_OUTER}>
      <div className={CARD_MEDIA_INNER}>
        {bad ? (
          <span className="text-3xl opacity-90" aria-hidden>
            {emojiFallback}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safe} alt={alt || ""} className={CARD_MEDIA_IMG} />
        )}
      </div>
    </div>
  );
}

export function CardImageMediaThumb({ src, alt, emojiFallback = "📋" }) {
  const safe = typeof src === "string" ? src.trim() : "";
  const bad = !safe || /^https?:\/\/https?:\/\//i.test(safe);

  return (
    <div className={CARD_MEDIA_THUMB_OUTER}>
      <div className={CARD_MEDIA_INNER}>
        {bad ? (
          <span className="text-4xl opacity-90" aria-hidden>
            {emojiFallback}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safe} alt={alt || ""} className={CARD_MEDIA_IMG} loading="lazy" />
        )}
      </div>
    </div>
  );
}
