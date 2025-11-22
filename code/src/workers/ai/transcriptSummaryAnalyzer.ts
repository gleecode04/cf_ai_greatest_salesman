/**
 * Transcript Summary Analyzer Agent
 * 
 * Analyzes conversation transcripts and provides structured feedback with three key components:
 * 1. Brief overview of the conversation
 * 2. Analysis of what the user did during the interaction
 * 3. Constructive recommendations for improvement
 * 
 * Uses Cloudflare Workers AI (Llama 3.3)
 */

import { Env } from "../../types";
import { MemoryManager } from "../memory/memoryManager";
import { retryWithBackoff } from "../utils/retryUtils";

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function getSystemInstructions(scenarioData?: any): string {
  const baseInstructions = `
<role>
You are an expert conversation analyst specializing in sales and customer support performance assessment. Your role is to analyze sales/customer support conversation transcripts and provide structured, actionable feedback to help users improve their sales and customer service skills.
</role>
`;

  if (!scenarioData) {
    return baseInstructions;
  }

  // Optimized concise scenario context for faster processing
  const scenarioContext = `
<scenario_context>
Product: ${scenarioData.product?.name || 'Not specified'}
Customer: ${scenarioData.customer?.name || 'Not specified'} (${scenarioData.customer?.attitude || 'Not specified'})
Challenge: ${scenarioData.challenge || 'Not specified'}
Key: Evaluate adaptation to customer profile, addressing concerns, and meeting success criteria.
</scenario_context>
`;

  const analysisInstructions = `
<analysis_structure>
Your analysis must follow this exact structure:

**1. CONVERSATION OVERVIEW**
Provide a concise 2-3 sentence summary covering:
- Primary topics discussed and key themes (product/service, customer needs, objections)
- Overall tone and dynamics between salesperson and customer
- Main outcomes or decisions reached (sale closed, follow-up scheduled, customer satisfied, etc.)

**2. USER PERFORMANCE ANALYSIS**
Analyze what the user (salesperson/customer support agent) specifically did during the conversation:
- Sales approach and communication style used
- How well they identified and addressed customer needs
- Objection handling techniques employed
- Rapport building and relationship management
- Closing techniques and effectiveness
- Evidence of product knowledge and preparation
- Customer engagement and active listening

**3. RATING**
- Rate the user's conversation out of 100: Empathy, Clarity, Assertiveness, Persuasion, Active Listening, Objection Handling, Closing Ability

**4. IMPROVEMENT RECOMMENDATIONS**
Provide 3-4 specific, actionable recommendations:
- Sales techniques to enhance effectiveness (pitching, objection handling, closing)
- Customer service strategies for better outcomes
- Preparation strategies for similar future sales situations
- Relationship building and customer engagement improvements
- Product knowledge and value proposition communication
</analysis_structure>

<analysis_guidelines>
Format of transcript:
user:
<agent name>:
user:
<agent name>:
...


When analyzing transcripts:
- Analyze how the user (salesperson/customer support agent) performed, not the customer
- Focus on sales and customer service communication effectiveness
- Consider the specific sales/customer support scenario context and objectives
- Remain objective and constructive in your feedback
- Consider sales context: customer needs, objections, buying signals, closing opportunities
- Focus on actionable improvements for sales performance and customer satisfaction
- Acknowledge both strengths and areas for development in sales skills
- Tailor recommendations to sales and customer support best practices
- Consider customer psychology and buying behavior
- Balance assertiveness with empathy and customer-centric approach
- Address both immediate tactical sales improvements and long-term relationship building
</analysis_guidelines>
`;

  const outputFormat = `
<output_format>
Structure your response using clear headers:

## CONVERSATION OVERVIEW
[Your 2-3 sentence overview here]

## USER PERFORMANCE ANALYSIS
[Detailed analysis of what the user did]

## RATING
- Empathy: [score out of 100]
- Clarity: [score out of 100]
- Assertiveness: [score out of 100]
- Persuasion: [score out of 100]
- Active Listening: [score out of 100]
- Objection Handling: [score out of 100]
- Closing Ability: [score out of 100]

## IMPROVEMENT RECOMMENDATIONS
1. [First specific recommendation]
2. [Second specific recommendation]
3. [Third specific recommendation]
4. [Fourth specific recommendation if applicable]
</output_format>

<important>
1. Refer the user as "you", not "the user".
2. Be concise and focused in your analysis.
3. Remember to include all headers and structure as specified (CONVERSATION OVERVIEW, USER PERFORMANCE ANALYSIS, RATING, IMPROVEMENT RECOMMENDATIONS).
4. Do not put markdown formatting in RATING section.
</important>
`;

  return baseInstructions + (scenarioData ? scenarioContext : '') + analysisInstructions + outputFormat;
}

const SYSTEM_INSTRUCTIONS = getSystemInstructions();

export interface GenerateSummaryInput {
  transcript: string;
  segmentedAnalysis: string;
  additionalContext?: any;
  resourceId?: string;
  threadId?: string;
}

export interface GenerateSummaryOutput {
  segmentedAnalysis: string;
  summaryAnalysis: string;
}

