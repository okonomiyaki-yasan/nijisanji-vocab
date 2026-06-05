import { NextRequest, NextResponse } from "next/server";
import { toRomaji, isKatakana, isHiragana, isJapanese } from "wanakana";

interface DatamuseWord {
  word: string;
  score?: number;
}

interface DictPhonetic {
  text?: string;
}

interface DictDefinition {
  definition: string;
  example?: string;
}

interface DictMeaning {
  partOfSpeech: string;
  definitions: DictDefinition[];
}

interface DictEntry {
  word: string;
  phonetics?: DictPhonetic[];
  meanings: DictMeaning[];
}

interface WordResult {
  word: string;
  phonetic: string;
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
  suggestions: string[];
}

// 日本語かどうか判定（スペースを除いた部分で判定）
function isJapaneseInput(input: string): boolean {
  const stripped = input.replace(/[\s\u3000]+/g, "");
  return isKatakana(stripped) || isHiragana(stripped) || isJapanese(stripped);
}

// カタカナ/ひらがなをローマ字に変換（スペース区切りの各パートを個別変換）
function convertToRomaji(input: string): string {
  return input
    .split(/[\s\u3000]+/)
    .map((part) => {
      if (isKatakana(part) || isHiragana(part) || isJapanese(part)) {
        return toRomaji(part);
      }
      return part;
    })
    .join(" ");
}

// MyMemory翻訳APIで日本語→英語翻訳（カタカナ語の場合は原語に近い英語が返る）
async function translateJaToEn(input: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(input)}&langpair=ja|en`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const translated: string = data.responseData?.translatedText;
    if (!translated || translated.toLowerCase() === input.toLowerCase()) return null;
    return translated.toLowerCase();
  } catch {
    return null;
  }
}

// カタカナ由来のローマ字を英語っぽいスペルに戻す
// 例: "purabeito" → ["purabeito", "prabeit", "praveit"]
function deJapanize(romaji: string): string[] {
  const candidates = [romaji];

  let cleaned = romaji
    // 子音の後の 'u' を除去（日本語特有の母音挿入）
    .replace(/([bcdfghjklmnpqrstvwxyz])u(?=[bcdfghjklmnpqrstvwxyz]|$)/g, "$1")
    // 連続母音を1つに
    .replace(/([aeiou])\1+/g, "$1")
    // shi → sh, chi → ch, tsu → ts
    .replace(/shi/g, "sh")
    .replace(/chi/g, "ch")
    .replace(/tsu/g, "ts")
    // kyu → cu (キュ → cu: ridiculous等)
    .replace(/ky/g, "c")
    // 末尾の母音を除去（英語は子音で終わることが多い）
    .replace(/[aiuo]$/, "");

  if (cleaned !== romaji) candidates.push(cleaned);

  // b → v 置換（日本語にはv音がない）
  const withV = cleaned.replace(/b/g, "v");
  if (withV !== cleaned) candidates.push(withV);

  // f → ph 置換
  const withPh = cleaned.replace(/f/g, "ph");
  if (withPh !== cleaned) candidates.push(withPh);

  // au → aw 置換（awful等）
  const withAw = cleaned.replace(/au/g, "aw");
  if (withAw !== cleaned) candidates.push(withAw);

  // r → l 置換（日本語はr/lの区別がない）
  const withL = cleaned.replace(/r/g, "l");
  if (withL !== cleaned) candidates.push(withL);

  return [...new Set(candidates)];
}

// Datamuse APIでスペル候補を取得（複数候補を並列検索）
async function getSuggestions(candidates: string[]): Promise<DatamuseWord[]> {
  // de-japanized候補（後ろほど英語に近い）を優先するため逆順で処理
  const prioritized = [...candidates].reverse();

  const fetches = prioritized.flatMap((q) => {
    const encoded = encodeURIComponent(q);
    return [
      // sounds-like を優先（カタカナ由来では音の類似性が重要）
      fetch(`https://api.datamuse.com/words?sl=${encoded}&max=5`).then(
        (r) => (r.ok ? r.json() : [])
      ),
      fetch(`https://api.datamuse.com/words?sp=${encoded}*&max=5`).then(
        (r) => (r.ok ? r.json() : [])
      ),
    ];
  });
  const allResults: DatamuseWord[][] = await Promise.all(fetches);

  // 結果をフラットにして重複排除（先に出たものが優先）
  const seen = new Set<string>();
  const merged: DatamuseWord[] = [];
  for (const words of allResults) {
    for (const w of words) {
      if (!seen.has(w.word) && !w.word.includes(" ")) {
        seen.add(w.word);
        merged.push(w);
      }
    }
  }
  return merged.slice(0, 10);
}

// Free Dictionary APIで単語の意味を取得
async function lookupWord(word: string): Promise<DictEntry | null> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );
  if (!res.ok) return null;
  const data: DictEntry[] = await res.json();
  return data[0] || null;
}

