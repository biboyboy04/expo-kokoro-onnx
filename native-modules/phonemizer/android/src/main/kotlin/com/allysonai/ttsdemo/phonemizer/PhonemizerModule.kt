package com.allysonai.ttsdemo.phonemizer

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class PhonemizerModule : Module() {
  private var converter: PhonemeConverter? = null

  override fun definition() = ModuleDefinition {
    Name("Phonemizer")

    OnCreate {
      ensureConverter()
    }

    AsyncFunction("generatePhonemes") { text: String, options: PhonemizerOptions? ->
      val converter = ensureConverter()
      if (text.isBlank()) {
        return@AsyncFunction emptyList<String>()
      }

      val lang = options?.languageCode ?: "en-us"
      val normalize = options?.normalizeText ?: true
      val phonemeString = converter.phonemize(text, lang, normalize)
      val tokens = phonemeString
        .split(Regex("\\s+"))
        .mapNotNull { token ->
          val trimmed = token.trim()
          if (trimmed.isEmpty()) null else trimmed
        }
      tokens
    }
  }

  private fun ensureConverter(): PhonemeConverter {
    converter?.let { return it }
    val context = obtainContext()
    val created = PhonemeConverter(context)
    converter = created
    return created
  }

  private fun obtainContext(): Context {
    val reactContext = appContext.reactContext
    if (reactContext != null) {
      return reactContext.applicationContext
    }

    val currentActivity = appContext.currentActivity
    if (currentActivity != null) {
      return currentActivity.applicationContext
    }

    return appContext.applicationContext ?: throw IllegalStateException(
      "PhonemizerModule: unable to obtain Android context"
    )
  }
}

class PhonemizerOptions : Record {
  @Field
  var languageCode: String? = null

  @Field
  var normalizeText: Boolean? = null
}
