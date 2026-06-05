import { SavedWord, VideoMemo } from "@/types";

const STORAGE_KEY = "nijisanji-vocab-words";

export function getSavedWords(): SavedWord[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveWords(words: SavedWord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

export function saveWord(
  word: string,
  meaning: string,
  meaningJa: string,
  phonetic: string,
  examples: string[]
): SavedWord {
  const words = getSavedWords();
  const existing = words.find(
    (w) => w.word.toLowerCase() === word.toLowerCase()
  );

  if (existing) {
    existing.searchCount += 1;
    existing.lastSearchedAt = new Date().toISOString();
    saveWords(words);
    return existing;
  }

  const newWord: SavedWord = {
    word: word.toLowerCase(),
    meaning,
    meaningJa,
    phonetic,
    examples,
    searchCount: 1,
    videoMemos: [],
    createdAt: new Date().toISOString(),
    lastSearchedAt: new Date().toISOString(),
  };
  words.push(newWord);
  saveWords(words);
  return newWord;
}

export function incrementSearchCount(word: string): SavedWord | null {
  const words = getSavedWords();
  const existing = words.find(
    (w) => w.word.toLowerCase() === word.toLowerCase()
  );
  if (!existing) return null;
  existing.searchCount += 1;
  existing.lastSearchedAt = new Date().toISOString();
  saveWords(words);
  return existing;
}

export function addVideoMemo(word: string, memo: VideoMemo): SavedWord | null {
  const words = getSavedWords();
  const existing = words.find(
    (w) => w.word.toLowerCase() === word.toLowerCase()
  );
  if (!existing) return null;
  existing.videoMemos.push(memo);
  saveWords(words);
  return existing;
}

export function removeVideoMemo(
  word: string,
  memoIndex: number
): SavedWord | null {
  const words = getSavedWords();
  const existing = words.find(
    (w) => w.word.toLowerCase() === word.toLowerCase()
  );
  if (!existing) return null;
  existing.videoMemos.splice(memoIndex, 1);
  saveWords(words);
  return existing;
}

export function deleteWord(word: string): void {
  const words = getSavedWords();
  const filtered = words.filter(
    (w) => w.word.toLowerCase() !== word.toLowerCase()
  );
  saveWords(filtered);
}

// 全単語から配信者名の一覧を取得（重複なし）
export function getAllStreamers(): string[] {
  const words = getSavedWords();
  const set = new Set<string>();
  for (const w of words) {
    for (const v of w.videoMemos) {
      if (v.streamer) set.add(v.streamer);
    }
  }
  return [...set].sort();
}

// 単語に紐づいている配信者名の一覧を取得
export function getStreamersForWord(word: SavedWord): string[] {
  const set = new Set<string>();
  for (const v of word.videoMemos) {
    if (v.streamer) set.add(v.streamer);
  }
  return [...set];
}
