/**
 * Session Manager
 * 
 * Manages session state using Cloudflare KV namespace.
 */

import { Env } from "../../types";

export class SessionManager {
  constructor(private env: Env) {}

  /**
   * Get resource ID for a session
   *  Get resource ID from storage
   * 
   * @param sessionId - Session identifier
   * @returns Resource ID string or null if not found
   */
  async getResourceId(sessionId: string): Promise<string | null> {
    try {
      const resourceId = await this.env.SESSIONS.get(`session:${sessionId}:resourceId`);
      return resourceId;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Set resource ID for a session
   *  Set resource ID in storage
   * 
   * @param sessionId - Session identifier
   * @param resourceId - Resource ID (persistent 20-character identifier)
   * @param ttlSeconds - Optional TTL in seconds (default: 30 days)
   */
  async setResourceId(sessionId: string, resourceId: string, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds || 30 * 24 * 60 * 60; // Default 30 days
      await this.env.SESSIONS.put(`session:${sessionId}:resourceId`, resourceId, {
        expirationTtl: ttl,
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Get session data (JSON object)
   *  localStorage.getItem() for various keys
   * 
   * @param sessionId - Session identifier
   * @param key - Data key (e.g., "reportData", "scenarioData", "scores")
   * @returns Parsed JSON object or null if not found
   */
  async getSessionData<T = any>(sessionId: string, key: string): Promise<T | null> {
    try {
      const data = await this.env.SESSIONS.get(`session:${sessionId}:${key}`, "json");
      return data as T | null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Set session data (JSON object)
   *  localStorage.setItem() for various keys
   * 
   * @param sessionId - Session identifier
   * @param key - Data key (e.g., "reportData", "scenarioData", "scores")
   * @param data - Data object to store (will be JSON stringified)
   * @param ttlSeconds - Optional TTL in seconds (default: 7 days)
   */
  async setSessionData(sessionId: string, key: string, data: any, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds || 7 * 24 * 60 * 60; // Default 7 days
      await this.env.SESSIONS.put(`session:${sessionId}:${key}`, JSON.stringify(data), {
        expirationTtl: ttl,
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Delete session data
   *  localStorage.removeItem()
   * 
   * @param sessionId - Session identifier
   * @param key - Data key to delete
   */
  async deleteSessionData(sessionId: string, key: string): Promise<void> {
    try {
      await this.env.SESSIONS.delete(`session:${sessionId}:${key}`);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Generate a persistent resource ID (20-character base36)
   *  Matches resource ID generation from SidePanelCedarChat.tsx (lines 152-154)
   * Uses base36 (0-9, a-z) for random ID generation
   * 
   * @returns 20-character base36 string
   */
  static generateResourceId(): string {
    return Array.from({ length: 20 }, () =>
      Math.floor(Math.random() * 36).toString(36)
    ).join("");
  }

  /**
   * Get or create resource ID for a session
   *  Matches localStorage.getItem() || generate pattern
   * 
   * @param sessionId - Session identifier
   * @returns Resource ID (existing or newly generated)
   */
  async getOrCreateResourceId(sessionId: string): Promise<string> {
    try {
      let resourceId = await this.getResourceId(sessionId);
      
      if (!resourceId) {
        resourceId = SessionManager.generateResourceId();
        await this.setResourceId(sessionId, resourceId);
      }
      
      return resourceId;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

