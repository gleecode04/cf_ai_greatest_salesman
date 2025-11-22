/**
 * Transcript Analyzer Agent
 * 
 * Acts as a professional communication consultant to analyze conversation transcripts.
 * Provides comprehensive analysis including:
 * 1. Strength and weakness identification
 * 2. Psychological/temperamental analysis (Big 5 traits)
 * 3. Transcript segmentation into meaningful chunks
 * 4. Structured output for downstream processing
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
You are a professional communication consultant with expertise in sales psychology and customer relations. Your role is to analyze conversation transcripts between a salesperson/customer support agent and their customers, providing deep insights into communication patterns, psychological traits, and areas for improvement in sales and customer service effectiveness.
</role>
`;

  // Optimize scenario context - use concise format for faster processing
  const scenarioContext = scenarioData ? `
<scenario_context>
Product: ${scenarioData.product?.name || 'Not specified'}
Customer: ${scenarioData.customer?.name || 'Not specified'} (${scenarioData.customer?.attitude || 'Not specified'})
Challenge: ${scenarioData.challenge || 'Not specified'}
Key: Evaluate how well the salesperson adapted to this customer profile and met success criteria.
</scenario_context>
` : '';

  const analysisInstructions = `
<analysis_approach>
You will conduct a comprehensive analysis that includes:

1. **Strength/Weakness Analysis**: Identify specific communication strengths and areas needing improvement in sales pitches and customer interactions
2. **Psychological/Temperamental Analysis**: Assess personality traits using the Big 5 framework (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism) as they relate to sales and customer service effectiveness
3. **Transcript Segmentation**: Divide the conversation into 2-3 meaningful segments based on conversation flow, emotional dynamics, and key interactions (e.g., opening, objection handling, closing)

Focus on sales communication effectiveness, persuasion skills, customer rapport building, objection handling, and closing techniques.
</analysis_approach>

<segmentation_guidelines>
When segmenting the transcript, look for natural conversation breaks such as:
- Topic transitions
- Emotional shifts (heated discussions, conflicts, resolutions)
- Different phases of interaction (introduction, main discussion, conclusion)
- Changes in participant dynamics
- Problem identification vs. solution discussion

Create 2-4 segments maximum, each with a descriptive title that captures the essence of that conversation phase.
</segmentation_guidelines>

<output_format>
You must structure your response using this exact format:

CRITICAL: You MUST copy the EXACT transcript text provided to you. Do NOT generate, invent, or create any new conversation content. Only use the actual transcript text that was given to you.

<segment:descriptive_title_1>
[EXACT COPY of transcript lines for this segment - use the actual transcript text provided, do not generate new content]
</segment:descriptive_title_1>

<segment:descriptive_title_2>
[EXACT COPY of transcript lines for this segment - use the actual transcript text provided, do not generate new content]
</segment:descriptive_title_2>

<segment:descriptive_title_3>
[EXACT COPY of transcript lines for this segment - if applicable, use the actual transcript text provided, do not generate new content]
</segment:descriptive_title_3>

<strength>
[Detailed analysis of user's communication strengths observed in the transcript. Be specific about what they did well, citing examples from the conversation.]
</strength>

<weakness>
[Detailed analysis of areas where the user could improve their communication. Be constructive and specific, referencing particular moments or patterns in the transcript.]
</weakness>

<analysis>
[Comprehensive psychological/temperamental analysis based on the Big 5 personality traits:

**Openness to Experience**: [Assessment of user's creativity, curiosity, and openness to new ideas based on conversation patterns]

**Conscientiousness**: [Assessment of user's organization, reliability, and goal-directed behavior]

**Extraversion**: [Assessment of user's social energy, assertiveness, and interpersonal engagement]

**Agreeableness**: [Assessment of user's cooperation, trust, and consideration for others]

**Neuroticism**: [Assessment of user's emotional stability, stress responses, and anxiety levels]

Provide specific examples from the transcript to support each assessment.]
</analysis>
</output_format>

<important_guidelines>
- Analyze the user's communication patterns, not their customers'
- Be professional and constructive in your feedback
- Use specific examples from the transcript to support your analysis
- Focus on observable communication behaviors and their effectiveness in sales/customer support contexts
- Consider sales and customer service dynamics, including rapport building, objection handling, and closing techniques
- Maintain objectivity while providing actionable insights for improving sales performance
- Ensure segment titles are descriptive and meaningful (e.g., "Opening & Rapport Building", "Objection Handling", "Closing Attempt")
- CRITICAL: When creating segments, you MUST copy the EXACT transcript text provided. Do NOT generate, invent, or create hypothetical responses or example conversations. Only use the actual conversation text that was given to you in the transcript.
- If the conversation is short or incomplete, segment what actually exists - do not add hypothetical continuations or example responses.
</important_guidelines>
`;

  return baseInstructions + (scenarioData ? scenarioContext : '') + analysisInstructions;
}

const SYSTEM_INSTRUCTIONS = getSystemInstructions();

export interface AnalyzeTranscriptInput {
  transcript: string;
  additionalContext?: any;
  resourceId?: string;
  threadId?: string;
}

export interface AnalyzeTranscriptOutput {
  segmentedAnalysis: string;
  transcript: string;
  additionalContext?: any;
  resourceId?: string;
  threadId?: string;
}

/**
 * Analyze a conversation transcript
 *  Matches transcriptAnalyzerAgent.execute() pattern
 */
