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
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
        <span className="material-symbols-outlined text-brand-700" aria-hidden>chat</span>
        <h3 className="font-display text-sm font-bold">Chat với khách hàng</h3>
      </div>
      <div ref={box} className="flex max-h-56 min-h-[96px] flex-col gap-2 overflow-y-auto bg-stone-50 p-3">
        {messages.length === 0 && <p className="m-auto text-sm text-stone-500">Chưa có tin nhắn.</p>}
        {messages.map((m) => {
          const mine = m.sender === 'CODER';
          if (m.sender === 'SYSTEM')
            return (
              <p key={m.id} className="self-center chip-neutral">
                {m.text}
              </p>
            );
          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                mine ? 'self-end bg-brand-700 text-white' : 'self-start border border-stone-200 bg-white text-stone-900'
              }`}
            >
              {!mine && <p className="text-xs font-semibold text-stone-600">{m.senderName}</p>}
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
          className="field flex-1"
        />
        <button type="submit" disabled={disabled || !text.trim()} className="btn-primary !px-4" aria-label="Gửi">
          <span className="material-symbols-outlined" aria-hidden>send</span>
        </button>
      </form>
    </div>
  );
}
