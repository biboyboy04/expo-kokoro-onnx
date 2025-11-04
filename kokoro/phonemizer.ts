type EspeakPhonemize = (text: string, language: string) => Promise<string[]>;

declare const require: any;

export type PhonemizerLanguage = 'a' | 'b';

let espeakPhonemize: EspeakPhonemize | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-unsafe-assignment
  const phonemizerModule: { phonemize?: EspeakPhonemize } = require('phonemizer');
  if (typeof phonemizerModule?.phonemize === 'function') {
    espeakPhonemize = phonemizerModule.phonemize;
  }
} catch (error) {
  console.warn('Phonemizer dependency not available; falling back to heuristic phonemization.', error);
}

function split(text: string, regex: RegExp): Array<{ match: boolean; text: string }> {
  const result: Array<{ match: boolean; text: string }> = [];
  let prev = 0;

  for (const entry of text.matchAll(regex)) {
    const fullMatch = entry[0];
    const index = entry.index ?? 0;

    if (prev < index) {
      result.push({ match: false, text: text.slice(prev, index) });
    }

    if (fullMatch.length > 0) {
      result.push({ match: true, text: fullMatch });
    }

    prev = index + fullMatch.length;
  }

  if (prev < text.length) {
    result.push({ match: false, text: text.slice(prev) });
  }

  return result;
}

function splitNumber(match: string): string {
  if (match.includes('.')) {
    return match;
  }

  if (match.includes(':')) {
    const [hoursRaw, minutesRaw] = match.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return match;
    }

    if (minutes === 0) {
      return `${hours} o'clock`;
    }

    if (minutes < 10) {
      return `${hours} oh ${minutes}`;
    }

    return `${hours} ${minutes}`;
  }

  const hasSuffix = match.endsWith('s');
  const numeric = hasSuffix ? match.slice(0, -1) : match;
  const year = parseInt(numeric, 10);

  if (!Number.isFinite(year) || numeric.length !== 4) {
    return match;
  }

  const left = numeric.slice(0, 2);
  const rightNumber = parseInt(numeric.slice(2), 10);
  const suffix = hasSuffix ? 's' : '';

  if (rightNumber === 0) {
    return `${left} hundred${suffix}`;
  }

  if (rightNumber < 10) {
    return `${left} oh ${rightNumber}${suffix}`;
  }

  return `${left} ${rightNumber}${suffix}`;
}

function formatMoney(match: string): string {
  const symbol = match[0];
  const amount = match.slice(1);
  const bill = symbol === '$' ? 'dollar' : 'pound';

  if (Number.isNaN(Number(amount))) {
    return `${amount} ${bill}s`;
  }

  if (!amount.includes('.')) {
    const suffix = amount === '1' ? '' : 's';
    return `${amount} ${bill}${suffix}`;
  }

  const [whole, fractional] = amount.split('.');
  const cents = parseInt(fractional.padEnd(2, '0'), 10);
  const coin =
    symbol === '$'
      ? cents === 1
        ? 'cent'
        : 'cents'
      : cents === 1
        ? 'penny'
        : 'pence';

  return `${whole} ${bill}${whole === '1' ? '' : 's'} and ${cents} ${coin}`;
}

function pointNumber(match: string): string {
  const [head, tail] = match.split('.');
  return `${head} point ${tail.split('').join(' ')}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PUNCTUATION = `;:,.!?—-."“”(){}[]`;
const PUNCTUATION_PATTERN = new RegExp(`(\\s*[${escapeRegExp(PUNCTUATION)}]+\\s*)+`, 'g');

function normalizeInput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .replace(/\s+/g, ' ')
    .replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor')
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, 'Mister')
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, 'Miss')
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, 'Mrs')
    .replace(/\betc\.(?! [A-Z])/gi, 'etc')
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, splitNumber)
    .replace(/(?<=\d),(?=\d)/g, '')
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, formatMoney)
    .replace(/\d*\.\d+/g, pointNumber)
    .replace(/(?<=\d)-(?=\d)/g, ' to ')
    .replace(/(?<=\d)S/g, ' S')
    .replace(/(?<=[bcdfghj-np-tv-z])'?s\b/gi, "'S")
    .replace(/(?<=x')s\b/gi, 's')
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (match) => match.replace(/\./g, '-'))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/g, '-')
    .trim();
}

