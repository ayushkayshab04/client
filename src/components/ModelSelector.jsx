
import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

export default function ModelSelector({ onModelChange }) {
  const [models, setModels] = useState([]);
  const [provider, setProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const fetchModels = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/models`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error("Unable to retrieve models");
      }

      const fetchedModels = result.models || [];
      setModels(fetchedModels);

      const available = fetchedModels.filter(
        (model) => model.provider === provider
      );

      const currentExists = available.some(
        (model) => model.id === selectedModel
      );

      if (!currentExists && available.length > 0) {
        updateSelection(provider, available[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const updateSelection = (nextProvider, modelId) => {
    setProvider(nextProvider);
    setSelectedModel(modelId);

    onModelChange?.({
      provider: nextProvider,
      model: modelId,
    });
  };

const providerModels = models.filter(
  (model) => model.provider === provider
);

const availableModels =
  provider === "openrouter"
    ? [
        {
          id: "openrouter/free",
          name: "OpenRouter Free (Auto)",
          provider: "openrouter",
          inputModalities: ["text", "image"],
          outputModalities: ["text"],
          contextLength: 200000,
        },
        ...providerModels,
      ]
    : providerModels;

  const suggestedModels = availableModels
    .filter((model) => {
      const input = model.inputModalities || [];
      const output = model.outputModalities || [];

      return input.includes("text") && output.includes("text");
    })
    .slice(0, 3);

  const currentModel = models.find(
    (model) => model.id === selectedModel && model.provider === provider
  );

  const changeProvider = (nextProvider) => {
   const firstModel =
  nextProvider === "openrouter"
    ? {
        id: "openrouter/free",
        provider: "openrouter",
      }
    : models.find((model) => model.provider === nextProvider);

    if (firstModel) {
      updateSelection(nextProvider, firstModel.id);
    } else {
      setProvider(nextProvider);
      setSelectedModel("");
      onModelChange?.({
        provider: nextProvider,
        model: "",
      });
    }
  };

  return (
    <>
      {/* Compact model selector tab */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />

        <span className="max-w-[180px] truncate">
          {currentModel?.name || "Select AI Model"}
        </span>

        <svg
          className="h-4 w-4 shrink-0 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m6 9 6 6 6-6"
          />
        </svg>
      </button>

      {/* Popup and backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-selector-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {/* Popup header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div>
                <h2
                  id="model-selector-title"
                  className="text-lg font-bold text-gray-800"
                >
                  AI Model Settings
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Choose your preferred AI provider and model.
                </p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close model selector"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
              {/* Refresh */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {models.length} total models available
                </span>

                <button
                  onClick={fetchModels}
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Refreshing..." : "Refresh Models"}
                </button>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              {/* Provider */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  AI Provider
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {["openai", "openrouter", "nvidia"].map((item) => (
                    <button
                      key={item}
                      onClick={() => changeProvider(item)}
                      className={`rounded-lg border px-2 py-3 text-sm font-medium capitalize transition ${
                        provider === item
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {item === "openrouter" ? "OpenRouter" : item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model selection */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Select Model
                </label>

                <select
                  value={selectedModel}
                  onChange={(e) =>
                    updateSelection(provider, e.target.value)
                  }
                  disabled={!providerModels.length}
                  className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Choose a model</option>

                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-gray-500">
                  {availableModels.length} models available from {provider}
                </p>
              </div>

              {/* Suggestions */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-700">
                  Suggested Text Models
                </h3>

                {suggestedModels.length > 0 ? (
                  <div className="space-y-2">
                    {suggestedModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() =>
                          updateSelection(provider, model.id)
                        }
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          selectedModel === model.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-800">
                            {model.name}
                          </span>

                          {selectedModel === model.id && (
                            <span className="text-xs font-semibold text-blue-600">
                              Selected
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                          Text input and text output
                          {model.contextLength
                            ? ` · ${model.contextLength.toLocaleString()} context`
                            : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                    {loading
                      ? "Loading suggestions..."
                      : "No suggested text models available."}
                  </p>
                )}
              </div>
            </div>

            {/* Popup footer */}
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 p-4">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Current selection</p>
                <p className="truncate text-sm font-semibold text-gray-800">
                  {currentModel?.name || "No model selected"}
                </p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="shrink-0 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
