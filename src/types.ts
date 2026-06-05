export interface VideoMemo {
  url: string;
  note: string;
  streamer: string;
  addedAt: string;
}

export interface SavedWord {
  word: string;
  meaning: string;
  meaningJa: string;
  phonetic: string;
  examples: string[];
  searchCount: number;
  videoMemos: VideoMemo[];
  createdAt: string;
  lastSearchedAt: string;
}

export interface WordResult {
  word: string;
  phonetic: string;
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; definitionJa?: string; example?: string }[];
  }[];
  suggestions: string[];
}
