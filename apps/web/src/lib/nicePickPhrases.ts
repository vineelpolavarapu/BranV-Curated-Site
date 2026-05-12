/**
 * Headline pool for the Nice Pick celebration modal (BUILD_GUIDE §5.2.5).
 * pickHeadline() avoids returning the same phrase twice in a row per browser.
 */
export const NICE_PICK_PHRASES = [
  'Nice pick!',
  'Solid choice!',
  'Great taste!',
  'Love that one!',
  "You've got an eye!",
  'Stylish move!',
  'Top tier!',
  "That's the one!",
  'Excellent!',
  'Pure class!',
  'Sharp!',
  'On point!',
  'Looking good!',
  'Killer choice!',
  'Bold move!',
  'Crisp!',
  'Elite taste!',
  'Wardrobe upgrade unlocked!',
  'Slick!',
  'Wardrobe win!',
] as const;

const STORAGE_KEY = 'branv:nicePickLast';

export function pickHeadline(): string {
  const lastUsed =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(STORAGE_KEY)
      : null;
  const pool = NICE_PICK_PHRASES.filter((p) => p !== lastUsed);
  const choice = pool[Math.floor(Math.random() * pool.length)];
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, choice);
  }
  return choice;
}
