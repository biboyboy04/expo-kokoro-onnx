import { phonemize as refPhonemize } from '../ref-phonemizer';

export type PhonemizerLanguage = 'a' | 'b';

type RefPhonemizeFn = (
  text: string,
  language?: PhonemizerLanguage,
  norm?: boolean
) => Promise<string>;

const phonemizeImpl = refPhonemize as RefPhonemizeFn;

export async function phonemizeText(
  text: string,
  language: PhonemizerLanguage = 'a',
  normalize = true
): Promise<string> {
  return phonemizeImpl(text, language, normalize);
}
