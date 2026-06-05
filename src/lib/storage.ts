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

// エクスポート: 単語帳データをJSONファイルとしてダウンロード
export function exportWords(): void {
  const words = getSavedWords();
  const json = JSON.stringify(words, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nijivocab-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// インポート: JSONファイルから単語帳データを読み込み（重複は統合）
export function importWords(data: SavedWord[]): { added: number; updated: number } {
  const existing = getSavedWords();
  let added = 0;
  let updated = 0;

  for (const incoming of data) {
    const match = existing.find(
      (w) => w.word.toLowerCase() === incoming.word.toLowerCase()
    );
    if (match) {
      // 検索回数は大きい方を採用
      if (incoming.searchCount > match.searchCount) {
        match.searchCount = incoming.searchCount;
      }
      // 動画メモは重複しないものを追加
      for (const memo of incoming.videoMemos) {
        const duplicate = match.videoMemos.some(
          (m) => m.url === memo.url && m.streamer === memo.streamer && m.note === memo.note
        );
        if (!duplicate) {
          match.videoMemos.push(memo);
        }
      }
      // 意味が空なら上書き
      if (!match.meaningJa && incoming.meaningJa) {
        match.meaningJa = incoming.meaningJa;
      }
      updated++;
    } else {
      existing.push(incoming);
      added++;
    }
  }

  saveWords(existing);
  return { added, updated };
}