const ENGLISH_PHONEME_MAP: Record<string, string> = {
  a: 'ə',
  e: 'ɛ',
  i: 'ɪ',
  o: 'oʊ',
  u: 'ʌ',
  th: 'θ',
  sh: 'ʃ',
  ch: 'tʃ',
  ng: 'ŋ',
  j: 'dʒ',
  r: 'ɹ',
  er: 'ɝ',
  ar: 'ɑɹ',
  or: 'ɔɹ',
  ir: 'ɪɹ',
  ur: 'ʊɹ',
};

const COMMON_WORD_PHONEMES: Record<string, string> = {
  hello: 'hɛˈloʊ',
  world: 'wˈɝld',
  this: 'ðˈɪs',
  is: 'ˈɪz',
  a: 'ə',
  test: 'tˈɛst',
  of: 'ʌv',
  the: 'ðə',
  kokoro: 'kˈoʊkəɹoʊ',
  text: 'tˈɛkst',
  to: 'tˈuː',
  speech: 'spˈiːtʃ',
  system: 'sˈɪstəm',
  running: 'ɹˈʌnɪŋ',
  on: 'ˈɑːn',
  expo: 'ˈɛkspoʊ',
  with: 'wˈɪð',
  onnx: 'ˈɑːnɛks',
  runtime: 'ɹˈʌntaɪm',
};

const FALLBACK_VOWEL_PATTERN = /[ɑɐɒæəɘɚɛɜɝɞɨɪʊʌɔoeiuaɑː]/;

function fallbackPhonemizeWord(word: string): string {
  if (!word) {
    return '';
  }

  const cleaned = word.toLowerCase().replace(/[.,!?;:'"]/g, '');

  if (COMMON_WORD_PHONEMES[cleaned]) {
    return COMMON_WORD_PHONEMES[cleaned];
  }

  let phonemes = '';
  let index = 0;

  while (index < word.length) {
    const remaining = word.length - index;

    if (remaining > 1) {
      const digraph = word.substring(index, index + 2).toLowerCase();
      if (ENGLISH_PHONEME_MAP[digraph]) {
        phonemes += ENGLISH_PHONEME_MAP[digraph];
        index += 2;
        continue;
      }
    }

    const char = word[index];
    const lowerChar = char.toLowerCase();

    if (ENGLISH_PHONEME_MAP[lowerChar]) {
      phonemes += ENGLISH_PHONEME_MAP[lowerChar];
    } else if (/[a-z]/i.test(lowerChar)) {
      phonemes += lowerChar;
    } else if (/[.,!?;:'"]/.test(char)) {
      phonemes += char;
    }

    index += 1;
  }

  if (phonemes.length > 2 && !/[.,!?;:'"]/.test(word)) {
    const firstVowelMatch = phonemes.match(FALLBACK_VOWEL_PATTERN);
    if (firstVowelMatch?.index !== undefined) {
      const vowelIndex = firstVowelMatch.index;
      phonemes = `${phonemes.slice(0, vowelIndex)}ˈ${phonemes.slice(vowelIndex)}`;
    }
  }

  return phonemes || cleaned;
}

function fallbackPhonemize(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map(fallbackPhonemizeWord)
    .join(' ');
}

async function phonemizeWithEspeak(text: string, language: PhonemizerLanguage): Promise<string> {
  const phonemize = espeakPhonemize;
  if (!phonemize) {
    throw new Error('Phonemizer dependency is not available');
  }

  const sections = split(text, PUNCTUATION_PATTERN);
  const langCode = language === 'a' ? 'en-us' : 'en';
  const processedSections = await Promise.all(
    sections.map(async ({ match, text: section }) => {
      if (match) {
        return section;
      }
      const result = await phonemize(section, langCode);
      return result.join(' ');
    })
  );

  let phonemes = processedSections.join('');

  phonemes = phonemes
    .replace(/[x]/g, 'k')
    .replace(/r/g, 'ɹ')
    .replace(/\s+/g, ' ');

  if (language === 'a') {
    phonemes = phonemes.replace(/(?<=nˈæn)ti(?!ə)/g, 'di');
  }

  return phonemes.trim();
}

export async function phonemizeText(
  text: string,
  language: PhonemizerLanguage = 'a',
  normalize = true
): Promise<string> {
  const prepared = normalize ? normalizeInput(text) : text;

  if (!prepared) {
    return '';
  }

  if (espeakPhonemize) {
    try {
      return await phonemizeWithEspeak(prepared, language);
    } catch (error) {
      console.warn('Failed to phonemize text with eSpeak-NG, falling back to heuristic phonemizer.', error);
    }
  }

  return fallbackPhonemize(prepared);
}
