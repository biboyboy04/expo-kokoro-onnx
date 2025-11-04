package com.allysonai.ttsdemo.phonemizer

import android.content.Context
import android.content.res.Resources
import com.allysonai.ttsdemo.phonemizer.R
import java.io.IOException
import java.util.Locale

/**
 * Kotlin port of the reference phoneme converter. Loads the CMU dictionary and
 * exposes a `phonemize` API that mirrors the JS reference implementation.
 *
 * NOTE: The implementation is intentionally close to the original file in
 * `referenceNativeModule/PhonemeConverter.kt`; only minimal clean ups were made
 * to adapt it for use in the Expo module.
 */
class PhonemeConverter(context: Context) {
  private val phonemeMap = mutableMapOf<String, String>()

  init {
    loadDictionary(context)
  }

  private fun loadDictionary(context: Context) {
    try {
      context.resources.openRawResource(R.raw.cmudict_ipa).bufferedReader()
        .useLines { lines ->
          lines
            .filter { !it.startsWith(";;;") && it.isNotBlank() }
            .forEach { line ->
              val parts = line.split("\t", limit = 2)
              if (parts.size == 2) {
                phonemeMap[parts[0]] = parts[1]
              }
            }
        }
      println("PhonemeConverter: dictionary loaded (${phonemeMap.size} entries)")
    } catch (e: IOException) {
      println("PhonemeConverter: error loading dictionary ${e.message}")
      e.printStackTrace()
    } catch (e: Resources.NotFoundException) {
      println("PhonemeConverter: dictionary resource not found ${e.message}")
      e.printStackTrace()
    }
  }

  private fun convertToPhonemes(word: String): String {
    if (word.matches(Regex("[^a-zA-Z']+"))) {
      return word
    }

    val cleanWord = word.replace(Regex("[^a-zA-Z']"), "")
    val arpabetWithoutStress = cleanWord.uppercase(Locale.US).replace(Regex("[0-9]"), "'")
    val phonemes = phonemeMap[arpabetWithoutStress] ?: return fallbackTranscribe(word)
    return phonemes.split(",").first().trim()
  }

  private fun fallbackTranscribe(word: String): String {
    println("PhonemeConverter: using fallback transcription for '$word'")
    return word
  }

  fun phonemize(text: String, lang: String = "en-us", norm: Boolean = true): String {
    val normalizedText = if (norm) normalizeText(text) else text

    val wordsAndPunctuation = normalizedText
      .split(Regex("(?<=\\W)|(?=\\W)"))
      .filter { it.isNotBlank() }

    val phonemes = StringBuilder()
    for ((index, word) in wordsAndPunctuation.withIndex()) {
      val ipaPhonemes = if (word.matches(Regex("[^a-zA-Z']+"))) {
        word
      } else {
        val temp = convertToPhonemes(word).replace(" ", "").replace("?", "")
        adjustStressMarkers(temp)
      }

      if (index > 0 && !word.matches(Regex("[^a-zA-Z']+"))) {
        phonemes.append(" ")
      }
      phonemes.append(ipaPhonemes)
    }

    return postProcessPhonemes(phonemes.toString(), lang)
  }

  fun adjustStressMarkers(input: String): String {
    val vowels = setOf(
      'a', 'e', 'i', 'o', 'u',
      '�', '�', '�', '�', '�', '�',
      'A', 'E', 'I', 'O', 'U'
    )

    val builder = StringBuilder(input)
    var i = 0
    while (i < builder.length) {
      if (builder[i] == '\'' || builder[i] == '�') {
        val stressIndex = i
        val stressChar = builder[i]
        for (j in stressIndex + 1 until builder.length) {
          if (builder[j] in vowels) {
            builder.deleteCharAt(stressIndex)
            builder.insert(j - 1, stressChar)
            i = j
            break
          }
        }
      }
      i++
    }
    return builder.toString()
  }

  private fun normalizeText(text: String): String {
    var normalizedText = text
      .lines()
      .joinToString("\n") { it.trim() }
      .replace("[`']".toRegex(), "'")
      .replace("[\"“”]".toRegex(), "\"")
      .replace("[¿¡,.:;?]".toRegex()) { match ->
        when (match.value) {
          "¿" -> ","
          "¡" -> "."
          "!" -> "!"
          "," -> ","
          ":" -> ":"
          ";" -> ";"
          "?" -> "?"
          else -> match.value
        } + " "
      }

    normalizedText = normalizedText
      .replace(Regex("\\bD[Rr]\\.(?= [A-Z])"), "Doctor")
      .replace(Regex("\\b(?:Mr\\.|MR\\.(?= [A-Z]))"), "Mister")
      .replace(Regex("\\b(?:Ms\\.|MS\\.(?= [A-Z]))"), "Miss")
      .replace(Regex("\\b(?:Mrs\\.|MRS\\.(?= [A-Z]))"), "Mrs")
      .replace(Regex("\\betc\\.(?! [A-Z])"), "etc")

    normalizedText = normalizedText.replace(Regex("(?<=\\d),(?=\\d)"), "")
    normalizedText = normalizedText.replace(Regex("(?<=\\d)-(?=\\d)"), " to ")

    return normalizedText.trim()
  }

  private fun postProcessPhonemes(phonemes: String, lang: String): String {
    var result = phonemes
      .replace("r", "�")
      .replace("x", "k")
      .replace("�", "j")
      .replace("�", "l")

    result = result.replace("k�k'o��o�", "k'o�k��o�")
      .replace("k�k'�����", "k'��k����")

    if (lang == "en-us") {
      result = result.replace("ti", "di")
    }

    result = result.filter { it in VOCAB.keys || it.toString().matches(Regex("[^a-zA-Z']+")) }

    return result.trim()
  }

  companion object {
    private val VOCAB: Map<Char, Int> = run {
      val pad = '$'
      val punctuation = ";:,.!?¡¿-.'\"“” "
      val letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
      val lettersIpa = "ɑæəɚɝɐdʒəɾɛŋŋɡɥɪɫɬɭɲɵœøɹʃθðʊʌʒˈˌːˑ˞ˠˡˢˣ˥˦˧˨˩"
      val symbols = listOf(pad) + punctuation.toList() + letters.toList() + lettersIpa.toList()
      symbols.withIndex().associate { (index, char) -> char to index }
    }
  }
}
