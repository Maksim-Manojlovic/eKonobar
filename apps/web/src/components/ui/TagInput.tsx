"use client";

import { useState } from "react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function TagInput({ tags, onChange, placeholder }: TagInputProps) {
  const [input, setInput] = useState("");

  const add = (val: string) => {
    const v = val.trim().toLowerCase();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };

  const remove = (tag: string) => onChange(tags.filter(t => t !== tag));

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
    if (e.key === "Backspace" && input === "" && tags.length > 0) remove(tags[tags.length - 1]);
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-neutral-200 rounded-xl min-h-[42px] focus-within:border-orange-400 transition-colors cursor-text">
      {tags.map(t => (
        <span key={t} className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 font-medium px-2 py-0.5 rounded-full">
          {t}
          <button type="button" onClick={() => remove(t)} className="hover:text-orange-900 leading-none font-bold">&times;</button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (input) add(input); }}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[140px] text-sm outline-none bg-transparent"
      />
    </div>
  );
}
