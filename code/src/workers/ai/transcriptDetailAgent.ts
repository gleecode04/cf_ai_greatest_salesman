/**
 * Transcript Detail Agent
 * 
 * Provides detailed phrase-level feedback on user communication with color-coded highlighting:
 * - Red: Phrases that need improvement
 * - Yellow: Phrases that are OK but can be enhanced
 * - Green: Excellent phrases that demonstrate good communication
 * 
 * Analyzes each segment provided by the transcriptAnalyzerAgent
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
You are a communication expert specializing in detailed linguistic analysis and phrase-level feedback for sales and customer support. Your role is to provide granular feedback on specific phrases and expressions used by the user in sales/customer support conversations, helping them understand exactly which parts of their communication are effective and which need improvement.
</role>
`;

  if (!scenarioData) {
    return baseInstructions;
  }

  // Optimized concise scenario context for faster processing
  const scenarioContext = `
<scenario_context>
Product: ${scenarioData.product?.name || 'Not specified'}
Customer: ${scenarioData.customer?.name || 'Not specified'} (${scenarioData.customer?.attitude || 'Not specified'}, ${scenarioData.customer?.knowledge || 'Not specified'})
Challenge: ${scenarioData.challenge || 'Not specified'}
Key: Evaluate phrase appropriateness for customer knowledge/style, addressing concerns, and meeting success criteria.
</scenario_context>
`;

  const analysisInstructions = `
<analysis_focus>
You will analyze user communication at the phrase level, focusing on:

**Sales & Customer Support Effectiveness**:
- Clarity and precision of language
- Professional and customer-friendly tone
- Persuasive language and value proposition communication
- Emotional intelligence and customer empathy in phrasing

**Areas to Evaluate**:
- Opening statements and rapport building
- Needs discovery questions and inquiry techniques
- Value proposition and benefit communication
- Objection handling and response formulation
- Closing techniques and call-to-action expressions
- Active listening demonstrations and customer acknowledgment
- Assertiveness vs. pushiness in sales approach
- Empathy and understanding expressions for customer concerns
</analysis_focus>

<color_coding_system>
Use this color-coding system for phrase-level feedback:

red - Needs Improvement:
- Phrases that hinder communication effectiveness
- Language that may create conflict or misunderstanding
- Unprofessional or inappropriate expressions
- Missed opportunities for better phrasing

yellow - Can Be Enhanced:
- Phrases that are functional but could be more effective
- Adequate communication that lacks polish or impact
- Missed opportunities for stronger connection or persuasion
- Good intent but suboptimal execution

green - Excellent:
- Phrases that demonstrate excellent sales and customer service skills
- Language that builds customer rapport and trust
- Professional and effective sales expressions
- Examples of best practices in sales and customer support communication
</color_coding_system>

<analysis_guidelines>
For each segment provided:

1. **Selective Highlighting**: MAXIMUM 3 highlights ONLY. Only highlight phrases that are truly relevant and important. Do not highlight every phrase - focus on the most impactful examples.

2. **Specific Feedback**: For each highlighted phrase, explain in maximum 8 words one of the following:
   - Why it falls into that color category
   - What makes it effective or ineffective for sales/customer support
   - Specific suggestions for improvement (for red/yellow)
   - Why it's exemplary for sales performance (for green)

3. **Context Awareness**: Consider the sales and customer support context when evaluating phrases - focus on customer needs, objections, buying signals, and closing opportunities.

4. **User Focus**: Only analyze and highlight the user's (salesperson/customer support agent) phrases, not their customers' responses.

5. DO NOT generate highlights with your own transcript. Highlights MUST be based on transcript given to you.
</analysis_guidelines>

<output_format>
CRITICAL: You MUST use XML-style segment tags. Do NOT use plain text "Segment:" format.

For each segment provided, structure your response EXACTLY as:

<segment:segment_title>
[EXACT COPY OF Transcript before highlighting...]
user: <comment color="[red|yellow|green]" feedback="[Why this phrase needs improvement/how to improve]">[exact phrase from user]</comment>
[EXACT COPY OF Transcript continues...]
</segment:segment_title>

IMPORTANT:
- Start each segment with <segment:title> (with angle brackets)
- End each segment with </segment:title> (with angle brackets)
- Do NOT use plain text format like "Segment: title"
- The segment title should be descriptive (e.g., "Opening_and_Rapport_Building", "Objection_Handling", "Closing_Attempt")
- Wrap ALL segment content between the opening and closing tags

Example:
<segment:Opening_and_Rapport_Building>
customer: Hello, I'm interested in your product.
user: <comment color="green" feedback="Great opening, friendly tone">Hi! Thanks for reaching out. I'd be happy to help.</comment>
customer: Can you tell me more about pricing?
</segment:Opening_and_Rapport_Building>

[Repeat this format for each segment provided]

</output_format>

<important_guidelines>
- Balance constructive criticism with recognition of strengths in sales and customer service skills
- Consider the sales and customer support context - focus on customer relationship building, objection handling, and closing effectiveness
- Only highlight max 3 phrases per segment to maintain focus on the most important feedback
- Ensure your color-coding is consistent ("red", "yellow", "green") only
- Feedback maximum 8 words per highlight
- CRITICAL: You MUST use ONLY the transcript text provided in the segments. Do NOT generate, invent, or add any new conversation content. Only annotate the actual transcript text that was given to you.
- DO NOT generate hypothetical responses or example conversations. Only annotate what actually exists in the provided segments.
- The '[]' brackets in the output format are placeholders and should not be included in the final output.
- Generate the exact transcript with highlights as specified, do not ignore any part of the transcript provided, but also do not add content that wasn't in the original transcript.
- If a segment contains only customer messages and no user messages, do not add user responses - only annotate what exists.
</important_guidelines>
`;

  return baseInstructions + (scenarioData ? scenarioContext : '') + analysisInstructions;
}

const SYSTEM_INSTRUCTIONS = getSystemInstructions();

export interface AnalyzeDetailsInput {
  segmentedAnalysis: string;
  summaryAnalysis: string;
  additionalContext?: any;
  resourceId?: string;
  threadId?: string;
}

export interface AnalyzeDetailsOutput {
  segmentedAnalysis: string;
  summaryAnalysis: string;
  detailedFeedback: string;
}

/**
 * Analyze details with phrase-level feedback
 *  Matches transcriptDetailAgent.execute() pattern
 * Temperature: 0.2 ( modelSettings.temperature)
 */
