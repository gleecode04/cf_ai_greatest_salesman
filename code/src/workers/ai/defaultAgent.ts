/**
 * Default Chat Agent
 * 
 * Context-aware chat agent that adapts prompts based on chat type (scenario vs transcript).
 * Uses Cloudflare Workers AI (Llama 3.3)
 */

import { Env } from "../../types";
import { MemoryManager } from "../memory/memoryManager";
import { bartPrompt, feedbackReplyPrompt } from "../lib/prompts";
import { getScenarioCustomerPrompt } from "../lib/scenarioPrompts";

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export interface GenerateChatResponseInput {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  additionalContext?: any;
  resourceId?: string;
  threadId?: string;
  streamController?: ReadableStreamDefaultController<Uint8Array>; // For SSE streaming
}

export interface GenerateChatResponseOutput {
  content: string;
  usage?: any;
}

/**
 * Generate chat response with context-aware prompt selection
 */
export async function generateChatResponse(
  input: GenerateChatResponseInput,
  env: Env
): Promise<GenerateChatResponseOutput> {
  try {
    console.log("[defaultAgent] ========== CHAT REQUEST STARTED ==========");
    const {
      prompt,
      temperature,
      maxTokens,
      systemPrompt,
      additionalContext,
      resourceId,
      threadId,
      streamController,
    } = input;
    
    console.log("[defaultAgent] ThreadId:", threadId);
    console.log("[defaultAgent] ResourceId:", resourceId);
    console.log("[defaultAgent] Prompt length:", prompt.length);
    console.log("[defaultAgent] Has scenarioId:", !!additionalContext?.scenarioId);
    console.log("[defaultAgent] Has scenarioData:", !!additionalContext?.scenarioData);
    console.log("[defaultAgent] Streaming:", !!streamController);

    // Check if we need to prepend a system prompt based on context
    let modifiedPrompt = prompt;
    
    // Look for chatType in the subscribed context data
    let chatType = null;
    if (additionalContext) {
      // Cedar sends subscribed context as { data: value, source: 'subscription' }
      if (additionalContext.chatType && additionalContext.chatType.data) {
        chatType = additionalContext.chatType.data;
      }
    }

    // Apply prompt modification based on chat type
    if (chatType === 'scenario') {
      // Check if we have scenario-specific data
      let scenarioPrompt = bartPrompt; // Default fallback
      
      console.log('[defaultAgent] Scenario context check:', {
        hasScenarioId: !!additionalContext?.scenarioId,
        hasScenarioData: !!additionalContext?.scenarioData,
        scenarioId: additionalContext?.scenarioId,
        customerName: additionalContext?.scenarioData?.customer?.name,
      });
      
      if (additionalContext?.scenarioId && additionalContext?.scenarioData) {
        try {
          scenarioPrompt = getScenarioCustomerPrompt(
            additionalContext.scenarioId,
            additionalContext.scenarioData.customer
          );
          
          console.log('[defaultAgent] Scenario prompt generated, length:', scenarioPrompt.length);
          
          // Add conversation context awareness to the prompt
          scenarioPrompt += `

<conversation_context>
You are in the middle of a conversation. The user (salesperson) just said: "${prompt}"

IMPORTANT CONVERSATION RULES:
1. Read what the salesperson said carefully and respond to their specific words and approach
2. If they keep pushing the same point after you've rejected it, escalate your resistance
3. If they change tactics or address your concerns, acknowledge it and react accordingly
4. Reference things they said earlier in the conversation
5. Show emotional progression - don't stay static
6. Vary your language - never repeat the exact same phrase
7. Build on previous exchanges naturally
8. If they're being pushy, get more resistant. If they're understanding, soften slightly
9. Show you're listening by referencing their specific points
10. Make each response feel like a natural continuation of the conversation, not a standalone statement
11. If they mention specific features or benefits, react to those specifically
12. Show you're paying attention by picking up on details they mention
</conversation_context>
`;
        } catch (error) {
          console.error('[defaultAgent] Error generating scenario prompt:', error);
          // Fall back to default bartPrompt
        }
      } else {
        console.warn('[defaultAgent] Missing scenario context, using default bartPrompt');
      }
      
      modifiedPrompt = `${scenarioPrompt}\n\nUser: ${prompt}`;
    } else if (chatType === 'transcript') {
      // Extract conversation analysis data from additionalContext
      const conversationAnalysis = additionalContext?.conversationAnalysis;
      
      // Build context string with feedback data
      let analysisContext = "";
      if (conversationAnalysis) {
        const { segments, feedback, suggestions, scores } = conversationAnalysis;
        
        // Format scores
        if (scores && Array.isArray(scores) && scores.length > 0) {
          analysisContext += `\n\n<performance_scores>\n`;
          scores.forEach((score: any) => {
            analysisContext += `- ${score.category}: ${score.score}/100\n`;
          });
          analysisContext += `</performance_scores>\n`;
        }
        
        // Format feedback summary
        if (feedback) {
          analysisContext += `\n\n<feedback_summary>\n${feedback}\n</feedback_summary>\n`;
        }
        
        // Format suggestions
        if (suggestions) {
          analysisContext += `\n\n<suggested_improvements>\n${suggestions}\n</suggested_improvements>\n`;
        }
        
        // Format annotated segments
        if (segments && Array.isArray(segments) && segments.length > 0) {
          analysisContext += `\n\n<annotated_transcript_segments>\n`;
          segments.forEach((segment: any, idx: number) => {
            analysisContext += `\n[Segment ${idx + 1}: ${segment.title || 'Untitled'}]\n`;
            analysisContext += `Content: ${segment.content || ''}\n`;
          });
          analysisContext += `\n</annotated_transcript_segments>\n`;
        }
      }
      
      // Check if the combined prompt would be too long
      const combinedLength = feedbackReplyPrompt.length + prompt.length + analysisContext.length;
      
      if (combinedLength > 120000) { // Conservative limit
        modifiedPrompt = `You are a sales and customer service coach helping analyze sales performance. Answer questions about sales skills, customer service, empathy, persuasion, objection handling, and closing techniques based on the conversation analysis provided.${analysisContext}\n\nUser: ${prompt}`;
      } else {
        modifiedPrompt = `${feedbackReplyPrompt}${analysisContext}\n\nUser: ${prompt}`;
      }
    }

    // Build messages array
    const messages = [
      "User message: " + modifiedPrompt,
      "Additional context (for background knowledge): " +
        JSON.stringify(additionalContext),
    ];

    // Get memory context if threadId and resourceId provided
    let memoryMessages: any[] = [];
    if (threadId && resourceId) {
      const memoryManager = new MemoryManager(env);
      const lastMessages = await memoryManager.getLastMessages(threadId, 5);
      
      if (lastMessages.length > 0) {
        memoryMessages = lastMessages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));
      }
    }

    // Build Workers AI messages format (adapting original string array to Workers AI format)
    // Original uses string array, Workers AI needs role/content objects
    // Include conversation history in context for better continuity
    const conversationContext = memoryMessages.length > 0 
      ? `\n\n<conversation_history>\nPrevious exchanges:\n${memoryMessages.map((msg, idx) => 
          `${msg.role === 'user' ? 'Salesperson' : 'Customer'}: ${msg.content.substring(0, 200)}`
        ).join('\n')}\n</conversation_history>\n`
      : '';
    
    const allMessages = [
      {
        role: "system" as const,
        content: modifiedPrompt + conversationContext, // Use modified prompt as system message with conversation history
      },
      {
        role: "user" as const,
        content: prompt, // Use the actual user prompt directly, not the modified one
      },
    ];

    // Call Workers AI
    // Note: Workers AI requires remote execution (not available in --local mode)
    if (!env.AI) {
      console.error("[defaultAgent] ❌ Workers AI binding not available");
      throw new Error("Workers AI binding not available. Run with 'npm run dev:remote' for AI testing, or deploy to test AI features.");
    }

    console.log("[defaultAgent] Calling Workers AI (Llama 3.3)...");
    const aiStartTime = Date.now();
    const response = await env.AI.run(MODEL_ID, {
      messages: allMessages,
      max_tokens: maxTokens || 1024,
      temperature: temperature,
    });

    const aiDuration = Date.now() - aiStartTime;
    console.log("[defaultAgent] Workers AI response received in", aiDuration, "ms");
    
    // Extract text from response
    // Workers AI returns different formats - handle all cases
    let responseText = "";
    
    // Log response for debugging
    console.log("[defaultAgent] Parsing AI response...");
    console.log("[defaultAgent] Response type:", typeof response);
    console.log("[defaultAgent] Response keys:", response && typeof response === "object" ? Object.keys(response) : "N/A");
    
    if (response && typeof response === "object") {
      const responseObj = response as any;
      
      // Try different response formats
      if (responseObj.response) {
        // Format: { response: { text: string } } or { response: string }
        if (typeof responseObj.response === "string") {
          responseText = responseObj.response;
        } else if (responseObj.response.text) {
          responseText = responseObj.response.text;
        } else if (responseObj.response.response) {
          // Nested response
          responseText = typeof responseObj.response.response === "string" 
            ? responseObj.response.response 
            : responseObj.response.response.text || "";
        }
      } else if (responseObj.text) {
        // Format: { text: string }
        responseText = responseObj.text;
      } else if (responseObj.content) {
        // Format: { content: string }
        responseText = responseObj.content;
      } else if (responseObj.message) {
        // Format: { message: { content: string } }
        if (typeof responseObj.message === "string") {
          responseText = responseObj.message;
        } else if (responseObj.message.content) {
          responseText = responseObj.message.content;
        }
      } else if (Array.isArray(responseObj.choices) && responseObj.choices.length > 0) {
        // Format: { choices: [{ message: { content: string } }] }
        const choice = responseObj.choices[0];
        if (choice.message && choice.message.content) {
          responseText = choice.message.content;
        } else if (choice.text) {
          responseText = choice.text;
        }
      } else {
        // Try to stringify and extract
        const stringified = JSON.stringify(responseObj);
        console.log("Response stringified:", stringified.substring(0, 500));
      }
    } else if (typeof response === "string") {
      responseText = response;
    }
    
    if (!responseText) {
      console.error("[defaultAgent] ❌ Failed to extract text. Full response:", JSON.stringify(response, null, 2));
      throw new Error(`Failed to extract text from AI response. Response type: ${typeof response}`);
    }
    
    console.log("[defaultAgent] Response text extracted, length:", responseText.length);
    console.log("[defaultAgent] Full response text (first 200 chars):", JSON.stringify(responseText.substring(0, 200)));
    console.log("[defaultAgent] Full response text (readable, first 200 chars):", responseText.substring(0, 200));

    // Send full response at once (no chunking to avoid character/spacing issues)
    if (streamController) {
      // Import handleTextStream dynamically to avoid circular dependency
      const { handleTextStream } = await import("../utils/streamUtils");
      // Send entire response as single chunk - preserves all characters and spacing perfectly
      await handleTextStream(responseText, streamController);
      console.log("[defaultAgent] ✅ Full response sent as single chunk");
    }

    // Store in memory if threadId and resourceId provided
    if (threadId && resourceId && responseText) {
      const memoryManager = new MemoryManager(env);
      
      // Ensure thread exists
      await memoryManager.getOrCreateThread(resourceId, threadId);
      
      // Store user message
      await memoryManager.addMessage(threadId, "user", messages[0]);
      
      // Store assistant response
      await memoryManager.addMessage(threadId, "assistant", responseText);
    }

    console.log("[defaultAgent] ✅ Chat response generated successfully");
    console.log("[defaultAgent] Final response length:", responseText.length);
    console.log("[defaultAgent] ========== CHAT REQUEST COMPLETE ==========");
    
    // Return response
    return {
      content: responseText,
      usage: undefined, // Workers AI doesn't provide usage in same format
    };
  } catch (error) {
    console.error("[defaultAgent] ❌ Error generating chat response:", error);
    throw error;
  }
}
