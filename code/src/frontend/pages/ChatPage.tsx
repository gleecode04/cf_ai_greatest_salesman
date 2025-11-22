/**
 * Chat Page Component (Scenario Chat)
 * 
 * New UI Layout with Scenario Management:
 * - Left sidebar: Scenario info (customer + product info)
 * - Center: Content rectangle with navigation arrows
 * - Default view: Product/Customer info
 * - Right arrow: Chat interface
 * - Next Scenario button after completion
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  SCENARIOS, 
  getScenarioById, 
  getCurrentScenarioId, 
  setCurrentScenarioId,
  getCompletedScenarios,
  markScenarioCompleted,
  getNextScenarioId,
  areAllScenariosCompleted,
  type Scenario
} from "../lib/scenarios";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type ViewType = "info" | "chat";

export default function ChatPage() {
  // Load current scenario
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(() => {
    const scenarioId = getCurrentScenarioId() || SCENARIOS[0].id;
    return getScenarioById(scenarioId) || SCENARIOS[0];
  });

  const [completedScenarios, setCompletedScenarios] = useState<string[]>(getCompletedScenarios);
  const [showScenarioComplete, setShowScenarioComplete] = useState(false);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true);

  // Resource ID management
  const [resourceId] = useState(() => {
    let id = localStorage.getItem("cedar_resourceId");
    if (!id) {
      id = Array.from({ length: 20 }, () =>
        Math.floor(Math.random() * 36).toString(36)
      ).join("");
      localStorage.setItem("cedar_resourceId", id);
    }
    return id;
  });

  // Get or create threadId (needs resourceId) - use state so we can update it
  const [threadId, setThreadId] = useState(() => {
    const id = localStorage.getItem("cedar_resourceId") || resourceId;
    const stored = localStorage.getItem(`chat_threadId_${id}_${currentScenario?.id}`);
    if (stored) return stored;
    const newThreadId = `thread-${Date.now()}`;
    localStorage.setItem(`chat_threadId_${id}_${currentScenario?.id}`, newThreadId);
    return newThreadId;
  });

  const chatType = "scenario";
  const [currentView, setCurrentView] = useState<ViewType>("info");
  const [hasStarted, setHasStarted] = useState(() => {
    // Check if there are any messages (user has started chatting)
    const stored = localStorage.getItem(`chat_messages_${threadId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed && parsed.length > 2; // More than welcome message
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  // Initialize scenario loading
  useEffect(() => {
    console.log('[ChatPage] Component mounted, initializing...');
    console.log('[ChatPage] Current scenario:', currentScenario?.id, currentScenario?.title);
    console.log('[ChatPage] ThreadId:', threadId);
    console.log('[ChatPage] ResourceId:', resourceId);
    
    // Mark scenario as loaded after a brief check
    const timer = setTimeout(() => {
      setIsLoadingScenario(false);
      console.log('[ChatPage] Scenario loading complete');
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Check if we're returning from report page - if so, show scenario complete
  // IMPORTANT: Don't clear messages when returning from report - preserve chat history
  useEffect(() => {
    const returningFromReport = sessionStorage.getItem("returningFromReport");
    if (returningFromReport === "true") {
      sessionStorage.removeItem("returningFromReport");
      // Mark scenario as completed
      if (currentScenario) {
        markScenarioCompleted(currentScenario.id);
        // Force refresh completed scenarios
        const updated = getCompletedScenarios();
        setCompletedScenarios(updated);
        console.log('[ChatPage] Marked scenario as completed:', currentScenario.id);
        console.log('[ChatPage] Completed scenarios:', updated);
        console.log('[ChatPage] Total scenarios:', SCENARIOS.length);
        setShowScenarioComplete(true);
        
        // Reload messages for current threadId (preserve chat history)
        const stored = localStorage.getItem(`chat_messages_${threadId}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.length > 0) {
              // Mark all existing assistant messages as already spoken (prevent auto-play on reload)
              // This is critical: prevents TTS from auto-playing old messages when returning from report
              parsed.forEach((msg: Message, idx: number) => {
                if (msg.role === "assistant") {
                  autoSpokenMessagesRef.current.add(idx);
                }
              });
              setMessages(parsed);
              setHasStarted(parsed.length > 1);
            }
          } catch (e) {
            console.error('[ChatPage] Error reloading messages after report:', e);
          }
        }
      }
    }
  }, [currentScenario, threadId]);

  // Load messages from localStorage on mount
  const [messages, setMessages] = useState<Message[]>(() => {
    // Try to load messages for current threadId
    const stored = localStorage.getItem(`chat_messages_${threadId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          console.log('[ChatPage] Loaded messages from localStorage:', parsed.length, 'messages');
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing stored messages:", e);
      }
    }
    // Welcome message based on scenario (fallback)
    const welcomeMessage = currentScenario 
      ? currentScenario.welcomeMessage
      : "Hello! I'm here to help you practice your sales and customer support skills. How can I assist you today?";
    
    console.log('[ChatPage] No stored messages, using welcome message');
    return [
      {
        role: "assistant",
        content: welcomeMessage,
      },
    ];
  });

  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeakingIndex, setCurrentSpeakingIndex] = useState<number | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const autoSpokenMessagesRef = useRef<Set<number>>(new Set()); // Track which messages have been auto-spoken
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendMessageRef = useRef<((text: string) => Promise<void>) | null>(null);

  // Reload messages when threadId changes (e.g., scenario change)
  // This ensures messages are loaded even if component re-renders
  useEffect(() => {
    console.log('[ChatPage] Checking messages for threadId:', threadId);
    const stored = localStorage.getItem(`chat_messages_${threadId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          console.log('[ChatPage] Reloading messages from localStorage:', parsed.length, 'messages');
          // Mark all existing assistant messages as already spoken (prevent auto-play on reload)
          parsed.forEach((msg: Message, idx: number) => {
            if (msg.role === "assistant") {
              autoSpokenMessagesRef.current.add(idx);
            }
          });
          setMessages(parsed);
          // Update hasStarted based on loaded messages
          setHasStarted(parsed.length > 1); // More than just welcome message
          return;
        }
      } catch (e) {
        console.error('[ChatPage] Error parsing stored messages:', e);
      }
    }
    // If no stored messages and we have a scenario, set welcome message
    // But only if messages array is empty or only has welcome message
    if (currentScenario && (messages.length === 0 || (messages.length === 1 && messages[0].role === "assistant"))) {
      const welcomeMessage = currentScenario.welcomeMessage;
      // Only set if it's different from current welcome message
      if (messages.length === 0 || messages[0].content !== welcomeMessage) {
        console.log('[ChatPage] Setting welcome message for scenario:', currentScenario.id);
        setMessages([{ role: "assistant", content: welcomeMessage }]);
        setHasStarted(false);
      }
    }
  }, [threadId]); // Only reload when threadId changes, not on every render

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`chat_messages_${threadId}`, JSON.stringify(messages));
    }
  }, [messages, threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize Speech Synthesis API
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
    
    // Cleanup on unmount
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
        synthRef.current.pause();
        synthRef.current.cancel();
      }
    };
  }, []);
  
  // Reset auto-spoken tracking when threadId changes (new conversation)
  // BUT: We need to mark loaded messages as already spoken to prevent auto-play
  useEffect(() => {
    // Clear first
    autoSpokenMessagesRef.current.clear();
    
    // Then immediately mark all existing assistant messages as already spoken
    // This prevents auto-play when messages are loaded from localStorage
    const stored = localStorage.getItem(`chat_messages_${threadId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed)) {
          parsed.forEach((msg: Message, idx: number) => {
            if (msg.role === "assistant") {
              autoSpokenMessagesRef.current.add(idx);
            }
          });
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }, [threadId]);

  // Auto-speak AI responses (only once per message)
  useEffect(() => {
    if (!synthRef.current || messages.length === 0) return;

    // Find the last assistant message
    const lastAssistantIndex = messages.length - 1;
    const lastMessage = messages[lastAssistantIndex];
    
    // Only auto-speak if:
    // 1. It's an assistant message
    // 2. It has content
    // 3. It hasn't been auto-spoken yet
    // 4. It's not currently being spoken
    // 5. It's not the welcome message (index 0)
    // 6. User hasn't manually stopped it
    if (
      lastMessage.role === "assistant" &&
      lastMessage.content &&
      lastMessage.content.length > 0 &&
      !autoSpokenMessagesRef.current.has(lastAssistantIndex) &&
      currentSpeakingIndex !== lastAssistantIndex &&
      lastAssistantIndex > 0 &&
      !isSpeaking
    ) {
      // Wait a bit for the message to finish streaming
      const timeoutId = setTimeout(() => {
        // Double-check conditions before speaking
        if (!isSpeaking && currentSpeakingIndex !== lastAssistantIndex && !autoSpokenMessagesRef.current.has(lastAssistantIndex)) {
          autoSpokenMessagesRef.current.add(lastAssistantIndex); // Mark as auto-spoken
          speakMessage(lastMessage.content, lastAssistantIndex);
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [messages, isSpeaking, currentSpeakingIndex]);

  const speakMessage = (text: string, messageIndex: number) => {
    if (!synthRef.current) {
      console.warn('[TTS] Speech Synthesis not available');
      return;
    }

    // Cancel ALL ongoing speech (including queued utterances)
    synthRef.current.cancel();
    
    // Clear any existing utterance reference
    utteranceRef.current = null;
    setIsSpeaking(false);
    setCurrentSpeakingIndex(null);

    // Small delay to ensure cancellation completes
    setTimeout(() => {
      if (!synthRef.current) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

      utterance.onstart = () => {
        console.log('[TTS] Started speaking message', messageIndex);
        setIsSpeaking(true);
        setCurrentSpeakingIndex(messageIndex);
      };

      utterance.onend = () => {
        console.log('[TTS] Finished speaking message', messageIndex);
        setIsSpeaking(false);
        setCurrentSpeakingIndex(null);
        utteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        console.error('[TTS] Error speaking:', event.error);
        setIsSpeaking(false);
        setCurrentSpeakingIndex(null);
        utteranceRef.current = null;
      };

      utterance.onpause = () => {
        console.log('[TTS] Paused speaking message', messageIndex);
      };

      utteranceRef.current = utterance;
      synthRef.current.speak(utterance);
    }, 50);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      // Cancel ALL speech synthesis (including queued)
      synthRef.current.cancel();
      // Also pause in case cancel doesn't work
      synthRef.current.pause();
      // Clear the queue
      synthRef.current.cancel();
      
      setIsSpeaking(false);
      setCurrentSpeakingIndex(null);
      utteranceRef.current = null;
      
      console.log('[TTS] Stopped all speech');
    }
  };

  const toggleSpeaking = (messageIndex: number, text: string) => {
    // Always stop any current speech first
    if (isSpeaking) {
      stopSpeaking();
      // If clicking the same message that's speaking, just stop (don't restart)
      if (currentSpeakingIndex === messageIndex) {
        return;
      }
    }
    
    // Start speaking the requested message
    speakMessage(text, messageIndex);
  };

  const sendMessageWithText = async (text: string) => {
    const message = text.trim();
    if (!message || isProcessing) {
      console.log('[ChatPage] Message send blocked:', { message: !!message, isProcessing });
      return;
    }
    
    // Clear input
    setInput("");
    
    // Mark as started when user sends first message
    if (!hasStarted) {
      console.log('[ChatPage] First message, marking as started');
      setHasStarted(true);
    }

    const userMessage: Message = { role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      console.log('[ChatPage] Preparing to send chat request...');
      const assistantMessage: Message = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      console.log('[ChatPage] Calling /api/chat/stream with:', {
        threadId,
        resourceId,
        scenarioId: currentScenario?.id,
        messageLength: message.length,
      });

      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: message,
          additionalContext: {
            chatType: {
              data: chatType,
            },
            scenarioId: currentScenario?.id,
            scenarioData: currentScenario,
          },
          resourceId: resourceId,
          threadId: threadId,
        }),
      });

      if (!response.ok) {
        console.error('[ChatPage] Chat stream failed:', response.status, response.statusText);
        throw new Error("Failed to get response");
      }

      console.log('[ChatPage] Chat stream response received, starting to read...');
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      let fullResponseText = "";
      
      // Read all data from stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const data = line.slice(5);
            if (data === "" || data.trim() === "" || data.trim() === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "text" && parsed.content) {
                // Accumulate all content
                fullResponseText += parsed.content;
              }
            } catch (e) {
              // If not JSON, treat as plain text
              if (data && data.trim() !== "[DONE]") {
                fullResponseText += data;
              }
            }
          } else if (line.startsWith("event: done")) {
            console.log('[ChatPage] Stream completed');
          }
        }
      }
      
      // Set the complete response at once (no chunking issues)
      if (fullResponseText) {
        console.log('[ChatPage] Full response received, length:', fullResponseText.length);
        console.log('[ChatPage] Response content:', JSON.stringify(fullResponseText.substring(0, 100)));
        
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content = fullResponseText; // Set complete response at once
          }
          return updated;
        });
      }
    } catch (error) {
      console.error("[ChatPage] Error sending message:", error);
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.content = "Sorry, I encountered an error. Please try again.";
        }
        return updated;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const sendMessage = async () => {
    await sendMessageWithText(input);
  };
  
  // Store sendMessageWithText in ref so recognition callback can access it
  useEffect(() => {
    sendMessageRef.current = sendMessageWithText;
  }, [isProcessing, hasStarted, threadId, resourceId, currentScenario?.id]);
  
  // Initialize Speech Recognition API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = false;
        recognitionInstance.lang = 'en-US';
        
        recognitionInstance.onstart = () => {
          console.log('[Voice] Recognition started');
          setIsListening(true);
        };
        
        recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          console.log('[Voice] Transcript received:', transcript);
          setInput(transcript);
          setIsListening(false);
          
          // Auto-submit after a short delay to show the transcribed text
          setTimeout(() => {
            if (transcript.trim() && sendMessageRef.current) {
              sendMessageRef.current(transcript);
            }
          }, 300);
        };
        
        recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('[Voice] Recognition error:', event.error);
          setIsListening(false);
          
          if (event.error === 'no-speech') {
            alert('No speech detected. Please try again.');
          } else if (event.error === 'not-allowed') {
            alert('Microphone permission denied. Please enable microphone access in your browser settings.');
          }
        };
        
        recognitionInstance.onend = () => {
          console.log('[Voice] Recognition ended');
          setIsListening(false);
        };
        
        setRecognition(recognitionInstance);
      } else {
        console.warn('[Voice] Speech Recognition API not supported in this browser');
      }
    }
    
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []); // Only run once on mount
  
  const handleVoiceToggle = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }
    
    if (isListening) {
      // Stop listening
      try {
        recognition.stop();
        setIsListening(false);
      } catch (error) {
        console.error('[Voice] Error stopping recognition:', error);
        setIsListening(false);
      }
    } else {
      // Start listening
      try {
        recognition.start();
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes('already started') || errorMsg.includes('started')) {
          // Already started, just stop and restart
          recognition.stop();
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              console.error('[Voice] Error restarting recognition:', e);
            }
          }, 100);
        } else {
          console.error('[Voice] Error starting recognition:', error);
          alert('Failed to start voice recognition. Please check microphone permissions.');
        }
      }
    }
  };

  const handleEndScenario = async () => {
    if (isProcessing) {
      alert("Please wait for the current message to complete.");
      return;
    }

    if (isGeneratingFeedback) {
      alert("Feedback is already being generated. Please wait...");
      return;
    }

    const transcript = messages
      .map((m) => {
        if (m.role === "user") {
          return `user: ${m.content}`;
        } else {
          return `customer: ${m.content}`;
        }
      })
      .filter(Boolean)
      .join("\n");

    if (transcript.split("\n").length < 3) {
      alert("Please have at least a few exchanges before ending the scenario.");
      return;
    }

    console.log('[ChatPage] ========== FEEDBACK GENERATION STARTED ==========');
    console.log('[ChatPage] Transcript length:', transcript.length);
    console.log('[ChatPage] ThreadId:', threadId);
    console.log('[ChatPage] ResourceId:', resourceId);
    console.log('[ChatPage] ScenarioId:', currentScenario?.id);
    console.log('[ChatPage] Scenario title:', currentScenario?.title);
    
    setIsGeneratingFeedback(true);
    // Set flag in sessionStorage to block navigation globally
    sessionStorage.setItem('isGeneratingFeedback', 'true');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('[ChatPage] Feedback generation timeout after 120s');
        controller.abort();
      }, 120000);

      console.log('[ChatPage] Calling /api/feedback endpoint...');
      const startTime = Date.now();
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcript,
          resourceId: resourceId,
          threadId: threadId,
          scenarioId: currentScenario?.id,
          scenarioData: currentScenario, // Include full scenario data for context-aware analysis
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      console.log('[ChatPage] Feedback API response received in', duration, 'ms');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error('[ChatPage] Feedback generation failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to generate feedback: ${response.status}`);
      }

      console.log('[ChatPage] Parsing feedback response...');
      const result = await response.json();
      console.log('[ChatPage] Feedback response parsed:', {
        hasSummary: !!result.summaryAnalysis,
        hasDetailedFeedback: !!result.detailedFeedback,
        summaryLength: result.summaryAnalysis?.length || 0,
        detailedLength: result.detailedFeedback?.length || 0,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to generate feedback");
      }

      if (result.summaryAnalysis && result.detailedFeedback) {
        const reportData = {
          segmentedAnalysis: result.segmentedAnalysis || "",
          summaryAnalysis: result.summaryAnalysis || "",
          detailedFeedback: result.detailedFeedback || "",
          combinedReport: result.combinedReport || `${result.summaryAnalysis}\n\n${result.detailedFeedback}`,
        };
        
        localStorage.setItem("reportData", JSON.stringify(reportData));
        localStorage.removeItem("viewThreadId");
        sessionStorage.setItem("returningFromReport", "true");
        
        console.log('[ChatPage] ========== FEEDBACK GENERATION COMPLETE ==========');
        
        // Clear navigation block flag before navigating
        setIsGeneratingFeedback(false);
        sessionStorage.removeItem('isGeneratingFeedback');
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Navigate to report page
        window.history.pushState({}, '', '/report');
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        throw new Error("Feedback report was generated but is missing required data");
      }
    } catch (error) {
      console.error("[ChatPage] Error generating feedback:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      if (error instanceof Error && error.name === "AbortError") {
        alert("Feedback generation timed out. Please try again.");
      } else {
        alert(`Error generating feedback: ${errorMessage}`);
      }
      
      setIsGeneratingFeedback(false);
      // Clear navigation block flag
      sessionStorage.removeItem('isGeneratingFeedback');
    }
  };

  const handleNextScenario = () => {
    if (!currentScenario) return;
    
    // Get next scenario ID (will cycle back to first after scenario 5)
    const nextId = getNextScenarioId(currentScenario.id);
    console.log('[ChatPage] Next scenario ID:', nextId, 'from current:', currentScenario.id);
    
    if (nextId) {
      const nextScenario = getScenarioById(nextId);
      if (nextScenario) {
        setCurrentScenario(nextScenario);
        setCurrentScenarioId(nextScenario.id);
        
        // Reset hasStarted flag for new scenario
        setHasStarted(false);
        
        // Clear chat messages for old thread
        localStorage.removeItem(`chat_messages_${threadId}`);
        
        // Create new thread for new scenario
        const newThreadId = `thread-${Date.now()}`;
        localStorage.setItem(`chat_threadId_${resourceId}_${nextScenario.id}`, newThreadId);
        setThreadId(newThreadId);
        
        // Use welcome message from scenario
        setMessages([{ role: "assistant", content: nextScenario.welcomeMessage }]);
        setShowScenarioComplete(false);
        setCurrentView("info");
      }
    }
  };

  const handleStartOver = () => {
    // Reset to first scenario
    const firstScenario = SCENARIOS[0];
    setCurrentScenario(firstScenario);
    setCurrentScenarioId(firstScenario.id);
    
    // Clear all completed scenarios
    localStorage.removeItem("completedScenarios");
    setCompletedScenarios([]);
    
    // Reset hasStarted flag
    setHasStarted(false);
    
    // Clear chat messages for current thread
    localStorage.removeItem(`chat_messages_${threadId}`);
    
    // Create new thread
    const newThreadId = `thread-${Date.now()}`;
    localStorage.setItem(`chat_threadId_${resourceId}_${firstScenario.id}`, newThreadId);
    setThreadId(newThreadId);
    
    // Reset messages
    const welcomeMessage = `Hello! I'm ${firstScenario.customer.name}. ${firstScenario.customer.attitude ? `I'm ${firstScenario.customer.attitude.toLowerCase()}.` : ''} ${firstScenario.product.name ? `I'm interested in learning about ${firstScenario.product.name}.` : 'How can you help me?'}`;
    setMessages([{ role: "assistant", content: welcomeMessage }]);
    setShowScenarioComplete(false);
    setCurrentView("info");
  };

  // Show loading state while scenario is being initialized
  if (isLoadingScenario || !currentScenario) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-lg text-gray-700 font-medium">Loading scenario...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  const allCompleted = areAllScenariosCompleted();
  const nextScenarioId = currentScenario ? getNextScenarioId(currentScenario.id) : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Navigation Bar */}
      <nav className="w-full bg-white border-b border-gray-200 py-3 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-4 items-center">
          <a 
            href="/" 
            onClick={(e) => {
              if (isGeneratingFeedback) {
                e.preventDefault();
                alert("Please wait for feedback generation to complete before navigating.");
                return false;
              }
            }}
            className={`px-3 py-1 rounded flex items-center gap-2 ${
              isGeneratingFeedback 
                ? "opacity-50 cursor-not-allowed pointer-events-none" 
                : "hover:bg-gray-100"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </a>
          <a 
            href="/chat" 
            onClick={(e) => {
              if (isGeneratingFeedback) {
                e.preventDefault();
                return false;
              }
            }}
            className={`px-3 py-1 rounded ${
              isGeneratingFeedback 
                ? "opacity-50 cursor-not-allowed pointer-events-none bg-gray-300" 
                : "bg-orange-500 text-white"
            }`}
          >
            Chat
          </a>
          <a 
            href="/report" 
            onClick={(e) => {
              if (isGeneratingFeedback) {
                e.preventDefault();
                alert("Please wait for feedback generation to complete before navigating.");
                return false;
              }
            }}
            className={`px-3 py-1 rounded ${
              isGeneratingFeedback 
                ? "opacity-50 cursor-not-allowed pointer-events-none" 
                : "hover:bg-gray-100"
            }`}
          >
            Report
          </a>
        </div>
        <div className="flex items-center gap-4">
          {isGeneratingFeedback && (
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-orange-100 text-orange-700 text-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
              <span>Generating feedback...</span>
            </div>
          )}
        </div>
      </nav>

      {/* Feedback Generation Overlay - Blocks all navigation */}
      {isGeneratingFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
            <h2 className="text-xl font-bold mb-2">Generating Feedback</h2>
            <p className="text-gray-600 mb-4">
              Please wait while we analyze your conversation. This may take 30-60 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Scenario Complete Modal */}
      {showScenarioComplete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-4 text-center">Scenario Complete!</h2>
            <p className="text-gray-600 mb-6 text-center">
              Great job completing "{currentScenario.name}"! 
              {allCompleted 
                ? ` You've completed all ${SCENARIOS.length} scenarios!` 
                : ` You've completed ${completedScenarios.length} of ${SCENARIOS.length} scenarios.`}
            </p>
            <div className="flex gap-4">
              {allCompleted ? (
                <button
                  onClick={handleStartOver}
                  className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                >
                  Start Over
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowScenarioComplete(false)}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Review Report
                  </button>
                  {nextScenarioId && (
                    <button
                      onClick={handleNextScenario}
                      className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                    >
                      Next Scenario
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Scenario Info */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <div className="p-5">
            <div className="mb-4">
              <h1 className="text-2xl font-bold mb-2">Scenario</h1>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  currentScenario.difficulty === "Easy" ? "bg-green-100 text-green-800" :
                  currentScenario.difficulty === "Medium" ? "bg-yellow-100 text-yellow-800" :
                  currentScenario.difficulty === "Hard" ? "bg-red-100 text-red-800" :
                  "bg-orange-100 text-orange-800"
                }`}>
                  {currentScenario.difficulty}
                </span>
                <span className="text-sm text-gray-500">
                  Scenario {SCENARIOS.findIndex(s => s.id === currentScenario.id) + 1} of {SCENARIOS.length}
                </span>
              </div>
              <p className="text-sm text-gray-600">{currentScenario.title}</p>
            </div>
            
            {/* Customer Info */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Customer Information</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Role:</span> {currentScenario.customer.profession || "Customer"}
                </div>
                {currentScenario.customer.age && (
                  <div>
                    <span className="font-medium">Age:</span> {currentScenario.customer.age}
                  </div>
                )}
                {currentScenario.customer.profession && (
                  <div>
                    <span className="font-medium">Profession:</span> {currentScenario.customer.profession}
                  </div>
                )}
                <div>
                  <span className="font-medium">Knowledge:</span>
                  <p className="mt-1 text-gray-700">{currentScenario.customer.knowledge}</p>
                </div>
                <div>
                  <span className="font-medium">Attitude:</span>
                  <p className="mt-1 text-gray-700">{currentScenario.customer.attitude}</p>
                </div>
                <div>
                  <span className="font-medium">Communication Style:</span>
                  <p className="mt-1 text-gray-700">{currentScenario.customer.communicationStyle}</p>
                </div>
                <div>
                  <span className="font-medium">Biases:</span>
                  <p className="mt-1 text-gray-700">{currentScenario.customer.biases}</p>
                </div>
                {currentScenario.customer.concerns && currentScenario.customer.concerns.length > 0 && (
                  <div>
                    <span className="font-medium">Concerns:</span>
                    <ul className="mt-1 list-disc list-inside text-gray-700 space-y-1">
                      {currentScenario.customer.concerns.map((concern, idx) => (
                        <li key={idx}>{concern}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentScenario.customer.behaviors && currentScenario.customer.behaviors.length > 0 && (
                  <div>
                    <span className="font-medium">Behaviors:</span>
                    <ul className="mt-1 list-disc list-inside text-gray-700 space-y-1">
                      {currentScenario.customer.behaviors.map((behavior, idx) => (
                        <li key={idx}>{behavior}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mb-4"></div>

            {/* Product Info */}
            <div>
              <h2 className="text-lg font-semibold mb-2">Product Information</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Product:</span> {currentScenario.product.name}
                </div>
                <div>
                  <span className="font-medium">Description:</span>
                  <p className="mt-1 text-gray-700">{currentScenario.product.description}</p>
                </div>
                <div>
                  <span className="font-medium">Features:</span>
                  <ul className="mt-1 list-disc list-inside text-gray-700 space-y-1">
                    {currentScenario.product.features.map((feature, idx) => (
                      <li key={idx}>{feature}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="font-medium">Price:</span>
                  <p className="mt-1 text-gray-700">{currentScenario.product.pricing}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-2">Challenge</h3>
              <p className="text-sm text-gray-700">{currentScenario.challenge}</p>
            </div>

            {currentScenario.successCriteria && currentScenario.successCriteria.length > 0 && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold mb-2">Success Criteria</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {currentScenario.successCriteria.map((criteria, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="mr-2">✓</span>
                      <span>{criteria}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Center Content Area - Rectangle with Navigation */}
        <div className="flex-1 flex items-center justify-center bg-gray-100 p-8">
          <div className="relative w-full max-w-5xl h-full max-h-[800px] bg-white rounded-lg shadow-xl flex flex-col">
            {/* Initial Welcome Screen */}
            {!hasStarted && currentView === "info" && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-8">
                  <svg className="w-24 h-24 mx-auto text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Let's Get Good at Pitching Together
                </h2>
                <p className="text-lg text-gray-600 mb-8 max-w-md">
                  Are you ready to practice your sales and customer support skills? 
                  Review the scenario information on the left, then click the arrow to start chatting with your customer.
                </p>
                <button
                  onClick={() => setCurrentView("chat")}
                  className="px-8 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold text-lg flex items-center gap-3 mx-auto"
                >
                  <span>Get Started</span>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            )}
            
            {/* Navigation Arrows */}
            {currentView === "info" && (
              <button
                onClick={() => setCurrentView("chat")}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full mr-4 w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center hover:bg-orange-600 transition-colors shadow-lg z-10"
                aria-label="Go to chat"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {currentView === "chat" && (
              <button
                onClick={() => setCurrentView("info")}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full ml-4 w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center hover:bg-orange-600 transition-colors shadow-lg z-10"
                aria-label="Go back to info"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {currentView === "info" ? (
                /* Product/Customer Info View */
                <div className="flex-1 overflow-y-auto p-8">
                  <div className="max-w-3xl mx-auto space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-4">Customer Profile</h2>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-gray-700 leading-relaxed mb-3">
                          <strong>Role:</strong> {currentScenario.customer.profession || "Customer"}
                          {currentScenario.customer.age && `, Age ${currentScenario.customer.age}`}
                        </p>
                        <p className="text-gray-700 leading-relaxed mb-3">
                          <strong>Knowledge Level:</strong> {currentScenario.customer.knowledge}
                        </p>
                        <p className="text-gray-700 leading-relaxed mb-3">
                          <strong>Attitude:</strong> {currentScenario.customer.attitude}
                        </p>
                        <p className="text-gray-700 leading-relaxed mb-3">
                          <strong>Communication Style:</strong> {currentScenario.customer.communicationStyle}
                        </p>
                        <p className="text-gray-700 leading-relaxed">
                          <strong>Biases:</strong> {currentScenario.customer.biases}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-2xl font-bold mb-4">Product Details</h2>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-lg mb-2">{currentScenario.product.name}</h3>
                        <p className="text-gray-700 mb-4">{currentScenario.product.description}</p>
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2">Features:</h4>
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                            {currentScenario.product.features.map((feature, idx) => (
                              <li key={idx}>{feature}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="font-semibold">Price: </span>
                          <span className="text-gray-700">{currentScenario.product.pricing}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-2xl font-bold mb-4">Your Challenge</h2>
                      <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                        <p className="text-gray-700 leading-relaxed mb-4">{currentScenario.challenge}</p>
                        {currentScenario.successCriteria && currentScenario.successCriteria.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Success Criteria:</h4>
                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                              {currentScenario.successCriteria.map((criteria, idx) => (
                                <li key={idx}>{criteria}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Chat View */
                <div className="flex-1 flex flex-col h-full">
                  {/* Chat Header */}
                  <div className="border-b border-gray-200 p-4 flex items-center justify-between flex-shrink-0">
                    <h2 className="text-xl font-semibold">Transcript</h2>
                    <button
                      onClick={handleEndScenario}
                      disabled={isGeneratingFeedback || isProcessing}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isGeneratingFeedback && (
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                        </div>
                      )}
                      {isGeneratingFeedback ? "Generating..." : "End Scenario & Get Feedback"}
                    </button>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            msg.role === "user"
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-semibold opacity-75">
                              {msg.role === "user" ? "You" : "Customer"}
                            </div>
                            {msg.role === "assistant" && msg.content && (
                              <button
                                onClick={() => toggleSpeaking(idx, msg.content)}
                                className={`ml-2 p-1 rounded-full transition-colors ${
                                  isSpeaking && currentSpeakingIndex === idx
                                    ? "bg-orange-500 text-white"
                                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                }`}
                                title={
                                  isSpeaking && currentSpeakingIndex === idx
                                    ? "Stop speaking"
                                    : "Play audio"
                                }
                              >
                                {isSpeaking && currentSpeakingIndex === idx ? (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      </div>
                    ))}
                    {isProcessing && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 p-3 rounded-lg">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 relative">
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                          placeholder="Type your message here..."
                          rows={2}
                          className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                          disabled={isProcessing || isListening}
                        />
                        {/* Mic Button */}
                        <button
                          onClick={handleVoiceToggle}
                          disabled={isProcessing}
                          className={`absolute right-2 bottom-2 p-2 rounded-full transition-all ${
                            isListening
                              ? 'bg-red-500 text-white animate-pulse'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={isListening ? "Click to stop listening" : "Click to start voice input"}
                        >
                          {isListening ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                          )}
                        </button>
                        {isListening && (
                          <div className="absolute right-14 bottom-2 text-sm text-red-500 font-medium flex items-center gap-1">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            Listening...
                          </div>
                        )}
                      </div>
                      <button
                        onClick={sendMessage}
                        disabled={isProcessing || !input.trim() || isListening}
                        className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
