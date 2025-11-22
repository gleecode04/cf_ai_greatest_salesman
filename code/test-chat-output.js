/**
 * Chat Output Sanity Test Script
 * 
 * Tests the chat endpoint to verify:
 * - No missing characters
 * - Proper spacing between words
 * - Complete sentences
 * - No truncation issues
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';

// Test messages to send
const TEST_MESSAGES = [
  "Hello, can you tell me about FlowPilot?",
  "What are the key features?",
  "How much does it cost?",
  "Can you explain the pricing structure?",
  "What makes this product different from competitors?",
];

// Helper function to check for common issues
function checkForIssues(text) {
  const issues = [];
  
  // Check for missing spaces (words joined together)
  const missingSpaces = text.match(/\w{2,}[A-Z]\w+/g);
  if (missingSpaces) {
    issues.push({
      type: 'missing_spaces',
      examples: missingSpaces.slice(0, 5),
      count: missingSpaces.length
    });
  }
  
  // Check for words that should have spaces before them
  const commonWords = ['the', 'and', 'but', 'for', 'with', 'about', 'that', 'this', 'they', 'how', 'does', 'are', 'any'];
  const missingSpaceBefore = [];
  commonWords.forEach(word => {
    const regex = new RegExp(`[a-z]${word}`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      missingSpaceBefore.push(...matches.slice(0, 3));
    }
  });
  if (missingSpaceBefore.length > 0) {
    issues.push({
      type: 'missing_space_before_common_words',
      examples: missingSpaceBefore,
      count: missingSpaceBefore.length
    });
  }
  
  // Check for truncated words (words ending abruptly)
  const truncatedWords = text.match(/\w{3,}[^a-zA-Z0-9\s.,!?;:]/g);
  if (truncatedWords) {
    issues.push({
      type: 'possibly_truncated_words',
      examples: truncatedWords.slice(0, 5),
      count: truncatedWords.length
    });
  }
  
  // Check for double spaces (might indicate spacing issues)
  const doubleSpaces = (text.match(/  +/g) || []).length;
  if (doubleSpaces > 5) {
    issues.push({
      type: 'excessive_double_spaces',
      count: doubleSpaces
    });
  }
  
  return issues;
}

// Function to send a chat message and get response
async function testChatMessage(message, threadId, resourceId, scenarioId) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📤 Sending: "${message}"`);
  console.log(`${'='.repeat(80)}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: message,
        additionalContext: {
          chatType: {
            data: 'scenario',
          },
          scenarioId: scenarioId,
          scenarioData: {
            id: scenarioId,
            customer: { name: 'Customer' }
          },
        },
        resourceId: resourceId,
        threadId: threadId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    let chunkCount = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const decoded = decoder.decode(value, { stream: true });
      chunkCount++;
      buffer += decoded;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5);
          if (data.trim() === '' || data.trim() === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'text' && parsed.content) {
              chunks.push({
                chunkNum: chunkCount,
                content: parsed.content,
                length: parsed.content.length
              });
              fullResponse += parsed.content;
            }
          } catch (e) {
            // Plain text fallback
            if (data && data.trim() !== '[DONE]') {
              chunks.push({
                chunkNum: chunkCount,
                content: data,
                length: data.length,
                format: 'plain_text'
              });
              fullResponse += data;
            }
          }
        }
      }
    }

    console.log(`\n📥 Response received:`);
    console.log(`   Total chunks: ${chunks.length}`);
    console.log(`   Total length: ${fullResponse.length} characters`);
    console.log(`\n📝 Full response:`);
    console.log(`   "${fullResponse}"`);
    
    // Log first few chunks for debugging
    if (chunks.length > 0) {
      console.log(`\n🔍 First 3 chunks:`);
      chunks.slice(0, 3).forEach((chunk, idx) => {
        console.log(`   Chunk ${idx + 1}: "${chunk.content.substring(0, 50)}${chunk.content.length > 50 ? '...' : ''}" (${chunk.length} chars)`);
      });
    }

    // Check for issues
    const issues = checkForIssues(fullResponse);
    
    if (issues.length > 0) {
      console.log(`\n⚠️  ISSUES FOUND:`);
      issues.forEach(issue => {
        console.log(`   - ${issue.type}: ${issue.count || 'N/A'} occurrences`);
        if (issue.examples) {
          console.log(`     Examples: ${issue.examples.slice(0, 3).join(', ')}`);
        }
      });
      return { success: false, response: fullResponse, issues, chunks };
    } else {
      console.log(`\n✅ No issues detected!`);
      return { success: true, response: fullResponse, chunks };
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Starting Chat Output Sanity Tests');
  console.log(`📍 Testing endpoint: ${BASE_URL}`);
  
  // Generate test IDs
  const resourceId = `test-${Date.now()}`;
  const threadId = `thread-${Date.now()}`;
  const scenarioId = 'scenario-1';
  
  const results = [];
  
  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    const message = TEST_MESSAGES[i];
    const result = await testChatMessage(message, threadId, resourceId, scenarioId);
    results.push(result);
    
    // Wait a bit between messages
    if (i < TEST_MESSAGES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(80)}`);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Total tests: ${results.length}`);
  console.log(`✅ Passed: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log(`\n❌ Failed tests:`);
    results.forEach((result, idx) => {
      if (!result.success) {
        console.log(`   Test ${idx + 1}: "${TEST_MESSAGES[idx]}"`);
        if (result.issues) {
          result.issues.forEach(issue => {
            console.log(`     - ${issue.type}`);
          });
        }
        if (result.error) {
          console.log(`     - Error: ${result.error}`);
        }
      }
    });
    process.exit(1);
  } else {
    console.log(`\n🎉 All tests passed!`);
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

