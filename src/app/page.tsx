"use client";

import { useState, useEffect, useCallback } from "react";
import { SavedWord, WordResult } from "@/types";
import {
  getSavedWords,
  saveWord,
  incrementSearchCount,
  addVideoMemo,
  removeVideoMemo,
  deleteWord,
  getAllStreamers,
  getStreamersForWord,
} from "@/lib/storage";
import StreamerPicker from "@/components/StreamerPicker";

type Tab = "search" | "wordbook";
type SortKey = "searchCount" | "lastSearchedAt" | "createdAt";

export default function Home() {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchingQuery, setSearchingQuery] = useState("");
  const [results, setResults] = useState<WordResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("searchCount");
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [videoNotes, setVideoNotes] = useState<Record<string, string>>({});
  const [videoStreamers, setVideoStreamers] = useState<Record<string, string>>({});
  const [saveMessages, setSaveMessages] = useState<Record<string, string>>({});
  const [searchVideoUrl, setSearchVideoUrl] = useState("");
  const [searchVideoNote, setSearchVideoNote] = useState("");
  const [searchVideoStreamer, setSearchVideoStreamer] = useState("");
  const [customWord, setCustomWord] = useState("");
  const [customMeaning, setCustomMeaning] = useState("");
  const [customSaveMessage, setCustomSaveMessage] = useState("");
  const [wordbookSearch, setWordbookSearch] = useState("");
  const [streamerFilter, setStreamerFilter] = useState<string | null>(null);
  const [streamers, setStreamers] = useState<string[]>([]);

  useEffect(() => {
    setSavedWords(getSavedWords());
    setStreamers(getAllStreamers());
    // Service Worker登録
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  const refreshWords = useCallback(() => {
    setSavedWords(getSavedWords());
    setStreamers(getAllStreamers());
  }, []);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    setLoading(true);
    setSearchingQuery(q.trim());
    setResults([]);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (word: string) => {
    setQuery(word);
    handleSearch(word);
  };

  const handleSave = (wordResult: WordResult) => {
    const meaningsEn = wordResult.meanings
      .map(
        (m) =>
          `[${m.partOfSpeech}] ${m.definitions.map((d) => d.definition).join("; ")}`
      )
      .join("\n");
    const meaningsJa = wordResult.meanings
      .map(
        (m) =>
          `[${m.partOfSpeech}] ${m.definitions.map((d) => d.definitionJa || d.definition).join("; ")}`
      )
      .join("\n");
    const examples = wordResult.meanings
      .flatMap((m) => m.definitions.map((d) => d.example).filter(Boolean))
      .slice(0, 3) as string[];

    const saved = saveWord(wordResult.word, meaningsEn, meaningsJa, wordResult.phonetic, examples);

    if (searchVideoUrl.trim() || searchVideoStreamer.trim()) {
      addVideoMemo(saved.word, {
        url: searchVideoUrl.trim(),
        note: searchVideoNote.trim(),
        streamer: searchVideoStreamer.trim(),
        addedAt: new Date().toISOString(),
      });
      setSearchVideoUrl("");
      setSearchVideoNote("");
      setSearchVideoStreamer("");
    }

    refreshWords();
    setSaveMessages((prev) => ({ ...prev, [wordResult.word]: "保存しました！" }));
    setTimeout(() => {
      setSaveMessages((prev) => {
        const next = { ...prev };
        delete next[wordResult.word];
        return next;
      });
    }, 2000);
  };

  const handleCustomSave = () => {
    const word = customWord.trim() || query.trim();
    const meaning = customMeaning.trim();
    if (!word || !meaning) return;

    const saved = saveWord(word, meaning, meaning, "", []);

    if (searchVideoUrl.trim() || searchVideoStreamer.trim()) {
      addVideoMemo(saved.word, {
        url: searchVideoUrl.trim(),
        note: searchVideoNote.trim(),
        streamer: searchVideoStreamer.trim(),
        addedAt: new Date().toISOString(),
      });
      setSearchVideoUrl("");
      setSearchVideoNote("");
      setSearchVideoStreamer("");
    }

    refreshWords();
    setCustomWord("");
    setCustomMeaning("");
    setCustomSaveMessage("保存しました！");
    setTimeout(() => setCustomSaveMessage(""), 2000);
  };

  const handleReSearch = (word: string) => {
    incrementSearchCount(word);
    refreshWords();
    setQuery(word);
    setTab("search");
    handleSearch(word);
  };

  const handleAddVideo = (word: string) => {
    const url = videoUrls[word]?.trim() || "";
    const streamer = videoStreamers[word]?.trim() || "";
    if (!url && !streamer) return;
    addVideoMemo(word, {
      url,
      note: videoNotes[word]?.trim() || "",
      streamer,
      addedAt: new Date().toISOString(),
    });
    setVideoUrls((prev) => ({ ...prev, [word]: "" }));
    setVideoNotes((prev) => ({ ...prev, [word]: "" }));
    setVideoStreamers((prev) => ({ ...prev, [word]: "" }));
    refreshWords();
  };

  const handleRemoveVideo = (word: string, index: number) => {
    removeVideoMemo(word, index);
    refreshWords();
  };

  const handleDelete = (word: string) => {
    deleteWord(word);
    refreshWords();
    setExpandedWord(null);
  };

  const filteredAndSortedWords = [...savedWords]
    .filter((w) => {
      // テキスト検索
      if (wordbookSearch.trim()) {
        const q = wordbookSearch.trim().toLowerCase();
        const matchWord = w.word.toLowerCase().includes(q);
        const matchMeaning = w.meaning.toLowerCase().includes(q);
        const matchMeaningJa = w.meaningJa?.toLowerCase().includes(q);
        if (!matchWord && !matchMeaning && !matchMeaningJa) return false;
      }
      // 配信者フィルタ
      if (streamerFilter) {
        const wordStreamers = getStreamersForWord(w);
        if (!wordStreamers.includes(streamerFilter)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "searchCount") return b.searchCount - a.searchCount;
      return new Date(b[sortKey]).getTime() - new Date(a[sortKey]).getTime();
    });

  const isWordSaved = (word: string) =>
    savedWords.some((w) => w.word.toLowerCase() === word.toLowerCase());

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-indigo-50 to-white">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-indigo-100 px-4 py-4 text-center sticky top-0 z-10">
        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
          NijiVocab
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          にじさんじENで英語を覚えよう
        </p>
      </header>

      {/* タブ */}
      <div className="flex mx-4 mt-3 bg-gray-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => setTab("search")}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            tab === "search"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-gray-400 hover:text-gray-500"
          }`}
        >
          検索
        </button>
        <button
          onClick={() => setTab("wordbook")}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all relative ${
            tab === "wordbook"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-gray-400 hover:text-gray-500"
          }`}
        >
          単語帳
          {savedWords.length > 0 && (
            <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">
              {savedWords.length}
            </span>
          )}
        </button>
      </div>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4 space-y-4">
        {tab === "search" && (
          <>
            {/* 検索バー */}
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSearch();
                }}
                placeholder="英語・カタカナ・ひらがなOK"
                disabled={loading}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm disabled:opacity-50"
              />
              <button
                onClick={() => handleSearch()}
                disabled={loading || !query.trim()}
                className={`px-5 py-3 rounded-xl font-bold transition-all shadow-sm min-w-[72px] ${
                  loading
                    ? "bg-amber-500 text-white animate-pulse"
                    : "bg-indigo-600 text-white disabled:opacity-30 hover:bg-indigo-500"
                }`}
              >
                {loading ? "検索中" : "検索"}
              </button>
            </div>

            {!loading && (
              <p className="text-xs text-gray-400 px-1">
                複数単語OK！例: プライベイト インベスティゲーター
              </p>
            )}

            {/* 動画URL（検索時に一緒に保存できる） */}
            <details className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <summary className="px-4 py-2.5 text-xs font-medium text-gray-500 cursor-pointer select-none">
                どの動画で聞いた？（タップして開く）
              </summary>
              <div className="px-4 pb-3 space-y-2">
                <StreamerPicker
                  value={searchVideoStreamer}
                  onChange={setSearchVideoStreamer}
                  streamers={streamers}
                />
                <input
                  type="url"
                  value={searchVideoUrl}
                  onChange={(e) => setSearchVideoUrl(e.target.value)}
                  placeholder="動画URL（任意）"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <input
                  type="text"
                  value={searchVideoNote}
                  onChange={(e) => setSearchVideoNote(e.target.value)}
                  placeholder="メモ（例: 雑談配信で）"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </details>

            {/* ローディング */}
            {loading && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50">
                  <p className="text-sm font-bold text-indigo-600">
                    「{searchingQuery}」を検索中...
                  </p>
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="h-3 bg-gray-100 rounded-full w-3/4 animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded-full w-1/2 animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded-full w-5/6 animate-pulse" />
                </div>
              </div>
            )}

            {/* 検索結果 */}
            {!loading &&
              results.map((wordResult, idx) => (
                <div
                  key={`${wordResult.word}-${idx}`}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  {/* 単語ヘッダー */}
                  <div className="p-4 pb-2 bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-2xl font-black text-gray-800">
                        {wordResult.word}
                      </h2>
                      {wordResult.phonetic && (
                        <span className="text-sm text-indigo-500">
                          {wordResult.phonetic}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 意味 */}
                  {wordResult.meanings.length > 0 ? (
                    <div className="px-4 pb-3 space-y-3 pt-2">
                      {wordResult.meanings.map((meaning, i) => (
                        <div key={i}>
                          <span className="inline-block text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md mb-1.5">
                            {meaning.partOfSpeech}
                          </span>
                          {meaning.definitions.map((def, j) => (
                            <div key={j} className="pl-1 py-1 border-l-2 border-indigo-100 ml-1 mb-1.5">
                              <p className="text-sm text-gray-700 pl-2">
                                {def.definition}
                              </p>
                              {def.definitionJa && (
                                <p className="text-sm text-indigo-600 font-medium pl-2 mt-0.5">
                                  {def.definitionJa}
                                </p>
                              )}
                              {def.example && (
                                <p className="text-xs text-gray-400 italic pl-2 mt-0.5">
                                  &quot;{def.example}&quot;
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 pb-3 pt-2">
                      <p className="text-sm text-gray-400">
                        意味が見つかりませんでした
                      </p>
                    </div>
                  )}

                  {/* もしかして候補 */}
                  {wordResult.suggestions.length > 0 && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-gray-400 mb-1.5">
                        もしかして:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {wordResult.suggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => handleSuggestionClick(s)}
                            className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 保存ボタン */}
                  {wordResult.meanings.length > 0 && (
                    <div className="px-4 pb-4">
                      {saveMessages[wordResult.word] ? (
                        <div className="w-full py-2.5 rounded-xl text-center text-sm font-bold text-green-600 bg-green-50 border border-green-200">
                          {saveMessages[wordResult.word]}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSave(wordResult)}
                          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                            isWordSaved(wordResult.word)
                              ? "bg-gray-100 text-gray-400 border border-gray-200"
                              : "bg-indigo-600 text-white shadow-md hover:bg-indigo-500"
                          }`}
                        >
                          {isWordSaved(wordResult.word)
                            ? "保存済み（もう一度保存で回数+1）"
                            : "単語帳に保存する"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

            {/* 自分でメモして保存 */}
            {!loading && searched && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 pb-2 bg-gradient-to-r from-amber-50 to-orange-50">
                  <p className="text-sm font-bold text-amber-700">
                    自分でメモして保存
                  </p>
                  <p className="text-xs text-amber-600/60 mt-0.5">
                    辞書にない単語や、自分なりの意味を残したいときに
                  </p>
                </div>
                <div className="px-4 pb-4 pt-3 space-y-2">
                  <input
                    type="text"
                    value={customWord}
                    onChange={(e) => setCustomWord(e.target.value)}
                    placeholder={query.trim() || "単語やフレーズ"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) e.currentTarget.blur();
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <textarea
                    value={customMeaning}
                    onChange={(e) => setCustomMeaning(e.target.value)}
                    placeholder="意味やメモを入力"
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                  />
                  {customSaveMessage ? (
                    <div className="w-full py-2.5 rounded-xl text-center text-sm font-bold text-green-600 bg-green-50 border border-green-200">
                      {customSaveMessage}
                    </div>
                  ) : (
                    <button
                      onClick={handleCustomSave}
                      disabled={!customMeaning.trim()}
                      className="w-full py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white shadow-md hover:bg-amber-400 transition-all disabled:opacity-30"
                    >
                      単語帳に保存する
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "wordbook" && (
          <div className="space-y-3">
            {savedWords.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-lg text-gray-400 mb-1">
                  まだ単語がありません
                </p>
                <p className="text-sm text-gray-300">
                  検索タブで単語を調べて保存してみましょう！
                </p>
              </div>
            ) : (
              <>
                {/* 検索バー */}
                <input
                  type="text"
                  value={wordbookSearch}
                  onChange={(e) => setWordbookSearch(e.target.value)}
                  placeholder="単語帳を検索..."
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm"
                />

                {/* 配信者フィルタ */}
                {streamers.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setStreamerFilter(null)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        streamerFilter === null
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-gray-100 text-gray-500 hover:text-gray-600"
                      }`}
                    >
                      全員
                    </button>
                    {streamers.map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setStreamerFilter(streamerFilter === s ? null : s)
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          streamerFilter === s
                            ? "bg-purple-600 text-white shadow-sm"
                            : "bg-purple-50 text-purple-600 hover:bg-purple-100"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* ソート */}
                <div className="flex gap-1.5">
                  {(
                    [
                      ["searchCount", "検索回数順"],
                      ["lastSearchedAt", "最近調べた順"],
                      ["createdAt", "追加日順"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSortKey(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        sortKey === key
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-gray-100 text-gray-500 hover:text-gray-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* 件数表示 */}
                {(wordbookSearch || streamerFilter) && (
                  <p className="text-xs text-gray-400">
                    {filteredAndSortedWords.length}件ヒット
                  </p>
                )}

                {/* 単語リスト */}
                {filteredAndSortedWords.map((w) => (
                  <div
                    key={w.word}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedWord(expandedWord === w.word ? null : w.word)
                      }
                      className="w-full text-left p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-gray-800 text-lg">
                          {w.word}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            w.searchCount >= 5
                              ? "bg-red-100 text-red-600"
                              : w.searchCount >= 3
                                ? "bg-orange-100 text-orange-600"
                                : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          x{w.searchCount}
                        </span>
                        {getStreamersForWord(w).map((s) => (
                          <span
                            key={s}
                            className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-md font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <span className="text-gray-300 text-xs">
                        {expandedWord === w.word ? "▲" : "▼"}
                      </span>
                    </button>

                    {expandedWord === w.word && (
                      <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                        {/* 意味 */}
                        <div className="pt-3">
                          {w.phonetic && (
                            <p className="text-xs text-indigo-500 mb-1">
                              {w.phonetic}
                            </p>
                          )}
                          <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                            {w.meaning}
                          </p>
                          {w.meaningJa && w.meaningJa !== w.meaning && (
                            <p className="text-sm text-indigo-600 font-medium whitespace-pre-line leading-relaxed mt-1.5 pt-1.5 border-t border-indigo-100">
                              {w.meaningJa}
                            </p>
                          )}
                          {w.examples.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {w.examples.map((ex, i) => (
                                <p
                                  key={i}
                                  className="text-xs text-gray-400 italic"
                                >
                                  &quot;{ex}&quot;
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 動画メモ */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            動画メモ
                          </p>
                          {w.videoMemos.length > 0 &&
                            w.videoMemos.map((v, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 bg-gray-50 rounded-xl p-2.5"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    {v.streamer && (
                                      <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-md font-medium">
                                        {v.streamer}
                                      </span>
                                    )}
                                    {v.note && (
                                      <span className="text-xs text-gray-400">
                                        {v.note}
                                      </span>
                                    )}
                                  </div>
                                  {v.url && (
                                    <a
                                      href={v.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-indigo-600 underline break-all hover:text-indigo-500"
                                    >
                                      {v.url}
                                    </a>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRemoveVideo(w.word, i)}
                                  className="text-xs text-red-300 hover:text-red-500 shrink-0"
                                >
                                  x
                                </button>
                              </div>
                            ))}

                          <div className="space-y-1.5">
                            <StreamerPicker
                              value={videoStreamers[w.word] || ""}
                              onChange={(val) =>
                                setVideoStreamers((prev) => ({
                                  ...prev,
                                  [w.word]: val,
                                }))
                              }
                              streamers={streamers}
                            />
                            <input
                              type="url"
                              value={videoUrls[w.word] || ""}
                              onChange={(e) =>
                                setVideoUrls((prev) => ({
                                  ...prev,
                                  [w.word]: e.target.value,
                                }))
                              }
                              placeholder="動画URL（任意）"
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={videoNotes[w.word] || ""}
                                onChange={(e) =>
                                  setVideoNotes((prev) => ({
                                    ...prev,
                                    [w.word]: e.target.value,
                                  }))
                                }
                                placeholder="メモ（任意）"
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              />
                              <button
                                onClick={() => handleAddVideo(w.word)}
                                className="text-xs bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-500 transition-colors font-medium"
                              >
                                追加
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* アクション */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleReSearch(w.word)}
                            className="flex-1 text-xs text-indigo-600 border border-indigo-200 rounded-xl py-2 hover:bg-indigo-50 transition-colors font-medium"
                          >
                            もう一度調べる
                          </button>
                          <button
                            onClick={() => handleDelete(w.word)}
                            className="text-xs text-red-400 border border-red-200 rounded-xl px-3 py-2 hover:bg-red-50 transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
