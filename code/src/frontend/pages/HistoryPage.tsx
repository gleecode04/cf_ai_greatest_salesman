/**
 * History Page Component
 * 
 * Displays list of past sessions
 */

import React, { useState, useEffect } from "react";

interface Session {
  id: string;
  threadId: string;
  createdAt: number;
  scenarioType?: string;
  scores?: Record<string, number>;
  summary?: string;
}

export default function HistoryPage() {
  console.log('[HistoryPage] Component mounted');
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[HistoryPage] useEffect triggered');
    const loadSessions = async () => {
      setIsLoading(true);
      try {
        const resourceId = localStorage.getItem("cedar_resourceId") || "";
        console.log('[HistoryPage] resourceId:', resourceId);
        
        if (!resourceId) {
          console.log("[HistoryPage] No resourceId found, showing empty state");
          setSessions([]);
          setIsLoading(false);
          return;
        }

        console.log('[HistoryPage] Fetching sessions from API...');
        const response = await fetch(`/api/sessions?resourceId=${resourceId}`);
        console.log('[HistoryPage] API response status:', response.status);
        
        if (!response.ok) {
          throw new Error("Failed to load sessions");
        }

        const data = await response.json();
        console.log('[HistoryPage] API data:', data);
        
        if (data.success && data.sessions && data.sessions.length > 0) {
          console.log('[HistoryPage] Found', data.sessions.length, 'sessions');
          setSessions(data.sessions);
        } else {
          console.log('[HistoryPage] No sessions found, showing empty state');
          setSessions([]);
        }
      } catch (error) {
        console.error("[HistoryPage] Error loading sessions:", error);
        // Fallback to empty state on error
        setSessions([]);
      } finally {
        setIsLoading(false);
        console.log('[HistoryPage] Loading complete, isLoading:', false);
      }
    };

    loadSessions();
  }, []);
  
  console.log('[HistoryPage] Render - isLoading:', isLoading, 'sessions.length:', sessions.length);

  const viewSession = async (threadId: string) => {
    // Verify report exists before navigating
    try {
      const response = await fetch(`/api/report/${threadId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.report && data.report.summaryAnalysis) {
          // Report exists, navigate to it
          localStorage.setItem("viewThreadId", threadId);
          window.location.href = "/report";
        } else {
          alert("This session's report is not available. It may not have been completed yet.");
        }
      } else {
        alert("This session's report could not be loaded. It may not exist.");
      }
    } catch (error) {
      console.error("Error checking report:", error);
      alert("Error loading report. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen font-sans bg-gray-50">
      {/* Navigation */}
      <nav className="w-full bg-white border-b border-gray-200 py-4">
        <div className="max-w-6xl mx-auto px-4 flex gap-4">
          <a href="/" className="px-3 py-1 rounded hover:bg-gray-100">
            Home
          </a>
          <a href="/report" className="px-3 py-1 rounded hover:bg-gray-100">
            Report
          </a>
          <a href="/history" className="px-3 py-1 rounded bg-orange-500 text-white">
            History
          </a>
        </div>
      </nav>

      <div className="w-full max-w-6xl p-5">
        <h1 className="text-2rem font-bold text-center mb-2">Session History</h1>
        <p className="text-center text-gray-600 mb-8">
          Review your past practice sessions and feedback reports
        </p>

        {/* Sessions List */}
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <div className="flex justify-center items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce"></div>
                <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
              <p className="mt-4 text-gray-600">Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <svg
                    className="w-24 h-24 mx-auto text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-3">
                  No Sessions Yet
                </h2>
                <p className="text-gray-600 mb-6">
                  Complete a practice scenario to see your session history and feedback reports here.
                </p>
                <a
                  href="/"
                  className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                >
                  Start Your First Session
                </a>
              </div>
            </div>
          ) : (
            <>
              {sessions.map((session) => {
                const date = new Date(session.createdAt);
                const dateStr = date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={session.id}
                    className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => viewSession(session.threadId)}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xl font-bold">
                        {session.scenarioType || "Practice Session"}
                      </h3>
                      <span className="text-gray-500 text-sm">{dateStr}</span>
                    </div>

                    {session.scores && (
                      <div className="flex gap-2 flex-wrap mb-3">
                        {Object.entries(session.scores).map(([category, score]) => {
                          const categoryName =
                            category.charAt(0).toUpperCase() + category.slice(1);
                          return (
                            <span
                              key={category}
                              className="bg-gray-100 px-3 py-1 rounded-full text-sm"
                            >
                              <strong className="text-blue-600">{categoryName}:</strong>{" "}
                              {score}/100
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {session.summary && (
                      <p className="text-gray-600 text-sm">{session.summary}</p>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