/**
 * Generate summary analysis from transcript
 *  Matches transcriptSummaryAnalyzerAgent.execute() pattern
 */
/**
 * Generate summary analysis from transcript
 *  Matches feedbackOrchestratorWorkflow.ts lines 88-115
 * Exact code pattern copied with variable name changes for Workers AI adaptation
 */
export async function generateSummary(
  input: GenerateSummaryInput,
  env: Env
): Promise<GenerateSummaryOutput> {
  try {
    const { transcript, segmentedAnalysis, additionalContext, resourceId, threadId } = input;

    // Get scenario-specific system instructions if scenario data is provided
    const systemInstructions = getSystemInstructions(additionalContext?.scenarioData);

    // Build messages array ( pattern exactly from feedbackOrchestratorWorkflow.ts:94-97)
    const messages = [
      'Analyze this sales/customer support conversation transcript for overall summary: ' + transcript,
      'Additional context: ' + JSON.stringify(additionalContext),
    ];

    // Get memory context if threadId and resourceId provided ( memory pattern)
    let memoryMessages: any[] = [];
    if (threadId && resourceId) {
      const memoryManager = new MemoryManager(env);
      const memoryThreadId = threadId + '_summary';
      const lastMessages = await memoryManager.getLastMessages(memoryThreadId, 5);
      
      if (lastMessages.length > 0) {
        memoryMessages = lastMessages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));
      }
    }

    // Build Workers AI messages format (adapting original string array to Workers AI format)
    const allMessages = [
      {
        role: "system" as const,
        content: systemInstructions, // Use scenario-aware instructions
      },
      ...memoryMessages,
      {
        role: "user" as const,
        content: messages.join('\n'), // Combine original message strings
      },
    ];

    // Call Workers AI ( agent.generateVNext pattern from line 99)
    // Note: Workers AI requires remote execution (not available in --local mode)
    if (!env.AI) {
      throw new Error("Workers AI binding not available. Run with 'npm run dev:remote' for AI testing, or deploy to test AI features.");
    }

    // Calculate optimal max_tokens based on transcript length (optimization)
    const transcriptLength = transcript.length;
    const estimatedTokens = Math.ceil(transcriptLength / 4);
    const maxTokens = Math.floor(Math.min(Math.max(estimatedTokens * 1.5, 512), 2048)); // Slightly less than analyzer, ensure integer
    
    // Retry Workers AI call with exponential backoff for network errors
    const aiStart = Date.now();
    const response = await retryWithBackoff(
      async () => {
        return await env.AI.run(MODEL_ID, {
          messages: allMessages,
          max_tokens: maxTokens,
        });
      },
      {
        maxRetries: 2, // Reduced from 3
        initialDelay: 500, // Reduced from 1000ms
        maxDelay: 5000, // Reduced from 10000ms
      }
    );
    const aiDuration = Date.now() - aiStart;
    console.log(`[Performance] transcriptSummaryAnalyzer AI call took ${aiDuration}ms (max_tokens: ${maxTokens})`);

    // Extract text from response ( result.text pattern from line 113)
    // Workers AI returns different formats - handle all cases
    let summaryAnalysis = "";
    
    if (response && typeof response === "object") {
      const responseObj = response as any;
      
      // Try different response formats
      if (responseObj.response) {
        if (typeof responseObj.response === "string") {
          summaryAnalysis = responseObj.response;
        } else if (responseObj.response.text) {
          summaryAnalysis = responseObj.response.text;
        } else if (responseObj.response.response) {
          summaryAnalysis = typeof responseObj.response.response === "string" 
            ? responseObj.response.response 
            : responseObj.response.response.text || "";
        }
      } else if (responseObj.text) {
        summaryAnalysis = responseObj.text;
      } else if (responseObj.content) {
        summaryAnalysis = responseObj.content;
      } else if (responseObj.message) {
        summaryAnalysis = typeof responseObj.message === "string"
          ? responseObj.message
          : responseObj.message.content || "";
      } else if (Array.isArray(responseObj.choices) && responseObj.choices.length > 0) {
        const choice = responseObj.choices[0];
        summaryAnalysis = choice.message?.content || choice.text || "";
      }
    } else if (typeof response === "string") {
      summaryAnalysis = response;
    }
    
    if (!summaryAnalysis) {
      console.error("Failed to extract text. Full response:", JSON.stringify(response, null, 2));
      throw new Error(`Failed to extract text from AI response. Response type: ${typeof response}`);
    }

    // Store in memory if threadId and resourceId provided ( memory pattern)
    if (threadId && resourceId && summaryAnalysis) {
      const memoryManager = new MemoryManager(env);
      const memoryThreadId = threadId + '_summary';
      
      // Ensure thread exists
      await memoryManager.getOrCreateThread(resourceId, memoryThreadId);
      
      // Store user message ( message format)
      await memoryManager.addMessage(memoryThreadId, "user", messages[0]);
      
      // Store assistant response ( result.text storage)
      await memoryManager.addMessage(memoryThreadId, "assistant", summaryAnalysis);
    }

    // Return  pattern exactly (lines 111-114)
    return {
      segmentedAnalysis,
      summaryAnalysis,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

