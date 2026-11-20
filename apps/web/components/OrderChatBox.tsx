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
    <section aria-label="Chat với freelancer" className="card flex flex-col !p-0 shadow-l2">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="material-symbols-outlined text-emerald" aria-hidden>chat</span>
        <h2 className="font-display text-base font-bold text-ink">Chat {coderName ? `với ${coderName}` : 'đơn hàng'}</h2>
      </div>
      <div className="h-64 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Tin nhắn" tabIndex={0}>
        {messages.map((m) =>
          m.sender === 'SYSTEM' ? (
            <p key={m.id} className="mx-auto w-fit max-w-full rounded-full bg-slate-100 px-3 py-1 text-center text-xs text-slate-700">{m.text}</p>
          ) : (
            <div key={m.id} className={`flex flex-col ${m.sender === 'CUSTOMER' ? 'items-end' : 'items-start'} animate-pop`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.sender === 'CUSTOMER' ? 'rounded-br-sm bg-brand-strong text-white' : 'rounded-bl-sm bg-slate-100 text-ink'}`}>
                {m.text}
              </div>
              <span className="mt-0.5 text-xs text-slate-500">{m.senderName} • {formatTime(m.timestamp)}</span>
            </div>
          )
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-slate-100 p-3">
        <label htmlFor="chat-input" className="sr-only">Nhập tin nhắn</label>
        <input id="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhắn cho freelancer..." className="min-w-0 flex-1 rounded-full px-4 py-2" />
        <button type="submit" className="btn-primary min-h-[44px] min-w-[44px] !px-4 !py-2" aria-label="Gửi tin nhắn" disabled={!text.trim()}>
          <span className="material-symbols-outlined !text-[18px]" aria-hidden>send</span>
        </button>
      </form>
    </section>
  );
}