/**
 * Analyze details with phrase-level feedback
 *  Matches feedbackOrchestratorWorkflow.ts lines 130-182
 * Exact code pattern copied with variable name changes for Workers AI adaptation
 */
export async function analyzeDetails(
  input: AnalyzeDetailsInput,
  env: Env
): Promise<AnalyzeDetailsOutput> {
  try {
    const { segmentedAnalysis, summaryAnalysis, additionalContext, resourceId, threadId } = input;

    // Get scenario-specific system instructions if scenario data is provided
    const systemInstructions = getSystemInstructions(additionalContext?.scenarioData);

    // Extract segments from segmentedAnalysis using regex ( pattern exactly from lines 142-150)
    const segments = [];
    const segmentRegex = /<segment:([^>]+)>\s*([\s\S]*?)\s*<\/segment:[^>]+>/g;
    let match;

    while ((match = segmentRegex.exec(segmentedAnalysis)) !== null) {
      segments.push({
        title: match[1],
        content: match[2].trim(),
      });
    }

    // Prepare segments for detailed analysis ( pattern exactly from lines 153-155)
    const segmentText = segments.map(segment =>
      `Segment: ${segment.title}\n${segment.content}`
    ).join('\n\n');

    // Build messages array ( pattern exactly from lines 157-160)
    const messages = [
      'Provide detailed phrase-level feedback for these conversation segments: ' + segmentText,
      'Additional context: ' + JSON.stringify(additionalContext),
    ];

    // Get memory context if threadId and resourceId provided ( memory pattern)
    let memoryMessages: any[] = [];
    if (threadId && resourceId) {
      const memoryManager = new MemoryManager(env);
      const memoryThreadId = threadId + '_detail';
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

    // Call Workers AI with temperature 0.2 ( modelSettings.temperature from line 165)
    // Note: Workers AI requires remote execution (not available in --local mode)
    if (!env.AI) {
      throw new Error("Workers AI binding not available. Run with 'npm run dev:remote' for AI testing, or deploy to test AI features.");
    }

    // Calculate optimal max_tokens based on segment length (optimization)
    const segmentLength = segmentedAnalysis.length;
    const estimatedTokens = Math.ceil(segmentLength / 4);
    const maxTokens = Math.floor(Math.min(Math.max(estimatedTokens * 1.5, 512), 2048)); // Ensure integer
    
    // Retry Workers AI call with exponential backoff for network errors
    const aiStart = Date.now();
    const response = await retryWithBackoff(
      async () => {
        return await env.AI.run(MODEL_ID, {
          messages: allMessages,
          max_tokens: maxTokens,
          temperature: 0.2,
        });
      },
      {
        maxRetries: 2, // Reduced from 3
        initialDelay: 500, // Reduced from 1000ms
        maxDelay: 5000, // Reduced from 10000ms
      }
    );
    const aiDuration = Date.now() - aiStart;
    console.log(`[Performance] transcriptDetailAgent AI call took ${aiDuration}ms (max_tokens: ${maxTokens})`);

    // Extract text from response ( result.text pattern from line 180)
    // Workers AI returns different formats - handle all cases
    let detailedFeedback = "";
    
    if (response && typeof response === "object") {
      const responseObj = response as any;
      
      // Try different response formats
      if (responseObj.response) {
        if (typeof responseObj.response === "string") {
          detailedFeedback = responseObj.response;
        } else if (responseObj.response.text) {
          detailedFeedback = responseObj.response.text;
        } else if (responseObj.response.response) {
          detailedFeedback = typeof responseObj.response.response === "string" 
            ? responseObj.response.response 
            : responseObj.response.response.text || "";
        }
      } else if (responseObj.text) {
        detailedFeedback = responseObj.text;
      } else if (responseObj.content) {
        detailedFeedback = responseObj.content;
      } else if (responseObj.message) {
        detailedFeedback = typeof responseObj.message === "string"
          ? responseObj.message
          : responseObj.message.content || "";
      } else if (Array.isArray(responseObj.choices) && responseObj.choices.length > 0) {
        const choice = responseObj.choices[0];
        detailedFeedback = choice.message?.content || choice.text || "";
      }
    } else if (typeof response === "string") {
      detailedFeedback = response;
    }
    
    if (!detailedFeedback) {
      console.error("Failed to extract text. Full response:", JSON.stringify(response, null, 2));
      throw new Error(`Failed to extract text from AI response. Response type: ${typeof response}`);
    }
    
    // Debug: Log segment information
    console.log('[transcriptDetailAgent] detailedFeedback length:', detailedFeedback.length);
    console.log('[transcriptDetailAgent] detailedFeedback contains <segment:', detailedFeedback.includes('<segment:'));
    if (detailedFeedback.includes('<segment:')) {
      const segmentMatches = detailedFeedback.match(/<segment:[^>]+>/g);
      console.log('[transcriptDetailAgent] Found segment tags:', segmentMatches?.length || 0);
      console.log('[transcriptDetailAgent] First 500 chars:', detailedFeedback.substring(0, 500));
    } else {
      console.warn('[transcriptDetailAgent] No segment tags found in detailedFeedback');
      console.log('[transcriptDetailAgent] First 1000 chars:', detailedFeedback.substring(0, 1000));
    }

    // Store in memory if threadId and resourceId provided ( memory pattern)
    if (threadId && resourceId && detailedFeedback) {
      const memoryManager = new MemoryManager(env);
      const memoryThreadId = threadId + '_detail';
      
      // Ensure thread exists
      await memoryManager.getOrCreateThread(resourceId, memoryThreadId);
      
      // Store user message ( message format)
      await memoryManager.addMessage(memoryThreadId, "user", messages[0]);
      
      // Store assistant response ( result.text storage)
      await memoryManager.addMessage(memoryThreadId, "assistant", detailedFeedback);
    }

    // Return  pattern exactly (lines 177-181)
    return {
      segmentedAnalysis,
      summaryAnalysis,
      detailedFeedback,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

