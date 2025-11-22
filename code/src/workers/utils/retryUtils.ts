/**
 * Retry Utilities for Workers AI
 * 
 * Handles retryable network errors with exponential backoff
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  retryable?: (error: any) => boolean;
}

/**
 * Retry a function with exponential backoff
 * Retry utility for network operations
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    retryable = (error: any) => {
      // Check if error is retryable (network errors, timeouts, etc.)
      if (error?.retryable === true) return true;
      if (error?.message?.includes("Network connection lost")) return true;
      if (error?.message?.includes("timeout")) return true;
      return false;
    },
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on last attempt or if error is not retryable
      if (attempt === maxRetries || !retryable(error)) {
        throw error;
      }

      // Calculate exponential backoff delay
      const backoffDelay = Math.min(delay * Math.pow(2, attempt), maxDelay);
      
      console.log(
        `[retryWithBackoff] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${backoffDelay}ms...`,
        error?.message || error
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError;
}

