/**
 * SSE Streaming Utilities
 */

/**
 * Uses SSE data-only format.
 * Only uses 'event: done' with empty data for completion.
 * All other content goes through 'data:' field only.
 * 
 *  Matches streamUtils.ts lines 8-39 exactly
 */
export function createSSEStream(
  cb: (controller: ReadableStreamDefaultController<Uint8Array>) => Promise<void>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await cb(controller);
        // Signal completion with empty data ( line 18-19)
        controller.enqueue(encoder.encode('event: done\n'));
        controller.enqueue(encoder.encode('data:\n\n'));
      } catch (err) {
        console.error('Error during SSE stream', err);

        const message = err instanceof Error ? err.message : 'Internal error';
        controller.enqueue(encoder.encode('data: '));
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'error', message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Emit any JSON object as a data event.
 * Used for actions, tool responses, custom events, etc.
 * 
 *  Matches streamUtils.ts lines 45-53 exactly
 */
export function streamJSONEvent<T>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  eventType: string,
  eventData: T,
) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode('data: '));
  controller.enqueue(encoder.encode(`${JSON.stringify(eventData)}\n\n`));
}

/**
 * Handles streaming of text chunks to SSE controller
 *
 *  Matches streamUtils.ts lines 62-74 exactly
 *
 * @param chunk - Text chunk to stream
 * @param streamController - SSE stream controller
 * @returns The chunk text (for accumulation)
 */
export async function handleTextStream(
  chunk: string,
  streamController: ReadableStreamDefaultController<Uint8Array>,
): Promise<string> {
  const encoder = new TextEncoder();

  // Log chunk being sent (first few chunks for debugging)
  if (typeof chunk === 'string' && chunk.length > 0) {
    // Only log first 3 chunks to avoid spam
    const chunkIndex = (streamController as any)._chunkIndex || 0;
    if (chunkIndex < 3) {
      console.log(`[streamUtils] Sending chunk ${chunkIndex}:`, JSON.stringify(chunk.substring(0, 50)));
    }
    (streamController as any)._chunkIndex = chunkIndex + 1;
  }

  // Escape literal newlines for SSE compliance ( line 70)
  // IMPORTANT: Don't modify the chunk content - preserve all spaces and characters
  const escaped = chunk.replace(/\n/g, '\\n');
  
  // Send as JSON to preserve all characters exactly
  const jsonChunk = JSON.stringify({ type: "text", content: chunk });
  streamController.enqueue(encoder.encode(`data:${jsonChunk}\n\n`));

  return chunk;
}

