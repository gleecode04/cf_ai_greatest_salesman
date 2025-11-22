/**
 * SessionManager Modular Tests
 * 
 * Tests each method individually to ensure proper functionality
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager } from "./sessionManager";
import { Env } from "../../types";

// Mock KV Namespace for testing
function createMockEnv(): Env {
	const kvStore: Map<string, { value: string; expiration?: number }> = new Map();

	return {
		SESSIONS: {
			get: async (key: string, type?: "text" | "json") => {
				const item = kvStore.get(key);
				if (!item) return null;
				
				// Check expiration
				if (item.expiration && Date.now() / 1000 > item.expiration) {
					kvStore.delete(key);
					return null;
				}

				if (type === "json") {
					try {
						return JSON.parse(item.value);
					} catch {
						return null;
					}
				}
				return item.value;
			},
			put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
				const expiration = options?.expirationTtl 
					? Math.floor(Date.now() / 1000) + options.expirationTtl 
					: undefined;
				kvStore.set(key, { value, expiration });
			},
			delete: async (key: string) => {
				kvStore.delete(key);
			},
			list: async () => ({ keys: [], cursor: "", complete: true }),
		} as any,
		DB: {} as any,
		AI: {} as any,
		ASSETS: {} as any,
	};
}

describe("SessionManager", () => {
	let sessionManager: SessionManager;
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
		sessionManager = new SessionManager(env);
	});

	describe("generateResourceId", () => {
		it("should generate a 20-character string", () => {
			const resourceId = SessionManager.generateResourceId();
			expect(resourceId.length).toBe(20);
		});

		it("should generate base36 characters only", () => {
			const resourceId = SessionManager.generateResourceId();
			expect(/^[a-z0-9]{20}$/.test(resourceId)).toBe(true);
		});

		it("should generate unique IDs", () => {
			const id1 = SessionManager.generateResourceId();
			const id2 = SessionManager.generateResourceId();
			expect(id1).not.toBe(id2);
		});
	});

	describe("setResourceId", () => {
		it("should store resource ID successfully", async () => {
			const sessionId = "test-session-1";
			const resourceId = SessionManager.generateResourceId();

			await sessionManager.setResourceId(sessionId, resourceId);

			const retrieved = await sessionManager.getResourceId(sessionId);
			expect(retrieved).toBe(resourceId);
		});

		it("should overwrite existing resource ID", async () => {
			const sessionId = "test-session-2";
			const resourceId1 = SessionManager.generateResourceId();
			const resourceId2 = SessionManager.generateResourceId();

			await sessionManager.setResourceId(sessionId, resourceId1);
			await sessionManager.setResourceId(sessionId, resourceId2);

			const retrieved = await sessionManager.getResourceId(sessionId);
			expect(retrieved).toBe(resourceId2);
		});
	});

	describe("getResourceId", () => {
		it("should return null when resource ID doesn't exist", async () => {
			const sessionId = "non-existent-session";
			const resourceId = await sessionManager.getResourceId(sessionId);
			expect(resourceId).toBeNull();
		});

		it("should return stored resource ID", async () => {
			const sessionId = "test-session-3";
			const resourceId = SessionManager.generateResourceId();

			await sessionManager.setResourceId(sessionId, resourceId);
			const retrieved = await sessionManager.getResourceId(sessionId);

			expect(retrieved).toBe(resourceId);
		});
	});

	describe("getOrCreateResourceId", () => {
		it("should return existing resource ID when present", async () => {
			const sessionId = "test-session-4";
			const existingResourceId = SessionManager.generateResourceId();

			await sessionManager.setResourceId(sessionId, existingResourceId);
			const retrieved = await sessionManager.getOrCreateResourceId(sessionId);

			expect(retrieved).toBe(existingResourceId);
		});

		it("should create new resource ID when not present", async () => {
			const sessionId = "test-session-5";

			const resourceId = await sessionManager.getOrCreateResourceId(sessionId);

			expect(resourceId).toBeDefined();
			expect(resourceId.length).toBe(20);
			expect(/^[a-z0-9]{20}$/.test(resourceId)).toBe(true);
		});

		it("should store newly created resource ID", async () => {
			const sessionId = "test-session-6";

			const resourceId1 = await sessionManager.getOrCreateResourceId(sessionId);
			const resourceId2 = await sessionManager.getOrCreateResourceId(sessionId);

			expect(resourceId1).toBe(resourceId2);
		});
	});

	describe("setSessionData", () => {
		it("should store JSON data successfully", async () => {
			const sessionId = "test-session-7";
			const data = { key: "value", number: 42, array: [1, 2, 3] };

			await sessionManager.setSessionData(sessionId, "testKey", data);

			const retrieved = await sessionManager.getSessionData(sessionId, "testKey");
			expect(retrieved).toEqual(data);
		});

		it("should overwrite existing data", async () => {
			const sessionId = "test-session-8";
			const data1 = { value: "first" };
			const data2 = { value: "second" };

			await sessionManager.setSessionData(sessionId, "testKey", data1);
			await sessionManager.setSessionData(sessionId, "testKey", data2);

			const retrieved = await sessionManager.getSessionData(sessionId, "testKey");
			expect(retrieved).toEqual(data2);
		});

		it("should handle complex nested objects", async () => {
			const sessionId = "test-session-9";
			const complexData = {
				reportData: {
					summary: "Test summary",
					detail: "Test detail",
					scores: { empathy: 85, clarity: 90 },
				},
				scenarioData: {
					scenario: { title: "Test" },
					prompts: {},
				},
			};

			await sessionManager.setSessionData(sessionId, "complexData", complexData);

			const retrieved = await sessionManager.getSessionData(sessionId, "complexData");
			expect(retrieved).toEqual(complexData);
		});
	});

	describe("getSessionData", () => {
		it("should return null when data doesn't exist", async () => {
			const sessionId = "test-session-10";
			const data = await sessionManager.getSessionData(sessionId, "nonExistentKey");
			expect(data).toBeNull();
		});

		it("should return stored data", async () => {
			const sessionId = "test-session-11";
			const data = { test: "value" };

			await sessionManager.setSessionData(sessionId, "testKey", data);
			const retrieved = await sessionManager.getSessionData(sessionId, "testKey");

			expect(retrieved).toEqual(data);
		});

		it("should handle different data types", async () => {
			const sessionId = "test-session-12";

			await sessionManager.setSessionData(sessionId, "string", "test");
			await sessionManager.setSessionData(sessionId, "number", 42);
			await sessionManager.setSessionData(sessionId, "boolean", true);
			await sessionManager.setSessionData(sessionId, "array", [1, 2, 3]);
			await sessionManager.setSessionData(sessionId, "object", { key: "value" });

			expect(await sessionManager.getSessionData(sessionId, "string")).toBe("test");
			expect(await sessionManager.getSessionData(sessionId, "number")).toBe(42);
			expect(await sessionManager.getSessionData(sessionId, "boolean")).toBe(true);
			expect(await sessionManager.getSessionData(sessionId, "array")).toEqual([1, 2, 3]);
			expect(await sessionManager.getSessionData(sessionId, "object")).toEqual({ key: "value" });
		});
	});

	describe("deleteSessionData", () => {
		it("should delete existing data", async () => {
			const sessionId = "test-session-13";
			const data = { test: "value" };

			await sessionManager.setSessionData(sessionId, "testKey", data);
			await sessionManager.deleteSessionData(sessionId, "testKey");

			const retrieved = await sessionManager.getSessionData(sessionId, "testKey");
			expect(retrieved).toBeNull();
		});

		it("should not throw error when deleting non-existent data", async () => {
			const sessionId = "test-session-14";

			await expect(
				sessionManager.deleteSessionData(sessionId, "nonExistentKey")
			).resolves.not.toThrow();
		});

		it("should only delete specified key", async () => {
			const sessionId = "test-session-15";

			await sessionManager.setSessionData(sessionId, "key1", { value: 1 });
			await sessionManager.setSessionData(sessionId, "key2", { value: 2 });

			await sessionManager.deleteSessionData(sessionId, "key1");

			expect(await sessionManager.getSessionData(sessionId, "key1")).toBeNull();
			expect(await sessionManager.getSessionData(sessionId, "key2")).toEqual({ value: 2 });
		});
	});

	describe("Error Handling", () => {
		it("should handle KV errors gracefully in getResourceId", async () => {
			const brokenEnv = {
				SESSIONS: {
					get: async () => {
						throw new Error("KV error");
					},
				},
			} as any;

			const brokenManager = new SessionManager(brokenEnv);
			const result = await brokenManager.getResourceId("test");

			expect(result).toBeNull();
		});

		it("should throw errors in setResourceId", async () => {
			const brokenEnv = {
				SESSIONS: {
					put: async () => {
						throw new Error("KV error");
					},
				},
			} as any;

			const brokenManager = new SessionManager(brokenEnv);

			await expect(
				brokenManager.setResourceId("test", "resource-id")
			).rejects.toThrow();
		});
	});
});

