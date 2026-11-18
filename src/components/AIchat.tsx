
import { useState } from "react";

const API_URL = "https://server-og93.onrender.com";


export default function AIChat({ selectedAIModel }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendMessage = async (e) => {
    e.preventDefault();

    const question = input.trim();

    if (!question || loading) return;

    if (!selectedAIModel?.model) {
      setError("Please select an AI model first.");
      return;
    }

    const updatedMessages = [
      ...messages,
      { role: "user", content: question },
    ];

    setMessages(updatedMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: selectedAIModel.provider,
          model: selectedAIModel.model,
          messages: updatedMessages,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "AI request failed");
      }

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: result.answer,
          provider: result.provider,
          model: result.model,
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <h2 className="text-xl font-bold text-gray-800">
          AI Pet Assistant
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Ask questions about pet health, nutrition and care.
        </p>

        <p className="mt-2 text-xs text-blue-600">
          Provider: {selectedAIModel?.provider || "Not selected"}
          {" · "}
          Model: {selectedAIModel?.model || "Not selected"}
        </p>
      </div>

      <div className="flex min-h-[300px] max-h-[450px] flex-col gap-4 overflow-y-auto bg-gray-50 p-5">
        {messages.length === 0 && (
          <div className="m-auto max-w-sm text-center">
            <div className="mb-3 text-4xl">🐾</div>
            <h3 className="font-semibold text-gray-700">
              How can I help your pet?
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Ask about symptoms, nutrition, vaccinations or everyday care.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl p-4 text-sm leading-relaxed ${
              message.role === "user"
                ? "ml-auto rounded-br-sm bg-blue-600 text-white"
                : "mr-auto rounded-bl-sm border border-gray-200 bg-white text-gray-700"
            }`}
          >
            {message.content}

            {message.role === "assistant" && message.provider && (
              <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-400">
                {message.provider} · {message.model}
              </p>
            )}
          </div>
        ))}

        {loading && (
          <div className="mr-auto rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm">
            AI is thinking...
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={sendMessage} className="flex gap-2 border-t border-gray-100 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something about your pet..."
          disabled={loading}
          className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </form>

      <p className="px-4 pb-3 text-center text-xs text-gray-400">
        AI guidance is informational and does not replace a veterinarian.
      </p>
    </section>
  );
}
