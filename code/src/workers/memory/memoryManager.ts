/**
 * Memory Manager
 * 
 * Manages conversation memory and state persistence using D1 Database.
 */

import { Env } from "../../types";

export class MemoryManager {
  constructor(private env: Env) {}

  /**
   * Get last N messages for a thread
   */
  async getLastMessages(threadId: string, limit: number = 5) {
    try {
      const result = await this.env.DB.prepare(
        "SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT ?"
      )
        .bind(threadId, limit)
        .all();

      // Return in chronological order (reverse the DESC order)
      return result.results.reverse();
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  /**
   * Add a message to the database
   */
  async addMessage(
    threadId: string,
    role: string,
    content: string
  ): Promise<{ id: string; threadId: string; role: string; content: string; createdAt: number }> {
    try {
      const id = crypto.randomUUID();
      const createdAt = Date.now();

      await this.env.DB.prepare(
        "INSERT INTO messages (id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(id, threadId, role, content, createdAt)
        .run();

      return { id, threadId, role, content, createdAt };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Get or create a conversation thread
   */
  async getOrCreateThread(
    resourceId: string,
    threadId?: string
  ): Promise<{ resourceId: string; threadId: string; createdAt: number; updatedAt: number }> {
    try {
      // If threadId provided, check if exists
      if (threadId) {
        const thread = await this.env.DB.prepare(
          "SELECT * FROM conversations WHERE thread_id = ?"
        )
          .bind(threadId)
          .first();

        if (thread) {
          return {
            resourceId: thread.resource_id as string,
            threadId: thread.thread_id as string,
            createdAt: thread.created_at as number,
            updatedAt: thread.updated_at as number,
          };
        }
      }

      // Create new thread
      const newThreadId = threadId || crypto.randomUUID();
      const createdAt = Date.now();

      await this.env.DB.prepare(
        "INSERT INTO conversations (id, resource_id, thread_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(crypto.randomUUID(), resourceId, newThreadId, createdAt, createdAt)
        .run();

      return {
        resourceId,
        threadId: newThreadId,
        createdAt,
        updatedAt: createdAt,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Save feedback report
   */
  async saveFeedbackReport(
    resourceId: string,
    threadId: string,
    report: {
      segmentedAnalysis: string;
      summaryAnalysis: string;
      detailedFeedback: string;
    }
  ): Promise<string> {
    try {
      const id = crypto.randomUUID();
      const createdAt = Date.now();

      await this.env.DB.prepare(
        "INSERT INTO feedback_reports (id, resource_id, thread_id, segmented_analysis, summary_analysis, detailed_feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          id,
          resourceId,
          threadId,
          report.segmentedAnalysis,
          report.summaryAnalysis,
          report.detailedFeedback,
          createdAt
        )
        .run();

      return id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Get feedback reports for a resource (matching localStorage.getItem("reportData") pattern)
   * Returns list of reports ordered by creation date (newest first)
   */
  async getFeedbackReports(resourceId: string, limit: number = 50) {
    try {
      const result = await this.env.DB.prepare(
        "SELECT * FROM feedback_reports WHERE resource_id = ? ORDER BY created_at DESC LIMIT ?"
      )
        .bind(resourceId, limit)
        .all();

      return result.results.map((row: any) => ({
        id: row.id,
        resourceId: row.resource_id,
        threadId: row.thread_id,
        segmentedAnalysis: row.segmented_analysis,
        summaryAnalysis: row.summary_analysis,
        detailedFeedback: row.detailed_feedback,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  /**
   * Get feedback report by thread ID
   */
  async getFeedbackReportByThreadId(threadId: string) {
    try {
      const result = await this.env.DB.prepare(
        "SELECT * FROM feedback_reports WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1"
      )
        .bind(threadId)
        .first();

      if (!result) return null;

      return {
        id: (result as any).id,
        resourceId: (result as any).resource_id,
        threadId: (result as any).thread_id,
        segmentedAnalysis: (result as any).segmented_analysis,
        summaryAnalysis: (result as any).summary_analysis,
        detailedFeedback: (result as any).detailed_feedback,
        createdAt: (result as any).created_at,
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Get conversations for a resource (for session history)
   */
  async getConversations(resourceId: string, limit: number = 50) {
    try {
      const result = await this.env.DB.prepare(
        "SELECT * FROM conversations WHERE resource_id = ? ORDER BY updated_at DESC LIMIT ?"
      )
        .bind(resourceId, limit)
        .all();

      return result.results.map((row: any) => ({
        id: row.id,
        resourceId: row.resource_id,
        threadId: row.thread_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  /**
   * Get user scores for a resource (for trends/profile)
   */
  async getUserScores(resourceId: string, limit: number = 50) {
    try {
      const result = await this.env.DB.prepare(
        "SELECT * FROM user_scores WHERE resource_id = ? ORDER BY created_at DESC LIMIT ?"
      )
        .bind(resourceId, limit)
        .all();

      return result.results.map((row: any) => ({
        id: row.id,
        resourceId: row.resource_id,
        scenarioId: row.scenario_id,
        empathy: row.empathy,
        clarity: row.clarity,
        assertiveness: row.assertiveness,
        persuasion: row.persuasion || null,
        activeListening: row.active_listening,
        objectionHandling: row.objection_handling || null,
        closingAbility: row.closing_ability || null,
        // Legacy fields for backward compatibility
        flexibility: row.flexibility || row.open_mindedness || null, // Support both old and new column names
        openMindedness: row.open_mindedness || row.flexibility || null, // Keep for backward compatibility
        conflictManagement: row.conflict_management || null,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  /**
   * Save user scores
   */
  async saveScores(
    resourceId: string,
    scores: {
      empathy: number;
      clarity: number;
      assertiveness: number;
      persuasion?: number;
      activeListening: number;
      objectionHandling?: number;
      closingAbility?: number;
      // Legacy fields for backward compatibility
      flexibility?: number;
      openMindedness?: number; // Keep for backward compatibility
      conflictManagement?: number;
    },
    scenarioId?: string
  ): Promise<string> {
    try {
      const id = crypto.randomUUID();
      const createdAt = Date.now();

      // Use sales-focused metrics, fallback to legacy if not provided
      const persuasion = scores.persuasion ?? scores.assertiveness ?? 0;
      const objectionHandling = scores.objectionHandling ?? scores.conflictManagement ?? 0;
      const closingAbility = scores.closingAbility ?? 0;
      const flexibility = scores.flexibility ?? scores.openMindedness ?? 0;
      const conflictManagement = scores.conflictManagement ?? 0;

      await this.env.DB.prepare(
        "INSERT INTO user_scores (id, resource_id, scenario_id, empathy, clarity, assertiveness, flexibility, active_listening, conflict_management, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          id,
          resourceId,
          scenarioId || null,
          scores.empathy,
          scores.clarity,
          scores.assertiveness,
          flexibility,
          scores.activeListening,
          conflictManagement,
          createdAt
        )
        .run();

      return id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Get previous scores
   */
  async getPreviousScores(resourceId: string) {
    try {
      const result = await this.env.DB.prepare(
        "SELECT * FROM user_scores WHERE resource_id = ? ORDER BY created_at DESC LIMIT 1"
      )
        .bind(resourceId)
        .first();

      return result;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Save scenario
   */
  async saveScenario(
    resourceId: string,
    scenarioData: {
      scenario: any;
      prompts: any;
      reports: any;
    }
  ): Promise<string> {
    try {
      const id = crypto.randomUUID();
      const createdAt = Date.now();

      await this.env.DB.prepare(
        "INSERT INTO scenarios (id, resource_id, scenario_data, prompts, reports, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(
          id,
          resourceId,
          JSON.stringify(scenarioData.scenario),
          JSON.stringify(scenarioData.prompts),
          JSON.stringify(scenarioData.reports),
          createdAt
        )
        .run();

      return id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Get latest scenario
   */
  async getLatestScenario(resourceId: string) {
    try {
      const result = await this.env.DB.prepare(
        "SELECT * FROM scenarios WHERE resource_id = ? ORDER BY created_at DESC LIMIT 1"
      )
        .bind(resourceId)
        .first();

      if (!result) {
        return null;
      }

      return {
        scenario: JSON.parse(result.scenario_data as string),
        prompts: JSON.parse(result.prompts as string),
        reports: JSON.parse(result.reports as string),
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}