// 英語テキストを日本語に翻訳
async function translateEnToJa(text: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ja`
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data.responseData?.translatedText || "";
  } catch {
    return "";
  }
}

// 辞書結果をWordResultに変換するヘルパー（日本語訳付き）
async function dictToResult(
  entry: DictEntry,
  suggestions: string[] = []
): Promise<WordResult> {
  // 全定義文を集めて一括翻訳（API呼び出し回数を減らす）
  const allDefs = entry.meanings.flatMap((m) =>
    m.definitions.slice(0, 3).map((d) => d.definition)
  );

  // 並列で翻訳
  const translations = await Promise.all(
    allDefs.map((def) => translateEnToJa(def))
  );

  let translationIdx = 0;
  return {
    word: entry.word,
    phonetic: entry.phonetics?.find((p) => p.text)?.text || "",
    meanings: entry.meanings.map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.slice(0, 3).map((d) => ({
        definition: d.definition,
        definitionJa: translations[translationIdx++] || "",
        example: d.example,
      })),
    })),
    suggestions,
  };
}

// 1単語を検索
async function searchSingleWord(input: string): Promise<WordResult> {
  const isJa = isJapaneseInput(input);
  const romaji = convertToRomaji(input);

  // 戦略1: 直接辞書検索（英語入力 or ローマ字がそのまま英単語の場合）
  const directResult = await lookupWord(romaji);
  if (directResult) {
    return await dictToResult(directResult);
  }

  // 戦略2: 日本語入力なら翻訳APIで英語に変換して辞書検索
  if (isJa) {
    const translated = await translateJaToEn(input);
    if (translated) {
      // 翻訳結果で直接辞書引き
      const translatedResult = await lookupWord(translated);
      if (translatedResult) {
        return dictToResult(translatedResult);
      }
      // 翻訳結果でもあいまい検索（翻訳結果はすでに英語なのでdeJapanizeせずそのまま使う）
      const translatedSuggestions = await getSuggestions([translated]);
      for (const s of translatedSuggestions.slice(0, 3)) {
        const dictResult = await lookupWord(s.word);
        if (dictResult) {
          return await dictToResult(
            dictResult,
            translatedSuggestions.filter((x) => x.word !== dictResult.word).slice(0, 5).map((x) => x.word)
          );
        }
      }
    }
  }

  // 戦略3: あいまい検索
  // 日本語入力: ローマ字をde-japanizeして候補生成
  // 英語入力: そのまま候補として使う（スペルミス対応）
  const candidates = isJa ? deJapanize(romaji) : [romaji];
  const suggestions = await getSuggestions(candidates);

  if (suggestions.length > 0) {
    // 候補を順番に辞書で引いて、最初にヒットしたものを返す
    for (const suggestion of suggestions.slice(0, 5)) {
      const dictResult = await lookupWord(suggestion.word);
      if (dictResult) {
        return await dictToResult(
          dictResult,
          suggestions
            .filter((s) => s.word !== dictResult.word)
            .slice(0, 5)
            .map((s) => s.word)
        );
      }
    }

    // どの候補も辞書にない場合、元のロジックにフォールバック
    const topResult = await lookupWord(suggestions[0].word);
    if (topResult) {
      return {
        word: topResult.word,
        phonetic: topResult.phonetics?.find((p) => p.text)?.text || "",
        meanings: topResult.meanings.map((m) => ({
          partOfSpeech: m.partOfSpeech,
          definitions: m.definitions.slice(0, 3).map((d) => ({
            definition: d.definition,
            example: d.example,
          })),
        })),
        suggestions: suggestions.slice(1).map((s) => s.word),
      };
    }
  }

  return {
    word: input,
    phonetic: "",
    meanings: [],
    suggestions: suggestions.map((s) => s.word),
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "検索ワードを入力してください" },
      { status: 400 }
    );
  }

  const tokens = query.split(/[\s\u3000]+/).filter(Boolean);

  // 複数単語の場合、まずフレーズとして一括検索を試みる
  if (tokens.length > 1) {
    const phraseResult = await searchSingleWord(query);
    if (phraseResult.meanings.length > 0) {
      return NextResponse.json({ results: [phraseResult] });
    }
  }

  // 日本語入力の場合、フレーズ全体を翻訳→翻訳結果の単語で個別検索を試みる
  // 例: "フォルトドメイン" → 翻訳 "Fault Domain" → fault, domain を個別検索
  const stripped = query.replace(/[\s\u3000]+/g, "");
  if (isJapaneseInput(stripped)) {
    const translated = await translateJaToEn(query);
    if (translated) {
      const translatedTokens = translated.split(/\s+/).filter(Boolean);
      if (translatedTokens.length >= 1) {
        // まずフレーズとして辞書検索
        const phraseDict = await lookupWord(translated);
        if (phraseDict) {
          return NextResponse.json({
            results: [await dictToResult(phraseDict)],
          });
        }
        // フレーズでなければ単語ごとに検索
        const translatedResults = await Promise.all(
          translatedTokens.map(searchSingleWord)
        );
        if (translatedResults.some((r) => r.meanings.length > 0)) {
          return NextResponse.json({ results: translatedResults });
        }
      }
    }
  }

  // フォールバック: 元の入力を単語ごとに検索
  const results = await Promise.all(tokens.map(searchSingleWord));

  return NextResponse.json({ results });
}
