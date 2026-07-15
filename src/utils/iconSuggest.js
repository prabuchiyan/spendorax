import { MaterialCommunityIcons } from '@expo/vector-icons';

const SUGGESTIONS = {
  gym: 'dumbbell', fitness: 'dumbbell', snack: 'food-apple', food: 'food', coffee: 'coffee', tea: 'coffee',
  veg: 'leaf', vegetable: 'leaf', non: 'food-drumstick', meat: 'food-drumstick', dinner: 'silverware-fork-knife',
  lunch: 'silverware-fork-knife', breakfast: 'silverware-fork-knife', rent: 'home', grocer: 'shopping',
  grocery: 'shopping', salary: 'cash', income: 'cash', transport: 'car', travel: 'car', movie: 'movie', music: 'music',
};

const FALLBACK_ICONS = ['tag', 'shopping', 'home', 'cash', 'credit-card', 'wallet', 'food', 'gift', 'account'];

function isValidIcon(icon) {
  const glyph = MaterialCommunityIcons?.glyphMap || {};
  return !!glyph[icon];
}

function chooseValid(icon) {
  if (isValidIcon(icon)) return icon;
  for (const fallback of FALLBACK_ICONS) {
    if (isValidIcon(fallback)) return fallback;
  }
  return 'tag';
}

export function suggestIconForText(text, defaultIcon = 'tag') {
  if (!text) return chooseValid(defaultIcon);
  const normalized = text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    if (SUGGESTIONS[token]) return chooseValid(SUGGESTIONS[token]);
  }

  for (const key of Object.keys(SUGGESTIONS)) {
    try {
      const re = new RegExp(`\\b${key}\\b`);
      if (re.test(normalized)) return chooseValid(SUGGESTIONS[key]);
    } catch (e) { /* ignore invalid regex */ }
  }

  for (const token of tokens) {
    for (const key of Object.keys(SUGGESTIONS)) {
      if (token.includes(key) || key.includes(token)) return chooseValid(SUGGESTIONS[key]);
    }
  }

  return chooseValid(defaultIcon);
}
