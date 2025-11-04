export type GeneratePhonemesOptions = {
  languageCode?: string;
  normalizeText?: boolean;
};

export declare function isNativePhonemizerAvailable(): boolean;
export declare function generatePhonemes(text: string, options?: GeneratePhonemesOptions): Promise<string[]>;

