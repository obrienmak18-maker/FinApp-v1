import React, { useState, useRef, useEffect } from 'react';
import { sendMessage, Message } from '../services/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Info, Send, Volume2, VolumeX, MessageSquare } from 'lucide-react';
import InfoModal from '../components/InfoModal';

const QUICK_PROMPTS = [
  'Quel est mon solde actuel ?',
  'Mes dépenses ce mois ?',
  'Comment mieux économiser ?',
  'Analyse mes finances',
];

function useTypewriter(text: string, active: boolean, speed = 35) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) { setDisplayed(text); setDone(true); return; }
    setDisplayed(''); setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) { clearInterval(interval); setDone(true); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, active, speed]);
  return { displayed, done };
}

function ChatBubble({ msg, isLast }: { msg: Message; isLast: boolean }) {
  const isUser = msg.role === 'user';
  const { displayed, done } = useTypewriter(msg.content, !isUser && isLast);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} data-testid={`msg-${msg.role}`}>
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-sm'
          : 'bg-card/80 border border-card-border text-foreground rounded-bl-sm backdrop-blur-sm'
      }`}>
        {isUser ? msg.content : (
          <>
            {displayed}
            {!done && <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-middle" />}
          </>
        )}
      </div>
    </div>
  );
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(navigator.onLine);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const hasGeminiKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY);
  const aiStatusLabel = onlineStatus && hasGeminiKey
    ? 'En ligne — Gemini activé'
    : 'Hors ligne ou API indisponible — Analyse locale';

  const speak = (text: string) => {
    if (muted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'fr-FR';
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const reply = await sendMessage(messages, text);
      const aiMsg: Message = { role: 'assistant', content: reply };
      setMessages(prev => [...prev, aiMsg]);
      speak(reply);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur s'est produite. Réessayez." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen animate-fadeUp">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-card-border bg-card/30 backdrop-blur-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Assistant IA</h1>
          <p className="text-xs text-muted-foreground">{navigator.onLine ? 'En ligne — Gemini activé' : 'Hors ligne — Analyse locale'}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setMuted(m => !m)} data-testid="btn-mute">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowInfo(true)} data-testid="btn-info">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center animate-float">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Bonjour ! Comment puis-je vous aider ?</h2>
              <p className="text-sm text-muted-foreground mt-1">Posez-moi une question sur vos finances</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="p-3 rounded-xl bg-card/60 border border-card-border text-sm text-left hover:bg-card hover:border-primary/50 transition-all active:scale-95"
                  data-testid={`quick-prompt-${QUICK_PROMPTS.indexOf(p)}`}
                >{p}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} isLast={i === messages.length - 1} />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-card/80 border border-card-border px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-card-border bg-card/30 backdrop-blur-sm">
        <form
          onSubmit={e => { e.preventDefault(); send(input); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Posez votre question..."
            disabled={loading}
            className="flex-1"
            data-testid="input-chat"
          />
          <Button type="submit" disabled={!input.trim() || loading} size="icon" data-testid="btn-send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} title="Assistant IA" description="Posez des questions sur vos finances en français. L'IA analyse vos données localement ou utilise Gemini si vous êtes en ligne." />
    </div>
  );
}
