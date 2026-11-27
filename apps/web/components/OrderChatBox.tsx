'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@grabcode/contracts';
import { formatTime } from '../lib/orderView';

export default function OrderChatBox({ messages, onSend, coderName }: { messages: ChatMessage[]; onSend: (text: string) => void; coderName?: string }) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = endRef.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <section aria-labelledby="chat-title" className="card flex flex-col p-0!">
      <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
        <span className="material-symbols-outlined text-brand-700" aria-hidden>chat</span>
        <h2 id="chat-title" className="font-display text-base font-bold text-stone-900">Chat {coderName ? `với ${coderName}` : 'đơn hàng'}</h2>
      </div>
      <div className="h-80 space-y-3 overflow-y-auto p-4 md:h-96" role="log" aria-live="polite" aria-label="Tin nhắn" tabIndex={0}>
        {messages.map((m) =>
          m.sender === 'SYSTEM' ? (
            <p key={m.id} className="chip-neutral mx-auto h-auto w-fit max-w-full whitespace-normal rounded-xl py-1 text-center font-sans font-normal">{m.text}</p>
          ) : (
            <div key={m.id} className={`flex flex-col ${m.sender === 'CUSTOMER' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap wrap-break-word rounded-2xl px-3 py-2 text-sm ${m.sender === 'CUSTOMER' ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md bg-stone-100 text-stone-900'}`}>
                {m.text}
              </div>
              <span className="mt-0.5 text-xs text-stone-600">{m.senderName} · {formatTime(m.timestamp)}</span>
            </div>
          )
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-stone-200 p-3">
        <label htmlFor="chat-input" className="sr-only">Nhập tin nhắn</label>
        <input id="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhắn cho freelancer..." className="field min-w-0 flex-1 rounded-full!" />
        <button type="submit" className="btn-primary min-h-[48px]! w-12 shrink-0 px-0!" aria-label="Gửi tin nhắn" disabled={!text.trim()}>
          <span className="material-symbols-outlined text-[20px]!" aria-hidden>send</span>
        </button>
      </form>
    </section>
  );
}
