import { InferenceSession, Tensor } from "onnxruntime-web";
import { encode, decode } from './tokenizer';

import en_uk from '../dictionaries/en_uk.json';
import en_us from '../dictionaries/en_us.json';
import de from '../dictionaries/de.json';
import fr from '../dictionaries/fr.json';
import es from '../dictionaries/es.json';

const dictionaries = {
  "en_uk": en_uk,
  "en_us": en_us,
  "de": de,
  "fr": fr,
  "es": es
} as Record<string, Record<string, string>>;

export class DeepPhonemizer {
    session: InferenceSession;

    constructor(session: InferenceSession) {
        this.session = session;
    }

    static async load_from_path(modelPath: string): Promise<DeepPhonemizer> {
        const options = {
            graphOptimizationLevel: 'all',
            enableCpuMemArena: true,
            enableMemPattern: true,
            executionMode: 'sequential'
        } as InferenceSession.SessionOptions;
    
        const session = await InferenceSession.create(
            modelPath,
            options
        );
    
        return new DeepPhonemizer(session);
    }

    static async load(): Promise<DeepPhonemizer> {
        const modelPath = "https://raw.githubusercontent.com/Mobile-Artificial-Intelligence/expo-deep-phonemizer/refs/heads/main/assets/deep-phonemizer.onnx";
        
        return DeepPhonemizer.load_from_path(modelPath);
    }

    async phonemize(
        text: string, 
        lang: string = "en_us", 
        keepPunctuation = false
    ): Promise<string> {
        // Match words, or single punctuation marks
        const tokens = text.match(/\w+|[^\w\s]/g) || [];
        const phonemes: string[] = [];

        const dictionary = dictionaries[lang];

        for (const token of tokens) {
            if (/^\w+$/.test(token)) {
                // It's a word
                const lower = token.toLowerCase();
                const phoneme = dictionary[lower] || await this._phonemize(lower, lang);
                phonemes.push(phoneme);
            } else {
                // It's punctuation or bracket/quote
                phonemes.push(keepPunctuation ? token : "");
            }
        }

        // Reassemble: words separated by space, but punctuation smartly attached
        return phonemes
            .join(" ")
            // Remove spaces before common punctuation (commas, periods, !, ?)
            .replace(/\s+([.,!?;:])/g, "$1")
            // Remove spaces just inside closing quotes/brackets
            .replace(/\s+([\]\)\}»”’])/g, "$1")
            // Remove spaces just after opening quotes/brackets
            .replace(/([\[\(\{«“‘])\s+/g, "$1");
    }

    async _phonemize(text: string, lang: string = "en_us"): Promise<string> {
        const tokens = encode(text, lang);

        // If the tokens are smaller than 64 in lenth pad with zeros
        while (tokens.length < 64) {
            tokens.push(0);
        }

        const inputTensor = new Tensor("int64", BigInt64Array.from(tokens.map(BigInt)), [1, tokens.length]);
        const feeds: Record<string, Tensor> = { text: inputTensor };
        const results = await this.session.run(feeds);

        const outputTensor = results["output"];
        if (!outputTensor) {
            throw new Error("No output tensor from model");
        }

        const logits = outputTensor.data as Float32Array;

        // shape: [1, seq_len, vocab_size]
        const [_batch, seq, vocab] = outputTensor.dims;
        const outIds: number[] = [];
        for (let t = 0; t < seq; t++) {
          let maxIdx = 0;
          let maxVal = -Infinity;
          for (let v = 0; v < vocab; v++) {
            const val = logits[t * vocab + v];
            if (val > maxVal) {
              maxVal = val;
              maxIdx = v;
            }
          }
          outIds.push(maxIdx);
        }
        return decode(outIds);
    }
}