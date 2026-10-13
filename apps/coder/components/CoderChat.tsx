'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@grabcode/contracts';

export default function CoderChat({
  messages,
  onSend,
  disabled,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="material-symbols-outlined text-emerald">chat</span>
        <h3 className="font-display text-sm font-bold">Chat với khách hàng</h3>
      </div>
      <div ref={box} className="flex max-h-56 min-h-[96px] flex-col gap-2 overflow-y-auto bg-surface-container-low p-3">
        {messages.length === 0 && <p className="m-auto text-sm text-slate-400">Chưa có tin nhắn.</p>}
        {messages.map((m) => {
          const mine = m.sender === 'CODER';
          if (m.sender === 'SYSTEM')
            return (
              <p key={m.id} className="self-center rounded-full bg-white px-3 py-1 text-xs text-slate-500">
                {m.text}
              </p>
            );
          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                mine ? 'self-end bg-emerald text-white' : 'self-start bg-white text-ink shadow-l2'
              }`}
            >
              {!mine && <p className="text-[11px] font-semibold text-slate-500">{m.senderName}</p>}
              {m.text}
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="flex gap-2 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder="Nhắn cho khách…"
          className="min-h-[48px] flex-1 px-4"
        />
        <button type="submit" disabled={disabled || !text.trim()} className="btn-primary !min-h-[48px] !px-4" aria-label="Gửi">
          <span className="material-symbols-outlined">send</span>
        </button>
      </form>
    </div>
  );
}