/**
 * Analyze a conversation transcript
 *  Matches feedbackOrchestratorWorkflow.ts lines 36-71
 * Exact code pattern copied with variable name changes for Workers AI adaptation
 */
export async function analyzeTranscript(
  input: AnalyzeTranscriptInput,
  env: Env
): Promise<AnalyzeTranscriptOutput> {
  try {
    const { transcript, additionalContext, resourceId, threadId } = input;

    // Get scenario-specific system instructions if scenario data is provided
    const systemInstructions = getSystemInstructions(additionalContext?.scenarioData);

    // Build messages array ( pattern exactly from feedbackOrchestratorWorkflow.ts:47-50)
    const messages = [
      'Analyze this sales/customer support conversation transcript: ' + transcript,
      'Additional context: ' + JSON.stringify(additionalContext),
    ];

    // Get memory context if threadId and resourceId provided ( memory pattern)
    let memoryMessages: any[] = [];
    if (threadId && resourceId) {
      const memoryManager = new MemoryManager(env);
      const memoryThreadId = threadId + '_analyzer';
      const lastMessages = await memoryManager.getLastMessages(memoryThreadId, 5);
      
      if (lastMessages.length > 0) {
        // Convert to Workers AI format while preserving original message content
        memoryMessages = lastMessages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));
      }
    }

    // Build Workers AI messages format (adapting original string array to Workers AI format)
    // Original uses string array, Workers AI needs role/content objects
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

    // Call Workers AI ( agent.generateVNext pattern from line 52)
    // Note: Workers AI requires remote execution (not available in --local mode)
    if (!env.AI) {
      throw new Error("Workers AI binding not available. Run with 'npm run dev:remote' for AI testing, or deploy to test AI features.");
    }

    // Calculate optimal max_tokens based on transcript length (optimization)
    // For short conversations, use fewer tokens to speed up generation
    const transcriptLength = transcript.length;
    const estimatedTokens = Math.ceil(transcriptLength / 4); // Rough estimate: 4 chars per token
    const maxTokens = Math.floor(Math.min(Math.max(estimatedTokens * 2, 512), 2048)); // Min 512, max 2048, scale with transcript, ensure integer
    
    // Retry Workers AI call with exponential backoff for network errors
    // Reduced initial delay and max retries for faster failure detection
    const aiStart = Date.now();
    const response = await retryWithBackoff(
      async () => {
        return await env.AI.run(MODEL_ID, {
          messages: allMessages,
          max_tokens: maxTokens,
        });
      },
      {
        maxRetries: 2, // Reduced from 3 to fail faster
        initialDelay: 500, // Reduced from 1000ms
        maxDelay: 5000, // Reduced from 10000ms
      }
    );
    const aiDuration = Date.now() - aiStart;
    console.log(`[Performance] transcriptAnalyzer AI call took ${aiDuration}ms (max_tokens: ${maxTokens})`);

    // Extract text from response ( result.text pattern from line 65)
    // Workers AI returns different formats - handle all cases
    let segmentedAnalysis = "";
    
    if (response && typeof response === "object") {
      const responseObj = response as any;
      
      // Try different response formats
      if (responseObj.response) {
        if (typeof responseObj.response === "string") {
          segmentedAnalysis = responseObj.response;
        } else if (responseObj.response.text) {
          segmentedAnalysis = responseObj.response.text;
        } else if (responseObj.response.response) {
          segmentedAnalysis = typeof responseObj.response.response === "string" 
            ? responseObj.response.response 
            : responseObj.response.response.text || "";
        }
      } else if (responseObj.text) {
        segmentedAnalysis = responseObj.text;
      } else if (responseObj.content) {
        segmentedAnalysis = responseObj.content;
      } else if (responseObj.message) {
        segmentedAnalysis = typeof responseObj.message === "string"
          ? responseObj.message
          : responseObj.message.content || "";
      } else if (Array.isArray(responseObj.choices) && responseObj.choices.length > 0) {
        const choice = responseObj.choices[0];
        segmentedAnalysis = choice.message?.content || choice.text || "";
      }
    } else if (typeof response === "string") {
      segmentedAnalysis = response;
    }
    
    if (!segmentedAnalysis) {
      console.error("Failed to extract text. Full response:", JSON.stringify(response, null, 2));
      throw new Error(`Failed to extract text from AI response. Response type: ${typeof response}`);
    }

    // Store in memory if threadId and resourceId provided ( memory pattern)
    if (threadId && resourceId && segmentedAnalysis) {
      const memoryManager = new MemoryManager(env);
      const memoryThreadId = threadId + '_analyzer';
      
      // Ensure thread exists
      await memoryManager.getOrCreateThread(resourceId, memoryThreadId);
      
      // Store user message ( message format)
      await memoryManager.addMessage(memoryThreadId, "user", messages[0]);
      
      // Store assistant response ( result.text storage)
      await memoryManager.addMessage(memoryThreadId, "assistant", segmentedAnalysis);
    }

    // Return  pattern exactly (lines 64-70)
    return {
      segmentedAnalysis,
      transcript,
      additionalContext,
      resourceId,
      threadId,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

