import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  ArrowLeft,
  Bot,
  Send,
  User,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const suggestedQuestions = [
  "What is the process for requesting leave?",
  "What documents are normally required during onboarding?",
  "How should an employee request a salary-related clarification?",
  "What should an employee do if they have an attendance issue?",
];

export default function AIHRHelpdesk() {
  const navigate = useNavigate();
  const { session, organization } = useAuth();

  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello. I’m your AI HR Helpdesk. Ask me an HR-related question and I’ll provide a practical answer based on the information available to the platform.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  const sendMessage = async (question = input) => {
    const prompt = question.trim();

    if (!prompt || loading) {
      return;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setInput("");
    setLoading(true);

    try {
      const accessToken =
        session?.access_token;

      if (!accessToken) {
        throw new Error(
          "Your authentication session has expired. Please sign in again."
        );
      }

      const response = await axios.post(
        `${API_BASE_URL}/ai/assistant`,
        {
          prompt,

          context: {
            categoryId: "employee-support",

            organization: organization
              ? {
                  id: organization.id,
                  name: organization.name,
                  industry:
                    organization.industry,
                  size: organization.size,
                }
              : null,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const reply =
        response?.data?.reply ||
        "I couldn't generate a response.";

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply,
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);
    } catch (error) {
      console.error(
        "[AI HR Helpdesk] Request failed:",
        error
      );

      let message =
        "The HR Helpdesk is temporarily unavailable. Please try again.";

      if (
        error?.response?.status === 401
      ) {
        message =
          "Your session has expired. Please sign in again.";
      } else if (
        error?.response?.data?.message
      ) {
        message =
          error.response.data.message;
      } else if (error?.message) {
        message = error.message;
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: message,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  const handleSuggestion = (question) => {
    sendMessage(question);
  };

  const clearConversation = () => {
    setMessages([
      {
        id: "welcome-reset",
        role: "assistant",
        content:
          "Conversation cleared. What HR question can I help you with?",
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">

        {/* HEADER */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-4 flex items-center gap-2 text-sm text-ink-500 transition hover:text-ink-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Bot className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-ink-900">
                  AI HR Helpdesk
                </h1>

                <p className="mt-1 text-sm text-ink-500">
                  Instant, policy-grounded answers for employees.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={clearConversation}
            className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
          >
            <RotateCcw className="h-4 w-4" />
            Clear
          </button>
        </div>

        {/* ORGANIZATION CONTEXT */}
        {organization && (
          <div className="mb-5 rounded-xl border border-ink-100 bg-white px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
              Organization
            </div>

            <div className="mt-1 text-sm font-medium text-ink-800">
              {organization.name}
            </div>
          </div>
        )}

        {/* MAIN CHAT */}
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">

          {/* CHAT AREA */}
          <div className="min-h-[520px] max-h-[620px] overflow-y-auto p-6">

            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-6 flex gap-3 ${
                  message.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-brand-700 text-white"
                      : message.error
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "bg-ink-50 text-ink-700"
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {message.content}
                  </div>
                </div>

                {message.role === "user" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {/* LOADING */}
            {loading && (
              <div className="mb-6 flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Bot className="h-4 w-4" />
                </div>

                <div className="rounded-2xl bg-ink-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-ink-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* SUGGESTIONS */}
          <div className="border-t border-ink-100 px-6 py-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-400">
              Suggested questions
            </p>

            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map(
                (question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleSuggestion(
                        question
                      )
                    }
                    className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-left text-xs text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {question}
                  </button>
                )
              )}
            </div>
          </div>

          {/* INPUT */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-ink-100 p-4"
          >
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    handleSubmit(event);
                  }
                }}
                placeholder="Ask an HR question..."
                rows={2}
                disabled={loading}
                className="min-h-[52px] flex-1 resize-none rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-800 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50"
              />

              <button
                type="submit"
                disabled={
                  loading ||
                  !input.trim()
                }
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
                title="Send question"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>

            <p className="mt-2 text-xs text-ink-400">
              AI responses should be reviewed against your organization's actual HR policies before making high-impact decisions.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}