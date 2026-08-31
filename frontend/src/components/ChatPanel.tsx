import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { ChatMessage } from '../types';

type Props = {
  messages: ChatMessage[];
  onSend: (content: string) => void;
};

export function ChatPanel({ messages, onSend }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const trimmedDraft = draft.trim();
  const canSend = trimmedDraft.length > 0;

  const sendDraft = () => {
    if (!canSend) return;
    onSend(trimmedDraft);
    setDraft('');
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendDraft();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendDraft();
    }
  };

  return (
    <div className="flex h-[min(480px,60vh)] min-h-[280px] flex-col rounded-xl border border-slate-800 bg-slate-900/80">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        <span>Chat</span>
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-xs"
      >
        {messages.length === 0 && (
          <p className="text-center text-slate-500">No messages yet. Say hello 👋</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-100">{m.senderName}</span>
              <span className="text-[10px] text-slate-500">
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-800/80 px-2 py-1 text-slate-100">
              {m.content}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-slate-800 bg-slate-900/80 p-2"
      >
        <div className="flex items-end gap-2">
          <textarea
            name="message"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            className="min-h-[44px] flex-1 resize-none rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={!canSend}
            title="Send message"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-slate-50 shadow-sm transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="sr-only">Send</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
