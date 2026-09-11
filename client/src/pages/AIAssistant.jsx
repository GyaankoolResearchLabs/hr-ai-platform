import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { aiService } from "../services/aiService";

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "I'm the HR AI Platform assistant. Ask me about HR tools, policies, or processes — recruitment, onboarding, performance, attendance, leave, payroll, compliance, and more. I answer from general HR knowledge; I'm not yet grounded in this organization's specific data.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const prompt = input.trim();
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await aiService.ask(prompt);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "I couldn't reach the AI service. Please make sure the backend is running.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-950">AI Assistant</h1>
          <p className="text-sm text-ink-500">
            General HR Q&A, powered by OpenAI — routes through <code className="text-xs">services/aiService.js</code>
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-ink-100 bg-surface p-5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-lg rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-brand-800 text-white"
                  : "bg-canvas text-ink-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl bg-canvas px-4 py-2.5 text-sm text-ink-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="mt-4 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about an HR tool, policy, or process…"
          className="flex-1 rounded-lg border border-ink-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
