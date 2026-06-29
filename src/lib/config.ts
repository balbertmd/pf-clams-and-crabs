// Technical settings kept OUT of the CMS so a content editor (Nick) can't
// accidentally break the weather header, brand color, or booking form.
// Change these in code only.
export const SITE = {
  lat: 38.9945679,
  lng: -74.8431244,
  timezone: 'America/New_York',
  accent: '#0f766e',
  forminitFormId: '',
};

// Online quote-request form + Specials/Deals are PARKED for now: shown only in
// local dev (npm run dev) so we can keep building them, hidden on the public
// live site. To launch them publicly, change this to `true`.
export const SHOW_QUOTES = import.meta.env.DEV;
