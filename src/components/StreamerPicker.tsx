"use client";

import { useState } from "react";

interface StreamerPickerProps {
  value: string;
  onChange: (value: string) => void;
  streamers: string[];
  className?: string;
}

export default function StreamerPicker({
  value,
  onChange,
  streamers,
  className = "",
}: StreamerPickerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  // 選択済み → タグとして表示 + 変更用プルダウン
  if (value) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-lg">
            {value}
            <button
              onClick={() => onChange("")}
              className="text-purple-400 hover:text-purple-700 ml-0.5"
            >
              x
            </button>
          </span>
        </div>
      </div>
    );
  }

  // 新規入力モード
  if (isAdding) {
    return (
      <div className={`flex gap-1.5 ${className}`}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="配信者名を入力"
          autoFocus
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && newName.trim()) {
              onChange(newName.trim());
              setNewName("");
              setIsAdding(false);
            }
          }}
        />
        <button
          onClick={() => {
            if (newName.trim()) {
              onChange(newName.trim());
              setNewName("");
              setIsAdding(false);
            }
          }}
          className="text-xs bg-indigo-600 text-white px-2.5 py-2 rounded-lg hover:bg-indigo-500 transition-colors font-medium"
        >
          決定
        </button>
        <button
          onClick={() => {
            setIsAdding(false);
            setNewName("");
          }}
          className="text-xs text-gray-400 px-2 py-2"
        >
          戻る
        </button>
      </div>
    );
  }

  // プルダウン（未選択時）
  return (
    <div className={className}>
      <select
        value=""
        onChange={(e) => {
          if (e.target.value === "__add_new__") {
            setIsAdding(true);
          } else {
            onChange(e.target.value);
          }
        }}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-400 appearance-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
          paddingRight: "24px",
        }}
      >
        <option value="">配信者を選択...</option>
        {streamers.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
        <option value="__add_new__">+ 新しく追加</option>
      </select>
    </div>
  );
}
