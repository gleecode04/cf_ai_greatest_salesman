/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";
import { MemoryManager } from "./workers/memory/memoryManager";
import { SessionManager } from "./workers/session/sessionManager";
import { analyzeTranscript } from "./workers/ai/transcriptAnalyzer";
import { generateSummary } from "./workers/ai/transcriptSummaryAnalyzer";
import { analyzeDetails } from "./workers/ai/transcriptDetailAgent";
import { generateChatResponse } from "./workers/ai/defaultAgent";
import { executeFeedbackOrchestrator } from "./workers/workflows/feedbackOrchestrator";
import { createSSEStream } from "./workers/utils/streamUtils";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Default system prompt
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat/stream") {
			// Handle POST requests for streaming chat (SSE)
			if (request.method === "POST") {
				return handleChatStreamRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat (non-streaming)
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Test endpoint for memory manager
		if (url.pathname === "/api/test-db") {
			return handleTestDb(env);
		}

		// Test endpoint for session manager
		if (url.pathname === "/api/test-session") {
			return handleTestSession(env);
		}

		// Test endpoint for AI agents
		if (url.pathname === "/api/test-agents") {
			if (request.method === "POST") {
				return handleTestAgents(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		// Test endpoint for streaming chat
		if (url.pathname === "/api/test-chat-stream") {
			if (request.method === "POST") {
				return handleTestChatStream(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		// Test endpoint for default chat agent
		if (url.pathname === "/api/test-chat") {
			if (request.method === "POST") {
				return handleTestChat(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		// Get sessions list for a resource
		if (url.pathname === "/api/sessions") {
			if (request.method === "GET") {
				return handleGetSessions(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		// Get feedback report by thread ID
		if (url.pathname.startsWith("/api/report/")) {
			if (request.method === "GET") {
				return handleGetReport(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		// Feedback orchestrator workflow endpoint
		if (url.pathname === "/api/feedback") {
			if (request.method === "POST") {
				return handleFeedbackWorkflow(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		// Test endpoint for feedback workflow
		if (url.pathname === "/api/test-feedback") {
			if (request.method === "POST") {
				return handleTestFeedback(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Test session manager and KV operations
 */
async function handleTestSession(env: Env): Promise<Response> {
	try {
		const sessionManager = new SessionManager(env);
		const testSessionId = "test-session-" + Date.now();

		// Test 1: Generate resource ID
		const generatedResourceId = SessionManager.generateResourceId();
		
		// Test 2: Set resource ID
		await sessionManager.setResourceId(testSessionId, generatedResourceId);

		// Test 3: Get resource ID
		const retrievedResourceId = await sessionManager.getResourceId(testSessionId);

		// Test 4: Get or create resource ID (should return existing)
		const existingResourceId = await sessionManager.getOrCreateResourceId(testSessionId);

		// Test 5: Set session data
		const testData = {
			reportData: { summary: "Test summary", detail: "Test detail" },
			scores: { empathy: 85, clarity: 90 },
		};
		await sessionManager.setSessionData(testSessionId, "testData", testData);

		// Test 6: Get session data
		const retrievedData = await sessionManager.getSessionData(testSessionId, "testData");

		// Test 7: Get or create new resource ID (new session)
		const newSessionId = "new-session-" + Date.now();
		const newResourceId = await sessionManager.getOrCreateResourceId(newSessionId);

		// Test 8: Delete session data
		await sessionManager.deleteSessionData(testSessionId, "testData");
		const deletedData = await sessionManager.getSessionData(testSessionId, "testData");

		return new Response(
			JSON.stringify({
				success: true,
				sessionManager: {
					generatedResourceId,
					retrievedResourceId,
					resourceIdsMatch: generatedResourceId === retrievedResourceId,
					existingResourceId,
					existingMatches: existingResourceId === generatedResourceId,
					dataStored: retrievedData !== null,
					dataMatches: JSON.stringify(testData) === JSON.stringify(retrievedData),
					newResourceId,
					dataDeleted: deletedData === null,
					resourceIdLength: generatedResourceId.length,
					resourceIdFormat: /^[a-z0-9]{20}$/.test(generatedResourceId) ? "valid base36" : "invalid",
				},
			}),
			{
				headers: { "content-type": "application/json" },
			}
		);
	} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const body = await request.json() as {
			prompt?: string;
			messages?: ChatMessage[];
			temperature?: number;
			maxTokens?: number;
			systemPrompt?: string;
			additionalContext?: any;
			resourceId?: string;
			threadId?: string;
		};

		// Extract prompt from messages if provided, otherwise use prompt field
		let prompt = body.prompt || "";
		if (!prompt && body.messages && body.messages.length > 0) {
			// Extract last user message as prompt
			const lastUserMessage = body.messages
				.filter((msg) => msg.role === "user")
				.pop();
			if (lastUserMessage) {
				prompt = lastUserMessage.content;
			}
		}

		if (!prompt) {
			return new Response(
				JSON.stringify({ error: "Prompt or messages required" }),
				{
					status: 400,
					headers: { "content-type": "application/json" },
				}
			);
		}

		// Generate response using default agent
		const result = await generateChatResponse(
			{
				prompt,
				temperature: body.temperature,
				maxTokens: body.maxTokens,
				systemPrompt: body.systemPrompt,
				additionalContext: body.additionalContext,
				resourceId: body.resourceId,
				threadId: body.threadId,
			},
			env
		);

		// Return response
		return new Response(
			JSON.stringify({
				content: result.content,
				usage: result.usage,
			}),
			{
				headers: { "content-type": "application/json" },
			}
		);
	} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Internal error",
			}),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}

/**
 * Handles streaming chat API requests (SSE)
 * Uses SSE streaming for real-time responses
 */
async function handleChatStreamRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const body = await request.json() as {
			prompt?: string;
			messages?: ChatMessage[];
			temperature?: number;
			maxTokens?: number;
			systemPrompt?: string;
			additionalContext?: any;
			resourceId?: string;
			threadId?: string;
		};

		// Extract prompt from messages if provided, otherwise use prompt field
		let prompt = body.prompt || "";
		if (!prompt && body.messages && body.messages.length > 0) {
			// Extract last user message as prompt
			const lastUserMessage = body.messages
				.filter((msg) => msg.role === "user")
				.pop();
			if (lastUserMessage) {
				prompt = lastUserMessage.content;
			}
		}

		if (!prompt) {
			return new Response(
				JSON.stringify({ error: "Prompt or messages required" }),
				{
					status: 400,
					headers: { "content-type": "application/json" },
				}
			);
		}

		// Create SSE stream
		return createSSEStream(async (controller) => {
			try {
				// Generate response with streaming
				await generateChatResponse(
					{
						prompt,
						temperature: body.temperature,
						maxTokens: body.maxTokens,
						systemPrompt: body.systemPrompt,
						additionalContext: body.additionalContext,
						resourceId: body.resourceId,
						threadId: body.threadId,
						streamController: controller, // Pass controller for streaming
					},
					env
				);
			} catch (error) {
				console.error("Error in chat stream:", error);
				throw error;
			}
		});
	} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Internal error",
			}),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}

/**
 * Test database connection and memory manager
 */
async function handleTestDb(env: Env): Promise<Response> {
	try {
		// Test 1: Check tables exist
		const tablesResult = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type='table'"
		).all();

		// Test 2: Enable foreign keys (D1 should have this by default, but ensure it)
		await env.DB.prepare("PRAGMA foreign_keys = ON").run();
		
		// Test 3: Test memory manager
		const memoryManager = new MemoryManager(env);
		
		// Test 4: Create a test thread
		const testResourceId = "test-resource-" + Date.now();
		const testThread = await memoryManager.getOrCreateThread(testResourceId);
		
		// Test 5: Verify thread was created
		const verifyThread = await env.DB.prepare(
			"SELECT * FROM conversations WHERE thread_id = ?"
		).bind(testThread.threadId).first();
		
		if (!verifyThread) {
			throw new Error("Thread was not created successfully");
		}
		
		// Test 6: Add a test message
		const testMessage = await memoryManager.addMessage(
			testThread.threadId,
			"user",
			"Test message"
		);
		
		// Test 7: Get last messages
		const lastMessages = await memoryManager.getLastMessages(testThread.threadId, 5);

		return new Response(
			JSON.stringify({
				success: true,
				hotReloadTest: "asdfasdf THIS TEXT TO TEST LIVE RELOAD",
				tables: tablesResult.results.map((r: any) => r.name),
				memoryManager: {
					threadCreated: testThread.threadId,
					messageAdded: testMessage.id,
					lastMessagesCount: lastMessages.length,
				},
			}),
			{
				headers: { "content-type": "application/json" },
			}
		);
		} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}

/**
 * Test AI agents
 */
async function handleTestAgents(request: Request, env: Env): Promise<Response> {
	try {
		const body = await request.json() as {
			transcript?: string;
			testType?: "analyze" | "summary" | "details" | "full";
		};

		const testTranscript = body.transcript || `user: Hi, I wanted to discuss the project timeline.
bart: Sure, what's on your mind?
user: I think we need to push the deadline back by two weeks.
bart: I understand, but that might be difficult given our commitments.
user: I know, but we're running into some technical challenges that need more time.`;

		const resourceId = "test-resource-" + Date.now();
		const threadId = "test-thread-" + Date.now();

		const results: any = {
			success: true,
			testTranscript,
			resourceId,
			threadId,
		};

		// Test transcript analyzer
		if (body.testType === "analyze" || body.testType === "full" || !body.testType) {
			try {
				const analyzeResult = await analyzeTranscript(
					{
						transcript: testTranscript,
						resourceId,
						threadId,
					},
					env
				);
				results.analyzeTranscript = {
					success: true,
					hasSegmentedAnalysis: !!analyzeResult.segmentedAnalysis,
					segmentedAnalysisLength: analyzeResult.segmentedAnalysis?.length || 0,
					preview: analyzeResult.segmentedAnalysis?.substring(0, 200) || "",
				};
			} catch (error) {
				results.analyzeTranscript = {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}

		// Test summary analyzer (requires segmented analysis first)
		if (body.testType === "summary" || body.testType === "full") {
			try {
				// First get segmented analysis
				const analyzeResult = await analyzeTranscript(
					{
						transcript: testTranscript,
						resourceId,
						threadId,
					},
					env
				);

				const summaryResult = await generateSummary(
					{
						transcript: testTranscript,
						segmentedAnalysis: analyzeResult.segmentedAnalysis,
						resourceId,
						threadId,
					},
					env
				);
				results.generateSummary = {
					success: true,
					hasSummaryAnalysis: !!summaryResult.summaryAnalysis,
					summaryAnalysisLength: summaryResult.summaryAnalysis?.length || 0,
					preview: summaryResult.summaryAnalysis?.substring(0, 200) || "",
				};
			} catch (error) {
				results.generateSummary = {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}

		// Test detail agent (requires segmented and summary analysis)
		if (body.testType === "details" || body.testType === "full") {
			try {
				// First get segmented and summary analysis
				const analyzeResult = await analyzeTranscript(
					{
						transcript: testTranscript,
						resourceId,
						threadId,
					},
					env
				);

				const summaryResult = await generateSummary(
					{
						transcript: testTranscript,
						segmentedAnalysis: analyzeResult.segmentedAnalysis,
						resourceId,
						threadId,
					},
					env
				);

				const detailsResult = await analyzeDetails(
					{
						segmentedAnalysis: analyzeResult.segmentedAnalysis,
						summaryAnalysis: summaryResult.summaryAnalysis,
						resourceId,
						threadId,
					},
					env
				);
				results.analyzeDetails = {
					success: true,
					hasDetailedFeedback: !!detailsResult.detailedFeedback,
					detailedFeedbackLength: detailsResult.detailedFeedback?.length || 0,
					preview: detailsResult.detailedFeedback?.substring(0, 200) || "",
				};
			} catch (error) {
				results.analyzeDetails = {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}

		return new Response(JSON.stringify(results), {
			headers: { "content-type": "application/json" },
		});
	} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}

/**
 * Test default chat agent with context-aware prompts
 */
async function handleTestChatStream(request: Request, env: Env): Promise<Response> {
	try {
		const body = await request.json() as {
			prompt?: string;
			chatType?: string;
			resourceId?: string;
			threadId?: string;
		};

		const testPrompt = body.prompt || "Hello, how are you?";
		const chatType = body.chatType || "scenario";
		const resourceId = body.resourceId || "test-resource-" + Date.now();
		const threadId = body.threadId || "test-thread-" + Date.now();

		// Return streaming response
		return createSSEStream(async (controller) => {
			try {
				await generateChatResponse(
					{
						prompt: testPrompt,
						additionalContext: {
							chatType: {
								data: chatType,
							},
						},
						resourceId,
						threadId,
						streamController: controller,
					},
					env
				);
			} catch (error) {
				console.error("Error in test chat stream:", error);
				throw error;
			}
		});
	} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}

async function handleTestChat(request: Request, env: Env): Promise<Response> {
	try {
		const body = await request.json() as {
			prompt?: string;
			chatType?: "scenario" | "transcript";
			additionalContext?: any;
			resourceId?: string;
			threadId?: string;
		};

		const testPrompt = body.prompt || "Hello, how are you?";
		const resourceId = body.resourceId || "test-resource-" + Date.now();
		const threadId = body.threadId || "test-thread-" + Date.now();

		// Build additionalContext
		const additionalContext = body.additionalContext || {
			chatType: {
				data: body.chatType || "scenario",
			},
		};

		// Test default agent
		const result = await generateChatResponse(
			{
				prompt: testPrompt,
				temperature: 0.7,
				maxTokens: 500,
				additionalContext,
				resourceId,
				threadId,
			},
			env
		);

		return new Response(
			JSON.stringify({
				success: true,
				defaultAgent: {
					prompt: testPrompt,
					chatType: additionalContext.chatType?.data,
					hasResponse: !!result.content,
					responseLength: result.content?.length || 0,
					responsePreview: result.content?.substring(0, 200) || "",
					resourceId,
					threadId,
				},
			}),
			{
				headers: { "content-type": "application/json" },
			}
		);
	} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}

/**
 * Extract scores from summaryAnalysis text
 * Looks for RATING section with format: "- Category: [score]"
 */
function extractScoresFromSummary(summaryAnalysis: string): Record<string, number> | null {
	try {
		const ratingMatch = summaryAnalysis.match(/##\s*RATING\s*([\s\S]*?)(?=##|$)/i);
		if (!ratingMatch) {
			console.log('[extractScoresFromSummary] No RATING section found');
			return null;
		}

		const ratingText = ratingMatch[1];
		const scores: Record<string, number> = {};

		// Parse lines like "- Empathy: 85" or "- Clarity: 90"
		const lines = ratingText.split('\n').map(l => l.trim()).filter(Boolean);
		for (const line of lines) {
			const match = line.match(/[-*]\s*([^:]+):\s*(\d+)/i);
			if (match) {
				const category = match[1].trim().toLowerCase().replace(/[\s\-_]+/g, '');
				const score = parseInt(match[2], 10);
				
				// Map category names to expected keys
				if (category.includes('empathy')) {
					scores.empathy = score;
				} else if (category.includes('clarity')) {
					scores.clarity = score;
				} else if (category.includes('assertiveness')) {
					scores.assertiveness = score;
				} else if (category.includes('persuasion')) {
					scores.persuasion = score;
				} else if (category.includes('activelistening') || (category.includes('active') && category.includes('listening'))) {
					scores.activeListening = score;
				} else if (category.includes('objectionhandling') || (category.includes('objection') && category.includes('handling'))) {
					scores.objectionHandling = score;
				} else if (category.includes('closingability') || (category.includes('closing') && category.includes('ability'))) {
					scores.closingAbility = score;
				} else if (category.includes('flexibility') || category.includes('flexible')) {
					scores.flexibility = score;
				} else if (category.includes('openmindedness') || category.includes('openminded') || (category.includes('open') && category.includes('mind'))) {
					// Map old "open-mindedness" to flexibility for backward compatibility
					scores.flexibility = score;
				}
			}
		}

		return Object.keys(scores).length > 0 ? scores : null;
	} catch (error) {
		console.error('[extractScoresFromSummary] Error extracting scores:', error);
		return null;
	}
}

/**
 * Handle feedback orchestrator workflow
 */
async function handleFeedbackWorkflow(request: Request, env: Env): Promise<Response> {
	try {
		const body = await request.json() as {
			transcript: string;
			additionalContext?: any;
			resourceId?: string;
			threadId?: string;
			scenarioId?: string;
			scenarioData?: any;
		};

		console.log('[handleFeedbackWorkflow] Request received:', {
			hasTranscript: !!body.transcript,
			transcriptLength: body.transcript?.length || 0,
			resourceId: body.resourceId,
			threadId: body.threadId,
		});

		if (!body.transcript) {
			console.error('[handleFeedbackWorkflow] Missing transcript');
			return new Response(
				JSON.stringify({ success: false, error: "Transcript is required" }),
				{
					status: 400,
					headers: { "content-type": "application/json" },
				}
			);
		}

		if (!body.resourceId || !body.threadId) {
			console.error('[handleFeedbackWorkflow] Missing resourceId or threadId');
			return new Response(
				JSON.stringify({ success: false, error: "resourceId and threadId are required" }),
				{
					status: 400,
					headers: { "content-type": "application/json" },
				}
			);
		}


		console.log('[handleFeedbackWorkflow] Executing workflow...');
		const startTime = Date.now();

		// Build additionalContext with scenario data if provided
		const additionalContext = {
			...(body.additionalContext || {}),
			scenarioId: body.scenarioId,
			scenarioData: body.scenarioData,
		};

		// Execute workflow
		const result = await executeFeedbackOrchestrator(
			{
				transcript: body.transcript,
				additionalContext: additionalContext,
				resourceId: body.resourceId,
				threadId: body.threadId,
			},
			env
		);

		const duration = Date.now() - startTime;
		console.log('[handleFeedbackWorkflow] Workflow completed in', duration, 'ms');
		console.log('[handleFeedbackWorkflow] Result:', {
			hasSegmentedAnalysis: !!result.segmentedAnalysis,
			hasSummaryAnalysis: !!result.summaryAnalysis,
			hasDetailedFeedback: !!result.detailedFeedback,
			hasCombinedReport: !!result.combinedReport,
		});

		if (!result.summaryAnalysis || !result.detailedFeedback) {
			console.error('[handleFeedbackWorkflow] Workflow result is incomplete');
			return new Response(
				JSON.stringify({
					success: false,
					error: "Feedback generation completed but result is incomplete",
				}),
				{
					status: 500,
					headers: { "content-type": "application/json" },
				}
			);
		}

		// Save feedback report and scores to database
		console.log('[handleFeedbackWorkflow] Saving feedback report to database...');
		const memoryManager = new MemoryManager(env);
		
		try {
			// Ensure conversation exists (create if needed)
			await memoryManager.getOrCreateThread(body.resourceId, body.threadId);
			console.log('[handleFeedbackWorkflow] Conversation ensured');
			
			// Save feedback report
			await memoryManager.saveFeedbackReport(
				body.resourceId,
				body.threadId,
				{
					segmentedAnalysis: result.segmentedAnalysis || "",
					summaryAnalysis: result.summaryAnalysis,
					detailedFeedback: result.detailedFeedback,
				}
			);
			console.log('[handleFeedbackWorkflow] Feedback report saved successfully');

			// Extract scores from summaryAnalysis and save
			const extractedScores = extractScoresFromSummary(result.summaryAnalysis);
			if (extractedScores && Object.keys(extractedScores).length > 0) {
				console.log('[handleFeedbackWorkflow] Extracted scores:', extractedScores);
				// Ensure required fields are present with defaults
				const scores = {
					empathy: extractedScores.empathy || 0,
					clarity: extractedScores.clarity || 0,
					assertiveness: extractedScores.assertiveness || 0,
					activeListening: extractedScores.activeListening || 0,
					persuasion: extractedScores.persuasion,
					objectionHandling: extractedScores.objectionHandling,
					closingAbility: extractedScores.closingAbility,
					flexibility: extractedScores.flexibility, // New field
				};
				await memoryManager.saveScores(
					body.resourceId,
					scores,
					body.scenarioId
				);
				console.log('[handleFeedbackWorkflow] Scores saved successfully');
			} else {
				console.warn('[handleFeedbackWorkflow] No scores extracted from summaryAnalysis');
			}
		} catch (dbError) {
			console.error('[handleFeedbackWorkflow] Error saving to database:', dbError);
			// Don't fail the request if DB save fails, but log it
		}

		return new Response(
			JSON.stringify({
				success: true,
				...result,
			}),
			{
				headers: { "content-type": "application/json" },
			}
		);
	} catch (error) {
		console.error('[handleFeedbackWorkflow] Error:', error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Internal error",
			}),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}

/**
 * Test feedback orchestrator workflow
 */
/**
 * Get sessions list for a resource
 * GET /api/sessions?resourceId=xxx
 */
async function handleGetSessions(request: Request, env: Env): Promise<Response> {
	try {
		const url = new URL(request.url);
		const resourceId = url.searchParams.get("resourceId");

		if (!resourceId) {
			return new Response(
				JSON.stringify({ success: false, error: "resourceId is required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}

		const memoryManager = new MemoryManager(env);
		const conversations = await memoryManager.getConversations(resourceId);
		const feedbackReports = await memoryManager.getFeedbackReports(resourceId);
		const scores = await memoryManager.getUserScores(resourceId);

		// Combine conversations with their feedback reports and scores
		// Only include sessions that have a feedback report (no dummy/empty sessions)
		const sessions = conversations
			.map((conv) => {
				const report = feedbackReports.find((r) => r.threadId === conv.threadId);
				
				// Skip sessions without a feedback report
				if (!report) {
					return null;
				}

				const score = scores.find((s) => s.resourceId === conv.resourceId);

				// Extract summary from report if available
				let summary: string | undefined;
				if (report?.summaryAnalysis) {
					const summaryMatch = report.summaryAnalysis.match(
						/##\s*USER PERFORMANCE ANALYSIS\s*([\s\S]*?)(?=(?:##|$))/i
					);
					summary = summaryMatch ? summaryMatch[1].trim().substring(0, 200) + "..." : undefined;
				}

				// Only include if we have a summary
				if (!summary) {
					return null;
				}

				// Extract scores (match by resourceId and closest timestamp)
				const sessionScores: Record<string, number> = {};
				const scoreForSession = scores
					.filter((s) => s.resourceId === conv.resourceId)
					.sort((a, b) => Math.abs(a.createdAt - conv.createdAt) - Math.abs(b.createdAt - conv.createdAt))[0];
				
				if (scoreForSession) {
					if (scoreForSession.empathy) sessionScores.empathy = scoreForSession.empathy;
					if (scoreForSession.clarity) sessionScores.clarity = scoreForSession.clarity;
					if (scoreForSession.assertiveness) sessionScores.assertiveness = scoreForSession.assertiveness;
					if (scoreForSession.persuasion) sessionScores.persuasion = scoreForSession.persuasion;
					if (scoreForSession.activeListening) sessionScores.activeListening = scoreForSession.activeListening;
					if (scoreForSession.objectionHandling) sessionScores.objectionHandling = scoreForSession.objectionHandling;
					if (scoreForSession.closingAbility) sessionScores.closingAbility = scoreForSession.closingAbility;
					// Legacy fields for backward compatibility
					if (scoreForSession.flexibility !== undefined) sessionScores.flexibility = scoreForSession.flexibility;
					// Backward compatibility
					if (scoreForSession.openMindedness !== undefined && !sessionScores.flexibility) {
						sessionScores.flexibility = scoreForSession.openMindedness;
					}
					if (scoreForSession.conflictManagement) sessionScores.conflictManagement = scoreForSession.conflictManagement;
				}

				return {
					id: conv.id,
					threadId: conv.threadId,
					createdAt: conv.createdAt,
					updatedAt: conv.updatedAt,
					scenarioId: scoreForSession?.scenarioId || undefined,
					scenarioType: "Sales Practice",
					scores: Object.keys(sessionScores).length > 0 ? sessionScores : undefined,
					summary: summary,
					summaryAnalysis: report.summaryAnalysis,
				};
			})
			.filter((session): session is NonNullable<typeof session> => session !== null);

		return new Response(
			JSON.stringify({ success: true, sessions }),
			{ headers: { "Content-Type": "application/json" } }
		);
	} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Internal error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		);
	}
}

/**
 * Get feedback report by thread ID
 * GET /api/report/:threadId
 */
async function handleGetReport(request: Request, env: Env): Promise<Response> {
	try {
		const url = new URL(request.url);
		const threadId = url.pathname.split("/").pop();

		if (!threadId) {
			return new Response(
				JSON.stringify({ success: false, error: "threadId is required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}

		const memoryManager = new MemoryManager(env);
		const report = await memoryManager.getFeedbackReportByThreadId(threadId);

		if (!report) {
			return new Response(
				JSON.stringify({ success: false, error: "Report not found" }),
				{ status: 404, headers: { "Content-Type": "application/json" } }
			);
		}

		// Format response to match what frontend expects
		const response = {
			success: true,
			report: {
				segmentedAnalysis: report.segmentedAnalysis,
				summaryAnalysis: report.summaryAnalysis,
				detailedFeedback: report.detailedFeedback,
				combinedReport: `${report.summaryAnalysis}\n\n${report.detailedFeedback}`,
			},
		};

		return new Response(JSON.stringify(response), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Internal error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		);
	}
}

async function handleTestFeedback(request: Request, env: Env): Promise<Response> {
	try {
		const body = await request.json() as {
			transcript?: string;
			resourceId?: string;
			threadId?: string;
		};

		const testTranscript = body.transcript || `user: Hi, I wanted to discuss the project timeline.
bart: Sure, what's on your mind?
user: I think we need to push the deadline back by two weeks.
bart: I understand, but that might be difficult given our commitments.
user: I know, but we're running into some technical challenges that need more time.
bart: I understand your concerns. Let's look at what we can do to address these challenges.`;

		const resourceId = body.resourceId || "test-resource-" + Date.now();
		const threadId = body.threadId || "test-thread-" + Date.now();

		console.log("Starting feedback orchestrator workflow...");
		const startTime = Date.now();

		// Execute workflow
		const result = await executeFeedbackOrchestrator(
			{
				transcript: testTranscript,
				resourceId,
				threadId,
			},
			env
		);

		const endTime = Date.now();
		const duration = endTime - startTime;

		return new Response(
			JSON.stringify({
				success: true,
				workflow: {
					transcript: testTranscript,
					duration: `${duration}ms`,
					steps: {
						analyzeTranscript: {
							success: !!result.segmentedAnalysis,
							length: result.segmentedAnalysis?.length || 0,
							preview: result.segmentedAnalysis?.substring(0, 200) || "",
						},
						generateSummary: {
							success: !!result.summaryAnalysis,
							length: result.summaryAnalysis?.length || 0,
							preview: result.summaryAnalysis?.substring(0, 200) || "",
						},
						analyzeDetails: {
							success: !!result.detailedFeedback,
							length: result.detailedFeedback?.length || 0,
							preview: result.detailedFeedback?.substring(0, 200) || "",
						},
						combinedReport: {
							success: !!result.combinedReport,
							length: result.combinedReport?.length || 0,
							preview: result.combinedReport?.substring(0, 300) || "",
						},
					},
					resourceId,
					threadId,
				},
			}),
			{
				headers: { "content-type": "application/json" },
			}
		);
	} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}
