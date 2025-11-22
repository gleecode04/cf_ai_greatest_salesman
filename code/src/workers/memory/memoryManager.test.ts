/**
 * MemoryManager Modular Tests
 * 
 * Tests each method individually to ensure proper functionality
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryManager } from "./memoryManager";
import { Env } from "../../types";

// Mock D1 Database for testing
function createMockEnv(): Env {
	const conversations: any[] = [];
	const messages: any[] = [];
	const feedbackReports: any[] = [];
	const userScores: any[] = [];
	const scenarios: any[] = [];
	let timestampCounter = Date.now(); // Ensure unique timestamps

	return {
		DB: {
			prepare: (query: string) => {
				return {
					bind: (...args: any[]) => {
						return {
							all: async () => {
								if (query.includes("SELECT name FROM sqlite_master")) {
									return {
										results: [
											{ name: "conversations" },
											{ name: "messages" },
											{ name: "feedback_reports" },
											{ name: "user_scores" },
											{ name: "scenarios" },
										],
									};
								}
								if (query.includes("SELECT * FROM messages WHERE thread_id")) {
									const threadId = args[0];
									const limit = args[1] || 5;
									const threadMessages = messages
										.filter((m) => m.thread_id === threadId)
										.sort((a, b) => b.created_at - a.created_at)
										.slice(0, limit);
									// Return in reverse order (chronological) - matching implementation
									return { results: threadMessages.reverse() };
								}
								if (query.includes("SELECT * FROM conversations WHERE thread_id")) {
									const threadId = args[0];
									const thread = conversations.find((c) => c.thread_id === threadId);
									return thread ? { first: async () => thread } : { first: async () => null };
								}
								if (query.includes("SELECT * FROM user_scores WHERE resource_id")) {
									const resourceId = args[0];
									const sorted = userScores
										.filter((s) => s.resource_id === resourceId)
										.sort((a, b) => b.created_at - a.created_at);
									const score = sorted.length > 0 ? sorted[0] : null;
									return { first: async () => score };
								}
								if (query.includes("SELECT * FROM scenarios WHERE resource_id")) {
									const resourceId = args[0];
									const sorted = scenarios
										.filter((s) => s.resource_id === resourceId)
										.sort((a, b) => b.created_at - a.created_at);
									const scenario = sorted.length > 0 ? sorted[0] : null;
									return { first: async () => scenario };
								}
								return { results: [] };
							},
							first: async () => {
								if (query.includes("SELECT * FROM conversations WHERE thread_id")) {
									const threadId = args[0];
									return conversations.find((c) => c.thread_id === threadId) || null;
								}
								if (query.includes("SELECT * FROM user_scores WHERE resource_id")) {
									const resourceId = args[0];
									const sorted = userScores
										.filter((s) => s.resource_id === resourceId)
										.sort((a, b) => b.created_at - a.created_at);
									return sorted.length > 0 ? sorted[0] : null;
								}
								if (query.includes("SELECT * FROM scenarios WHERE resource_id")) {
									const resourceId = args[0];
									const sorted = scenarios
										.filter((s) => s.resource_id === resourceId)
										.sort((a, b) => b.created_at - a.created_at);
									return sorted.length > 0 ? sorted[0] : null;
								}
								return null;
							},
							run: async () => {
								if (query.includes("INSERT INTO conversations")) {
									const [id, resourceId, threadId, createdAt, updatedAt] = args;
									// Use provided timestamp or generate unique one
									const ts = createdAt || timestampCounter++;
									conversations.push({ id, resource_id: resourceId, thread_id: threadId, created_at: ts, updated_at: updatedAt || ts });
								}
								if (query.includes("INSERT INTO messages")) {
									const [id, threadId, role, content, createdAt] = args;
									const ts = createdAt || timestampCounter++;
									messages.push({ id, thread_id: threadId, role, content, created_at: ts });
								}
								if (query.includes("INSERT INTO feedback_reports")) {
									const [id, resourceId, threadId, segmentedAnalysis, summaryAnalysis, detailedFeedback, createdAt] = args;
									const ts = createdAt || timestampCounter++;
									feedbackReports.push({
										id,
										resource_id: resourceId,
										thread_id: threadId,
										segmented_analysis: segmentedAnalysis,
										summary_analysis: summaryAnalysis,
										detailed_feedback: detailedFeedback,
										created_at: ts,
									});
								}
								if (query.includes("INSERT INTO user_scores")) {
									const [id, resourceId, scenarioId, empathy, clarity, assertiveness, flexibility, activeListening, conflictManagement, createdAt] = args;
									const ts = createdAt || timestampCounter++;
									userScores.push({
										id,
										resource_id: resourceId,
										scenario_id: scenarioId,
										empathy,
										clarity,
										assertiveness,
										flexibility: flexibility,
										open_mindedness: flexibility, // Keep for backward compatibility
										active_listening: activeListening,
										conflict_management: conflictManagement,
										created_at: ts,
									});
								}
								if (query.includes("INSERT INTO scenarios")) {
									const [id, resourceId, scenarioData, prompts, reports, createdAt] = args;
									const ts = createdAt || timestampCounter++;
									scenarios.push({
										id,
										resource_id: resourceId,
										scenario_data: scenarioData,
										prompts,
										reports,
										created_at: ts,
									});
								}
								return { success: true };
							},
						};
					},
				};
			},
		} as any,
		SESSIONS: {} as any,
		AI: {} as any,
		ASSETS: {} as any,
	};
}

describe("MemoryManager", () => {
	let memoryManager: MemoryManager;
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
		memoryManager = new MemoryManager(env);
	});

	describe("getOrCreateThread", () => {
		it("should create a new thread when none exists", async () => {
			const resourceId = "test-resource-1";
			const result = await memoryManager.getOrCreateThread(resourceId);

			expect(result).toHaveProperty("resourceId", resourceId);
			expect(result).toHaveProperty("threadId");
			expect(result).toHaveProperty("createdAt");
			expect(result).toHaveProperty("updatedAt");
			expect(typeof result.threadId).toBe("string");
			expect(result.threadId.length).toBeGreaterThan(0);
		});

		it("should return existing thread when threadId is provided", async () => {
			const resourceId = "test-resource-2";
			const existingThreadId = "existing-thread-123";

			// Create thread first
			const created = await memoryManager.getOrCreateThread(resourceId, existingThreadId);
			const firstCreatedAt = created.createdAt;

			// Try to get it again
			const retrieved = await memoryManager.getOrCreateThread(resourceId, existingThreadId);

			expect(retrieved.threadId).toBe(existingThreadId);
			expect(retrieved.createdAt).toBe(firstCreatedAt);
		});

		it("should generate new threadId when not provided", async () => {
			const resourceId = "test-resource-3";
			const result1 = await memoryManager.getOrCreateThread(resourceId);
			const result2 = await memoryManager.getOrCreateThread(resourceId);

			expect(result1.threadId).not.toBe(result2.threadId);
		});
	});

	describe("addMessage", () => {
		it("should add a message successfully", async () => {
			const resourceId = "test-resource-4";
			const thread = await memoryManager.getOrCreateThread(resourceId);

			const message = await memoryManager.addMessage(thread.threadId, "user", "Test message");

			expect(message).toHaveProperty("id");
			expect(message).toHaveProperty("threadId", thread.threadId);
			expect(message).toHaveProperty("role", "user");
			expect(message).toHaveProperty("content", "Test message");
			expect(message).toHaveProperty("createdAt");
			expect(typeof message.id).toBe("string");
			expect(message.id.length).toBeGreaterThan(0);
		});

		it("should generate unique IDs for each message", async () => {
			const resourceId = "test-resource-5";
			const thread = await memoryManager.getOrCreateThread(resourceId);

			const msg1 = await memoryManager.addMessage(thread.threadId, "user", "Message 1");
			const msg2 = await memoryManager.addMessage(thread.threadId, "assistant", "Message 2");

			expect(msg1.id).not.toBe(msg2.id);
		});

		it("should store different roles correctly", async () => {
			const resourceId = "test-resource-6";
			const thread = await memoryManager.getOrCreateThread(resourceId);

			const userMsg = await memoryManager.addMessage(thread.threadId, "user", "User message");
			const assistantMsg = await memoryManager.addMessage(thread.threadId, "assistant", "Assistant message");
			const systemMsg = await memoryManager.addMessage(thread.threadId, "system", "System message");

			expect(userMsg.role).toBe("user");
			expect(assistantMsg.role).toBe("assistant");
			expect(systemMsg.role).toBe("system");
		});
	});

	describe("getLastMessages", () => {
		it("should return empty array when no messages exist", async () => {
			const resourceId = "test-resource-7";
			const thread = await memoryManager.getOrCreateThread(resourceId);

			const messages = await memoryManager.getLastMessages(thread.threadId);

			expect(messages).toEqual([]);
		});

		it("should return last 5 messages by default", async () => {
			const resourceId = "test-resource-8";
			const thread = await memoryManager.getOrCreateThread(resourceId);

			// Add 7 messages sequentially with delays to ensure unique timestamps
			for (let i = 1; i <= 7; i++) {
				await memoryManager.addMessage(thread.threadId, "user", `Message ${i}`);
				// Delay to ensure different timestamps
				await new Promise(resolve => setTimeout(resolve, 15));
			}

			const messages = await memoryManager.getLastMessages(thread.threadId);

			expect(messages.length).toBe(5);
			// Should return last 5 messages (should include Message 7, the most recent)
			const contents = messages.map(m => m.content);
			expect(contents).toContain("Message 7");
			expect(contents.length).toBe(5);
			// Verify it doesn't include Message 1 or 2 (should be filtered out)
			expect(contents).not.toContain("Message 1");
			expect(contents).not.toContain("Message 2");
		});

		it("should return messages in chronological order", async () => {
			const resourceId = "test-resource-9";
			const thread = await memoryManager.getOrCreateThread(resourceId);

			await memoryManager.addMessage(thread.threadId, "user", "First");
			await memoryManager.addMessage(thread.threadId, "user", "Second");
			await memoryManager.addMessage(thread.threadId, "user", "Third");

			const messages = await memoryManager.getLastMessages(thread.threadId, 10);

			expect(messages.length).toBe(3);
			expect(messages[0].content).toBe("First");
			expect(messages[1].content).toBe("Second");
			expect(messages[2].content).toBe("Third");
		});

		it("should respect custom limit", async () => {
			const resourceId = "test-resource-10";
			const thread = await memoryManager.getOrCreateThread(resourceId);

			for (let i = 1; i <= 10; i++) {
				await memoryManager.addMessage(thread.threadId, "user", `Message ${i}`);
			}

			const messages = await memoryManager.getLastMessages(thread.threadId, 3);

			expect(messages.length).toBe(3);
		});
	});

	describe("saveFeedbackReport", () => {
		it("should save feedback report successfully", async () => {
			const resourceId = "test-resource-11";
			const thread = await memoryManager.getOrCreateThread(resourceId);

			const reportId = await memoryManager.saveFeedbackReport(resourceId, thread.threadId, {
				segmentedAnalysis: "Segment 1: Good communication",
				summaryAnalysis: "Overall positive interaction",
				detailedFeedback: "Detailed feedback here",
			});

			expect(typeof reportId).toBe("string");
			expect(reportId.length).toBeGreaterThan(0);
		});

		it("should generate unique IDs for each report", async () => {
			const resourceId = "test-resource-12";
			const thread = await memoryManager.getOrCreateThread(resourceId);

			const id1 = await memoryManager.saveFeedbackReport(resourceId, thread.threadId, {
				segmentedAnalysis: "Report 1",
				summaryAnalysis: "Summary 1",
				detailedFeedback: "Details 1",
			});

			const id2 = await memoryManager.saveFeedbackReport(resourceId, thread.threadId, {
				segmentedAnalysis: "Report 2",
				summaryAnalysis: "Summary 2",
				detailedFeedback: "Details 2",
			});

			expect(id1).not.toBe(id2);
		});
	});

	describe("saveScores", () => {
		it("should save scores successfully", async () => {
			const resourceId = "test-resource-13";

			const scoreId = await memoryManager.saveScores(resourceId, {
				empathy: 85,
				clarity: 90,
				assertiveness: 75,
				flexibility: 80,
				activeListening: 88,
				conflictManagement: 82,
			});

			expect(typeof scoreId).toBe("string");
			expect(scoreId.length).toBeGreaterThan(0);
		});

		it("should save scores with optional scenarioId", async () => {
			const resourceId = "test-resource-14";
			const scenarioId = "scenario-123";

			const scoreId = await memoryManager.saveScores(
				resourceId,
				{
					empathy: 85,
					clarity: 90,
					assertiveness: 75,
					flexibility: 80,
					activeListening: 88,
					conflictManagement: 82,
				},
				scenarioId
			);

			expect(typeof scoreId).toBe("string");
		});

		it("should handle all score values correctly", async () => {
			const resourceId = "test-resource-15";

			const scoreId = await memoryManager.saveScores(resourceId, {
				empathy: 0,
				clarity: 50,
				assertiveness: 100,
				openMindedness: 25,
				activeListening: 75,
				conflictManagement: 33,
			});

			expect(scoreId).toBeDefined();
		});
	});

	describe("getPreviousScores", () => {
		it("should return null when no scores exist", async () => {
			const resourceId = "test-resource-16";

			const scores = await memoryManager.getPreviousScores(resourceId);

			expect(scores).toBeNull();
		});

		it("should return latest scores for resource", async () => {
			const resourceId = "test-resource-17";

			// Add small delay to ensure different timestamps
			await memoryManager.saveScores(resourceId, {
				empathy: 70,
				clarity: 80,
				assertiveness: 75,
				openMindedness: 65,
				activeListening: 85,
				conflictManagement: 70,
			});

			// Small delay to ensure different timestamp
			await new Promise(resolve => setTimeout(resolve, 10));

			await memoryManager.saveScores(resourceId, {
				empathy: 85,
				clarity: 90,
				assertiveness: 80,
				openMindedness: 75,
				activeListening: 88,
				conflictManagement: 82,
			});

			const latest = await memoryManager.getPreviousScores(resourceId);

			expect(latest).toBeDefined();
			expect(latest?.empathy).toBe(85); // Should be the latest
		});
	});

	describe("saveScenario", () => {
		it("should save scenario successfully", async () => {
			const resourceId = "test-resource-18";

			const scenarioId = await memoryManager.saveScenario(resourceId, {
				scenario: { title: "Test Scenario", description: "A test" },
				prompts: { system: "You are a helpful assistant" },
				reports: { summary: "Test report" },
			});

			expect(typeof scenarioId).toBe("string");
			expect(scenarioId.length).toBeGreaterThan(0);
		});

		it("should JSON stringify scenario data", async () => {
			const resourceId = "test-resource-19";

			const scenarioData = {
				scenario: { complex: { nested: { data: [1, 2, 3] } } },
				prompts: { array: ["a", "b", "c"] },
				reports: { number: 42 },
			};

			const scenarioId = await memoryManager.saveScenario(resourceId, scenarioData);

			expect(scenarioId).toBeDefined();
		});
	});

	describe("getLatestScenario", () => {
		it("should return null when no scenario exists", async () => {
			const resourceId = "test-resource-20";

			const scenario = await memoryManager.getLatestScenario(resourceId);

			expect(scenario).toBeNull();
		});

		it("should return latest scenario with parsed JSON", async () => {
			const resourceId = "test-resource-21";

			const scenarioData = {
				scenario: { title: "Latest Scenario" },
				prompts: { system: "Latest prompt" },
				reports: { summary: "Latest report" },
			};

			await memoryManager.saveScenario(resourceId, scenarioData);

			const retrieved = await memoryManager.getLatestScenario(resourceId);

			expect(retrieved).toBeDefined();
			expect(retrieved?.scenario).toEqual(scenarioData.scenario);
			expect(retrieved?.prompts).toEqual(scenarioData.prompts);
			expect(retrieved?.reports).toEqual(scenarioData.reports);
		});

		it("should return most recent scenario when multiple exist", async () => {
			const resourceId = "test-resource-22";

			await memoryManager.saveScenario(resourceId, {
				scenario: { title: "First" },
				prompts: {},
				reports: {},
			});

			// Small delay to ensure different timestamp
			await new Promise(resolve => setTimeout(resolve, 10));

			await memoryManager.saveScenario(resourceId, {
				scenario: { title: "Second" },
				prompts: {},
				reports: {},
			});

			const latest = await memoryManager.getLatestScenario(resourceId);

			expect(latest?.scenario.title).toBe("Second");
		});
	});

	describe("Error Handling", () => {
		it("should handle database errors gracefully in getLastMessages", async () => {
			const brokenEnv = {
				DB: {
					prepare: () => ({
						bind: () => ({
							all: async () => {
								throw new Error("Database error");
							},
						}),
					}),
				},
			} as any;

			const brokenManager = new MemoryManager(brokenEnv);
			const result = await brokenManager.getLastMessages("test-thread");

			expect(result).toEqual([]);
		});

		it("should throw errors in addMessage", async () => {
			const brokenEnv = {
				DB: {
					prepare: () => ({
						bind: () => ({
							run: async () => {
								throw new Error("Database error");
							},
						}),
					}),
				},
			} as any;

			const brokenManager = new MemoryManager(brokenEnv);

			await expect(brokenManager.addMessage("test-thread", "user", "test")).rejects.toThrow();
		});
	});
});

