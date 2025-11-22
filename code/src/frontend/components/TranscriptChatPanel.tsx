/**
 * TranscriptChatPanel Component
 * 
 * This is the explanation chatbot for asking follow-up questions about feedback
 */

import React, { useState, useEffect, useRef } from "react";

interface TranscriptChatPanelProps {
  segments: Array<{ title: string; content: string }>;
  feedback: string;
  suggestions: string;
  scores: Array<{ category: string; score: number }>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const TranscriptChatPanel: React.FC<TranscriptChatPanelProps> = ({
  segments,
  feedback,
  suggestions,
  scores,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm here to help you understand your feedback. You can ask me questions like:\n• 'Why did I get a low persuasion score?'\n• 'How could I have handled that objection better?'\n• 'What did I do well in this conversation?'",
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resourceId = localStorage.getItem("cedar_resourceId") || "";
  
  // Use consistent threadId per report session (store in ref to persist across renders)
  const threadIdRef = useRef<string>(`transcript-${Date.now()}`);
  const threadId = threadIdRef.current;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Send message to transcript chat endpoint
   * Uses chatType: "transcript" for context-aware prompts
   */
  const sendMessage = async () => {
    const message = input.trim();
    if (!message || isProcessing) return;

    // Add user message
    const userMessage: Message = { role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);

    try {
      // Create assistant message element for streaming
      const assistantMessage: Message = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      // Call streaming chat endpoint with transcript context
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: message,
          additionalContext: {
            chatType: {
              data: "transcript",
            },
            conversationAnalysis: {
              segments,
              feedback,
              suggestions,
              scores,
            },
          },
          resourceId: resourceId,
          threadId: threadId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let responseText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const data = line.substring(5).trim();
            if (data === "") continue;

            // Try to parse as JSON (for errors or text chunks)
            try {
              const jsonData = JSON.parse(data);
              
              // Handle error messages
              if (jsonData.type === "error") {
                throw new Error(jsonData.message || "Error from server");
              }
              
              // Handle text chunks (format: { type: "text", content: "..." })
              if (jsonData.type === "text" && jsonData.content) {
                responseText += jsonData.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: responseText,
                  };
                  return updated;
                });
              }
            } catch (e) {
              // If parsing fails, treat as plain text chunk (backward compatibility)
              if (data && !data.startsWith("{")) {
                responseText += data;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: responseText,
                  };
                  return updated;
                });
              } else {
                console.warn("[TranscriptChatPanel] Failed to parse SSE data:", data);
              }
            }
          } else if (line.startsWith("event: done")) {
            break;
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, there was an error processing your request.",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] w-full bg-gray-50 border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-orange-50 flex-shrink-0">
        <svg
          className="w-5 h-5 mr-2 text-orange-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-gray-800">
          Ask About Your Performance
        </h3>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto bg-white p-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-4 ${
              msg.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block max-w-[80%] p-3 rounded-lg ${
                msg.role === "user"
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
                  <div className="whitespace-pre-wrap break-words">{msg.content.replace(/\\n/g, '\n')}</div>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="text-left mb-4">
            <div className="inline-block bg-gray-100 text-gray-800 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0 p-2 bg-white border-t border-gray-200 rounded-b-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about your feedback..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isProcessing}
          />
              <button
                onClick={sendMessage}
                disabled={isProcessing || !input.trim()}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptChatPanel;

