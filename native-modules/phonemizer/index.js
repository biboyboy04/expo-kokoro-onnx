const { NativeModulesProxy } = require('expo-modules-core');

const NativePhonemizer = NativeModulesProxy?.Phonemizer;

function assertAvailable() {
  if (!NativePhonemizer || typeof NativePhonemizer.generatePhonemes !== 'function') {
    throw new Error('Phonemizer native module is not available on this platform.');
  }

  return NativePhonemizer;
}

function isNativePhonemizerAvailable() {
  return Boolean(NativePhonemizer && typeof NativePhonemizer.generatePhonemes === 'function');
}

async function generatePhonemes(text, options = {}) {
  const module = assertAvailable();
  return module.generatePhonemes(text, options);
}

module.exports = {
  generatePhonemes,
  isNativePhonemizerAvailable,
};

