const { requireNativeModule } = require('expo-modules-core');

let cachedModule;

function resolveNativeModule() {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  try {
    cachedModule = requireNativeModule('Phonemizer');
  } catch (error) {
    cachedModule = null;
  }

  return cachedModule;
}

function isNativePhonemizerAvailable() {
  return Boolean(resolveNativeModule());
}

async function generatePhonemes(text, options = {}) {
  const module = resolveNativeModule();
  if (!module || typeof module.generatePhonemes !== 'function') {
    return [];
  }
  return module.generatePhonemes(text, options);
}

module.exports = {
  generatePhonemes,
  isNativePhonemizerAvailable,
};

