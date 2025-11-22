/**
 * Report Page Component
 * 
 * Redesigned with orange color scheme and modern layout
 * Structure: Summary / Evaluation / Annotations + Chat Assist
 */

import React, { useState, useEffect, useRef } from "react";
import ScoreBar from "../components/ScoreBar";
import { marked } from "marked";
import Parser from "../lib/parser";
import AnnotatedTranscript from "../components/AnnotatedTranscript";
import TranscriptChatPanel from "../components/TranscriptChatPanel";
import { 
  getCurrentScenarioId, 
  getNextScenarioId, 
  setCurrentScenarioId,
  getScenarioById,
  areAllScenariosCompleted,
  getCompletedScenarios,
  SCENARIOS
} from "../lib/scenarios";

const defaultScores = [
  { category: "Empathy", score: 85 },
  { category: "Clarity", score: 90 },
  { category: "Assertiveness", score: 75 },
  { category: "Persuasion", score: 80 },
  { category: "Active Listening", score: 88 },
  { category: "Objection Handling", score: 82 },
  { category: "Closing Ability", score: 70 },
];

type TabType = "summary" | "evaluation" | "annotations";

export default function ReportPage() {
  console.log('[ReportPage] Component mounted');
  
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [showChatAssist, setShowChatAssist] = useState(false);
  
  // Get current scenario info for next scenario button
  const currentScenarioId = getCurrentScenarioId();
  const nextScenarioId = getNextScenarioId();
  const allCompleted = areAllScenariosCompleted();
  const completedCount = getCompletedScenarios().length;

  const [summary, setSummary] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [scoring, setScores] = useState<typeof defaultScores>([]);
  const [suggestions, setSuggestions] = useState<string>("");
  const [segments, setSegments] = useState<
    { title: string; content: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  
  console.log('[ReportPage] Render - isLoading:', isLoading, 'hasData:', !!(summary || feedback || segments.length));

  // Load report data (from localStorage or API)
  useEffect(() => {
    console.log('[ReportPage] useEffect triggered');
    const loadReportData = async () => {
      setIsLoading(true);
      try {
        // Check if viewing a specific thread (from history page)
        const viewThreadId = localStorage.getItem("viewThreadId");
        console.log('[ReportPage] viewThreadId:', viewThreadId);
        
        if (viewThreadId) {
          // Load from API
          try {
            console.log('[ReportPage] Fetching report from API...');
            const response = await fetch(`/api/report/${viewThreadId}`);
            console.log('[ReportPage] API response status:', response.status);
            
            if (response.ok) {
              const data = await response.json();
              console.log('[ReportPage] API data received:', !!data.report);
              
              if (data.success && data.report && data.report.summaryAnalysis && data.report.detailedFeedback) {
                // Store in localStorage for parser
                localStorage.setItem("reportData", JSON.stringify(data.report));
                // Clear viewThreadId
                localStorage.removeItem("viewThreadId");
                // Parse and display
                const parserInput = JSON.stringify({
                  summaryAnalysis: data.report.summaryAnalysis || "",
                  detailedFeedback: data.report.detailedFeedback || "",
                });
                const parsed = Parser(parserInput);
                console.log('[ReportPage] Parsed data - summary:', !!parsed.summary, 'segments:', parsed.segments.length);
                
                // Only set data if we actually got valid parsed content
                if (parsed.summary || parsed.feedback || parsed.segments.length > 0) {
                  setSummary(parsed.summary || "");
                  setFeedback(parsed.feedback || "");
                  setSegments(parsed.segments || []);
                  setSuggestions(parsed.suggestions || "");
                  setScores(parsed.scores || defaultScores);
                  setIsLoading(false);
                  return;
                } else {
                  console.warn('[ReportPage] Report exists but has no valid content');
                  localStorage.removeItem("viewThreadId");
                }
              } else {
                console.warn('[ReportPage] Report not found or incomplete');
                localStorage.removeItem("viewThreadId");
              }
            } else {
              console.warn('[ReportPage] API returned error:', response.status);
              localStorage.removeItem("viewThreadId");
            }
          } catch (error) {
            console.error("[ReportPage] Error loading report from API:", error);
            localStorage.removeItem("viewThreadId");
          }
        }

        // Fallback to localStorage
        const stored = localStorage.getItem("reportData");
        console.log('[ReportPage] localStorage reportData exists:', !!stored);
        
        if (!stored) {
          console.log('[ReportPage] No data found, showing empty state');
          setIsLoading(false);
          return;
        }

        try {
          const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
          console.log('[ReportPage] Parsed localStorage:', {
            hasSummaryAnalysis: !!parsed.summaryAnalysis,
            hasDetailedFeedback: !!parsed.detailedFeedback,
            hasCombinedReport: !!parsed.combinedReport,
            summaryAnalysisLength: parsed.summaryAnalysis?.length || 0,
            detailedFeedbackLength: parsed.detailedFeedback?.length || 0,
          });
          
          // Validate that we have the required fields
          if (!parsed.summaryAnalysis && !parsed.detailedFeedback && !parsed.combinedReport) {
            console.warn('[ReportPage] localStorage data is incomplete');
            setIsLoading(false);
            return;
          }
          
          // Parser expects JSON string with summaryAnalysis and detailedFeedback
          const parserInput = JSON.stringify({
            summaryAnalysis: parsed.summaryAnalysis || "",
            detailedFeedback: parsed.detailedFeedback || "",
          });
          
          console.log('[ReportPage] Parser input length:', parserInput.length);
          console.log('[ReportPage] detailedFeedback preview (first 1000 chars):', parsed.detailedFeedback?.substring(0, 1000));
          console.log('[ReportPage] detailedFeedback contains <segment:', parsed.detailedFeedback?.includes('<segment:'));
          
          // Check for segment patterns before parsing
          if (parsed.detailedFeedback) {
            const segmentMatches = parsed.detailedFeedback.match(/<segment:[^>]+>/g);
            console.log('[ReportPage] Found segment opening tags:', segmentMatches?.length || 0, segmentMatches);
            
            // Also check for closing tags
            const closingMatches = parsed.detailedFeedback.match(/<\/segment[^>]*>/g);
            console.log('[ReportPage] Found segment closing tags:', closingMatches?.length || 0);
          }
          
          const data = Parser(parserInput);
          console.log('[ReportPage] Parsed data:', {
            hasSummary: !!data.summary,
            hasFeedback: !!data.feedback,
            hasSuggestions: !!data.suggestions,
            segmentsCount: data.segments.length,
            scoresCount: data.scores.length,
          });
          
          // Debug: Log first segment if available
          if (data.segments.length > 0) {
            console.log('[ReportPage] First segment:', {
              title: data.segments[0].title,
              contentLength: data.segments[0].content.length,
              contentPreview: data.segments[0].content.substring(0, 200),
            });
          } else {
            console.warn('[ReportPage] No segments found in parsed data');
            // Debug: Check if detailedFeedback has segment tags
            if (parsed.detailedFeedback) {
              const hasSegments = parsed.detailedFeedback.includes('<segment:');
              console.log('[ReportPage] detailedFeedback contains segment tags:', hasSegments);
              if (hasSegments) {
                const segmentMatches = parsed.detailedFeedback.match(/<segment:[^>]+>/g);
                console.log('[ReportPage] Found segment opening tags:', segmentMatches?.length || 0);
                if (segmentMatches) {
                  console.log('[ReportPage] Segment tags:', segmentMatches);
                }
              }
            }
          }
          
          // Set data - use parsed data if available, otherwise use raw data
          let finalSegments: { title: string; content: string }[] = [];
          let finalSummary = "";
          let finalFeedback = "";
          let finalSuggestions = "";
          let finalScores = defaultScores;
          
          if (data.summary || data.feedback || data.segments.length > 0) {
            // Parser extracted data successfully
            finalSummary = data.summary || "";
            finalFeedback = data.feedback || "";
            finalSegments = data.segments || [];
            finalSuggestions = data.suggestions || "";
            finalScores = data.scores && data.scores.length > 0 ? data.scores : defaultScores;
            console.log('[ReportPage] Using parsed data - segments:', finalSegments.length);
          } else {
            // Parser didn't extract data - use raw data as fallback
            console.warn('[ReportPage] Parser returned no data, using raw data as fallback');
            
            // Use raw data directly if parser fails
            finalSummary = parsed.summaryAnalysis || "";
            finalFeedback = parsed.summaryAnalysis || "";
            
            // Try to extract segments from detailedFeedback if available
            if (parsed.detailedFeedback) {
              console.log('[ReportPage] Attempting to extract segments from detailedFeedback');
              // Try multiple regex patterns
              const patterns = [
                /<segment:\s*([^>]+)>([\s\S]*?)<\/segment:\s*\1>/gi,
                /<segment:\s*([^>]+)>([\s\S]*?)<\/segment:[^>]+>/gi,
                /<segment:\s*([^>]+)>([\s\S]*?)<\/segment>/gi,
              ];
              
              for (let i = 0; i < patterns.length && finalSegments.length === 0; i++) {
                const segRegex = patterns[i];
                let segMatch;
                segRegex.lastIndex = 0; // Reset regex
                while ((segMatch = segRegex.exec(parsed.detailedFeedback)) !== null) {
                  const title = segMatch[1].trim();
                  let content = segMatch[2].trim();
                  content = content.replace(
                    /^(\s*)(\w+):/gim,
                    (_, ws, speaker) =>
                      `${ws}**${speaker.charAt(0).toUpperCase()}${speaker.slice(1)}:**`
                  );
                  finalSegments.push({ title, content });
                }
                console.log(`[ReportPage] Pattern ${i + 1} found ${finalSegments.length} segments`);
              }
              
              // Also try segmentedAnalysis if detailedFeedback has no segments
              if (finalSegments.length === 0 && parsed.segmentedAnalysis) {
                console.log('[ReportPage] Trying segmentedAnalysis as fallback');
                const segRegex = /<segment:\s*([^>]+)>([\s\S]*?)<\/segment:[^>]+>/gi;
                let segMatch;
                while ((segMatch = segRegex.exec(parsed.segmentedAnalysis)) !== null) {
                  const title = segMatch[1].trim();
                  let content = segMatch[2].trim();
                  content = content.replace(
                    /^(\s*)(\w+):/gim,
                    (_, ws, speaker) =>
                      `${ws}**${speaker.charAt(0).toUpperCase()}${speaker.slice(1)}:**`
                  );
                  finalSegments.push({ title, content });
                }
                console.log('[ReportPage] Extracted from segmentedAnalysis:', finalSegments.length);
              }
            }
            
            finalSuggestions = "";
            finalScores = defaultScores;
          }
          
          // Set all state at once
          setSummary(finalSummary);
          setFeedback(finalFeedback);
          setSegments(finalSegments);
          setSuggestions(finalSuggestions);
          setScores(finalScores);
          
          localStorage.setItem(
            "prevScores",
            localStorage.getItem("scores") || JSON.stringify(defaultScores)
          );
          localStorage.setItem("scores", JSON.stringify(finalScores));
          
          console.log('[ReportPage] Data set successfully');
        } catch (error) {
          console.error("[ReportPage] Error loading report data:", error);
          console.error("[ReportPage] Error details:", error instanceof Error ? error.stack : error);
        }
      } finally {
        setIsLoading(false);
        console.log('[ReportPage] Loading complete, isLoading:', false);
      }
    };

    loadReportData();
  }, []);

  // Update state when segments change (for AnnotatedTranscript)
  useEffect(() => {
    console.log('[ReportPage] Segments updated:', segments.length);
  }, [segments]);

  const handleNextScenario = () => {
    if (allCompleted) {
      // Start over - reset to first scenario
      const firstScenario = SCENARIOS[0];
      setCurrentScenarioId(firstScenario.id);
      localStorage.removeItem("completedScenarios");
      // Clear chat data for fresh start
      localStorage.removeItem("chatMessages");
      localStorage.removeItem("threadId");
      localStorage.removeItem("resourceId");
      sessionStorage.setItem("returningFromReport", "true");
    } else if (nextScenarioId) {
      // Load next scenario
      const nextScenario = getScenarioById(nextScenarioId);
      if (nextScenario) {
        setCurrentScenarioId(nextScenario.id);
        // Clear chat data for new scenario
        localStorage.removeItem("chatMessages");
        localStorage.removeItem("threadId");
        localStorage.removeItem("resourceId");
        sessionStorage.setItem("returningFromReport", "true");
      }
    }
    
    // Navigate to chat page using the app's routing system
    window.history.pushState({}, '', '/chat');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="w-full bg-white border-b border-gray-200 py-3 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-4 items-center">
          <a href="/" className="px-3 py-1 rounded hover:bg-gray-100 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </a>
          <a href="/chat" className="px-3 py-1 rounded hover:bg-gray-100">Chat</a>
          <a href="/report" className="px-3 py-1 rounded bg-orange-500 text-white">Report</a>
        </div>
        <div className="flex items-center gap-4">
          {/* Next Scenario Button */}
          {!isLoading && (summary || feedback || segments.length > 0) && (
            <button
              onClick={handleNextScenario}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              {allCompleted ? "Start Over" : nextScenarioId ? "Next Scenario" : "Back to Practice"}
            </button>
          )}
        </div>
      </nav>

      <div ref={reportRef} className="flex-1 overflow-hidden flex flex-col">
        {/* Loading State */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="flex justify-center items-center gap-2 mb-4">
                <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce"></div>
                <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
              <p className="text-gray-600">Loading feedback report...</p>
            </div>
          </div>
        ) : (!summary || summary.trim() === "") && (!feedback || feedback.trim() === "") && segments.length === 0 ? (
          /* Empty State */
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                No Feedback Report Available
              </h2>
              <p className="text-gray-600 mb-6">
                Complete a practice scenario and click "End Scenario & Get Feedback" to generate your first feedback report.
              </p>
              <a
                href="/"
                className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
              >
                Start a Practice Session
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="bg-white border-b border-gray-200 px-6">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab("summary")}
                  className={`px-6 py-4 font-semibold text-sm transition-colors relative ${
                    activeTab === "summary"
                      ? "text-orange-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Summary
                  {activeTab === "summary" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("evaluation")}
                  className={`px-6 py-4 font-semibold text-sm transition-colors relative ${
                    activeTab === "evaluation"
                      ? "text-orange-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Evaluation
                  {activeTab === "evaluation" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("annotations")}
                  className={`px-6 py-4 font-semibold text-sm transition-colors relative ${
                    activeTab === "annotations"
                      ? "text-orange-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Annotations
                  {activeTab === "annotations" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"></div>
                  )}
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
              {/* Summary Tab */}
              {activeTab === "summary" && (
                <div className="h-full overflow-y-auto p-8">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Conversation Summary</h2>
                      </div>
                      <div className="prose max-w-none text-gray-700">
                        <div dangerouslySetInnerHTML={{ __html: marked.parse(summary) }} />
                      </div>
                    </div>

                    {suggestions && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mt-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Improvement Recommendations</h2>
                        </div>
                        <div className="prose max-w-none text-gray-700">
                          <div dangerouslySetInnerHTML={{ __html: marked.parse(suggestions) }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Evaluation Tab */}
              {activeTab === "evaluation" && (
                <div className="h-full overflow-y-auto p-8">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Performance Evaluation</h2>
                      </div>
                      
                      {feedback && (
                        <div className="mb-8 p-6 bg-gray-50 rounded-lg border-l-4 border-orange-500">
                          <div className="prose max-w-none text-gray-700">
                            <div dangerouslySetInnerHTML={{ __html: marked.parse(feedback) }} />
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Skill Scores</h3>
                        {scoring.map((score, idx) => (
                          <ScoreBar key={idx} category={score.category} score={score.score} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Annotations Tab */}
              {activeTab === "annotations" && (
                <div className="h-full overflow-hidden flex">
                  {/* Main Annotated Transcript */}
                  <div className={`flex-1 overflow-hidden p-8 transition-all duration-300 ${showChatAssist ? 'mr-96' : ''}`}>
                    <div className="max-w-4xl mx-auto h-full flex flex-col">
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex-1 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Annotated Transcript</h2>
                          </div>
                          <button
                            onClick={() => setShowChatAssist(!showChatAssist)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              showChatAssist
                                ? "bg-orange-500 text-white"
                                : "bg-orange-100 text-orange-600 hover:bg-orange-200"
                            }`}
                          >
                            {showChatAssist ? "Hide" : "Show"} Chat Assist
                          </button>
                        </div>
                        {segments && segments.length > 0 ? (
                          <div className="flex-1 overflow-y-auto min-h-0">
                            <AnnotatedTranscript segments={segments} />
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <div className="mb-4">
                              <svg
                                className="w-16 h-16 mx-auto text-gray-300"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">
                              No Annotated Transcript Available
                            </h3>
                            <p className="text-gray-500 mb-4">
                              The transcript analysis is still being processed or no segments were found.
                            </p>
                            <details className="text-left max-w-2xl mx-auto">
                              <summary className="cursor-pointer text-sm text-orange-600 hover:text-orange-700">
                                Debug Information
                              </summary>
                              <div className="mt-2 p-4 bg-gray-50 rounded text-xs">
                                <p><strong>Segments count:</strong> {segments?.length || 0}</p>
                                <p><strong>Has summary:</strong> {summary ? 'Yes' : 'No'}</p>
                                <p><strong>Has feedback:</strong> {feedback ? 'Yes' : 'No'}</p>
                                <p className="mt-2 text-gray-600">
                                  Check the browser console for detailed parsing information.
                                </p>
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Chat Assist Sidebar */}
                  {showChatAssist && (
                    <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
                      <div className="p-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Chat Assist</h3>
                        <p className="text-sm text-gray-600 mt-1">Ask questions about your performance</p>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <TranscriptChatPanel
                          segments={segments}
                          feedback={feedback}
                          suggestions={suggestions}
                          scores={scoring}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Next Scenario Button - Bottom of Report */}
              {!isLoading && (summary || feedback || segments.length > 0) && (
                <div className="border-t border-gray-200 bg-white px-8 py-6">
                  <div className="max-w-4xl mx-auto flex justify-center">
                    <button
                      onClick={handleNextScenario}
                      className="px-8 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold text-lg flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      {allCompleted 
                        ? `Start Over (${completedCount}/${SCENARIOS.length} completed)` 
                        : nextScenarioId 
                          ? `Continue to Next Scenario (${completedCount + 1}/${SCENARIOS.length})` 
                          : "Back to Practice"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
