/**
 * Home Page Component (Central Dashboard)
 * 
 * Shows overall stats and summary across today's session:
 * - Overall score across all completed scenarios
 * - Average scores if 3+ scenarios completed
 * - Overall summarization/feedback
 * - List of past sessions/reports
 */

import React, { useState, useEffect } from "react";
import { getCompletedScenarios, SCENARIOS } from "../lib/scenarios";
import ScoreBar from "../components/ScoreBar";

interface Session {
  id: string;
  threadId: string;
  createdAt: number;
  scenarioId?: string;
  scenarioType?: string;
  scores?: Record<string, number>;
  summary?: string;
  summaryAnalysis?: string;
}

interface OverallStats {
  totalScenarios: number;
  completedScenarios: number;
  averageScores: Record<string, number>;
  overallSummary: string;
}

function SessionItem({ session }: { session: Session }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleViewReport = (threadId: string) => {
    localStorage.setItem("viewThreadId", threadId);
    window.history.pushState({}, '', '/report');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Extract summary and suggestions from summaryAnalysis
  const summaryMatch = session.summaryAnalysis?.match(/##\s*CONVERSATION OVERVIEW\s*([\s\S]*?)(?=##|$)/i);
  const performanceMatch = session.summaryAnalysis?.match(/##\s*USER PERFORMANCE ANALYSIS\s*([\s\S]*?)(?=##|$)/i);
  const suggestionsMatch = session.summaryAnalysis?.match(/##\s*IMPROVEMENT RECOMMENDATIONS\s*([\s\S]*?)(?=##|$)/i);
  
  const conversationSummary = summaryMatch ? summaryMatch[1].trim() : null;
  const performanceSummary = performanceMatch ? performanceMatch[1].trim() : null;
  const suggestions = suggestionsMatch ? suggestionsMatch[1].trim() : null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-gray-900">
                {session.scenarioId 
                  ? SCENARIOS.find(s => s.id === session.scenarioId)?.title || 'Practice Session'
                  : 'Practice Session'}
              </h3>
              {session.scenarioId && (
                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                  {SCENARIOS.find(s => s.id === session.scenarioId)?.difficulty || 'Unknown'}
                </span>
              )}
            </div>
            {conversationSummary && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {conversationSummary.substring(0, 150)}...
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {session.createdAt 
                ? new Date(session.createdAt).toLocaleString()
                : 'Unknown date'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewReport(session.threadId);
              }}
              className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
            >
              View Report
            </button>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="space-y-4">
            {conversationSummary && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Conversation Summary</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{conversationSummary}</p>
              </div>
            )}
            {performanceSummary && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Performance Analysis</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{performanceSummary}</p>
              </div>
            )}
            {suggestions && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Suggested Improvements</h4>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{suggestions}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  console.log('[HomePage] Component mounted');
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);

  useEffect(() => {
    console.log('[HomePage] useEffect triggered');
    const loadData = async () => {
      setIsLoading(true);
      try {
        const resourceId = localStorage.getItem("cedar_resourceId") || "";
        console.log('[HomePage] resourceId:', resourceId);
        
        if (!resourceId) {
          console.log("[HomePage] No resourceId found, showing empty state");
          setSessions([]);
          setOverallStats(null);
          setIsLoading(false);
          return;
        }

        console.log('[HomePage] Fetching sessions from API...');
        const response = await fetch(`/api/sessions?resourceId=${resourceId}`);
        console.log('[HomePage] API response status:', response.status);
        
        if (!response.ok) {
          throw new Error("Failed to load sessions");
        }

        const data = await response.json();
        console.log('[HomePage] API data:', data);
        console.log('[HomePage] API success:', data.success);
        console.log('[HomePage] Sessions count:', data.sessions?.length);
        
        if (data.success && data.sessions && Array.isArray(data.sessions) && data.sessions.length > 0) {
          const sortedSessions = data.sessions.sort((a: Session, b: Session) => 
            (b.createdAt || 0) - (a.createdAt || 0)
          );
          console.log('[HomePage] Sorted sessions:', sortedSessions.length);
          setSessions(sortedSessions);
          
          // Calculate overall stats
          calculateOverallStats(sortedSessions);
        } else {
          console.log('[HomePage] No sessions found or invalid data');
          console.log('[HomePage] Data structure:', { success: data.success, sessions: data.sessions });
          setSessions([]);
          setOverallStats(null);
        }
      } catch (error) {
        console.error("[HomePage] Error loading sessions:", error);
        setSessions([]);
        setOverallStats(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const calculateOverallStats = (sessions: Session[]) => {
    const completedCount = getCompletedScenarios().length;
    const totalCount = SCENARIOS.length;
    
    console.log('[HomePage] Calculating stats:', { sessionsCount: sessions.length, completedCount, totalCount });
    
    // Collect all scores
    // Note: Backend returns keys like 'activeListening', 'objectionHandling', 'closingAbility'
    // We normalize to lowercase for matching
    const scoreSums: Record<string, number> = {};
    const scoreCounts: Record<string, number> = {};
    
    sessions.forEach(session => {
      console.log('[HomePage] Processing session:', { threadId: session.threadId, hasScores: !!session.scores, scores: session.scores });
      if (session.scores) {
        Object.entries(session.scores).forEach(([key, value]) => {
          const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
          console.log('[HomePage] Score entry:', { key, normalizedKey, value });
          // Accept any score that's a number (backend may use camelCase or other formats)
          if (typeof value === 'number' && value > 0) {
            // Use the normalized key for aggregation
            scoreSums[normalizedKey] = (scoreSums[normalizedKey] || 0) + value;
            scoreCounts[normalizedKey] = (scoreCounts[normalizedKey] || 0) + 1;
          }
        });
      }
    });
    
    console.log('[HomePage] Score sums:', scoreSums);
    console.log('[HomePage] Score counts:', scoreCounts);
    
    // Calculate averages for all score categories found
    const averageScores: Record<string, number> = {};
    Object.keys(scoreSums).forEach(category => {
      if (scoreCounts[category] > 0) {
        averageScores[category] = Math.round(scoreSums[category] / scoreCounts[category]);
      }
    });
    
    console.log('[HomePage] Average scores:', averageScores);
    
    // Generate brief overall summary (extract just the CONVERSATION OVERVIEW from first session)
    // Only show a 1-2 sentence summary, not the full detailed analysis
    let briefSummary = "Complete more scenarios to see your overall performance summary.";
    if (sessions.length > 0) {
      const firstSummary = sessions[0].summaryAnalysis || sessions[0].summary || "";
      if (firstSummary) {
        // Extract just the CONVERSATION OVERVIEW section (first 2-3 sentences)
        const overviewMatch = firstSummary.match(/##\s*CONVERSATION OVERVIEW\s*([\s\S]*?)(?=##|$)/i);
        if (overviewMatch) {
          const overviewText = overviewMatch[1].trim();
          // Take first 2 sentences
          const sentences = overviewText.split(/[.!?]+/).filter(s => s.trim().length > 0).slice(0, 2);
          briefSummary = sentences.map(s => s.trim() + '.').join(' ') || overviewText.substring(0, 200) + "...";
        } else {
          // Fallback: take first 200 chars
          briefSummary = firstSummary.substring(0, 200) + "...";
        }
      }
    }
    
    console.log('[HomePage] Brief summary:', briefSummary.substring(0, 50));
    
    setOverallStats({
      totalScenarios: totalCount,
      completedScenarios: completedCount,
      averageScores,
      overallSummary: briefSummary
    });
  };

  const handleViewReport = (threadId: string) => {
    localStorage.setItem("viewThreadId", threadId);
    window.history.pushState({}, '', '/report');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleStartPractice = () => {
    window.history.pushState({}, '', '/chat');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="w-full bg-white border-b border-gray-200 py-3 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-4 items-center">
          <a href="/" className="px-3 py-1 rounded bg-orange-500 text-white">Home</a>
          <a href="/chat" className="px-3 py-1 rounded hover:bg-gray-100">Chat</a>
          <a href="/report" className="px-3 py-1 rounded hover:bg-gray-100">Report</a>
        </div>
      </nav>

      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="flex justify-center items-center gap-2 mb-4">
                <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce"></div>
                <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
              <p className="text-gray-600">Loading your progress...</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          /* Empty State - No sessions yet */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                No Sessions Yet
              </h2>
              <p className="text-gray-600 mb-6">
                Complete practice scenarios to see your overall performance summary and statistics here.
              </p>
              <button
                onClick={handleStartPractice}
                className="inline-block px-8 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold text-lg"
              >
                Start Practicing
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Overall Stats Card */}
              {overallStats && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Today's Session Overview</h2>
                      <p className="text-sm text-gray-600">
                        {overallStats.completedScenarios} of {overallStats.totalScenarios} scenarios completed
                      </p>
                    </div>
                  </div>

                  {/* Average Scores - Using ScoreBar component like ReportPage */}
                  {Object.keys(overallStats.averageScores).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Average Scores</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        {Object.entries(overallStats.averageScores)
                          .sort(([a], [b]) => {
                            // Sort by common order: Empathy, Clarity, Assertiveness, Persuasion, Active Listening, Objection Handling, Closing Ability
                            const order: Record<string, number> = {
                              'empathy': 1,
                              'clarity': 2,
                              'assertiveness': 3,
                              'persuasion': 4,
                              'activelistening': 5,
                              'objectionhandling': 6,
                              'closingability': 7,
                            };
                            return (order[a.toLowerCase()] || 99) - (order[b.toLowerCase()] || 99);
                          })
                          .map(([category, score]) => {
                            // Format category name nicely
                            const displayName = category
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, str => str.toUpperCase())
                              .replace(/Activelistening/i, 'Active Listening')
                              .replace(/Objectionhandling/i, 'Objection Handling')
                              .replace(/Closingability/i, 'Closing Ability')
                              .trim();
                            return (
                              <ScoreBar 
                                key={category} 
                                category={displayName} 
                                score={score} 
                              />
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Brief Overall Summary */}
                  {overallStats.overallSummary && overallStats.overallSummary !== "Complete more scenarios to see your overall performance summary." && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Session Overview</h3>
                      <div className="text-gray-700 bg-gray-50 rounded-lg p-4">
                        <p>{overallStats.overallSummary}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Past Sessions List */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Past Sessions</h2>
                {sessions.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No past sessions yet.</p>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((session) => (
                      <SessionItem key={session.id} session={session} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

