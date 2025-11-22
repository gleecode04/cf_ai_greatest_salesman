/**
 * Sales & Customer Support Chat App Frontend
 *
 * Handles the chat UI interactions and communication with the backend API.
 * Matches original Ming-main patterns for resource ID management and SSE streaming.
 * 
 * Original Reference: 
 * - src/cedar/components/chatComponents/SidePanelCedarChat.tsx
 * - src/app/scenario/page.tsx
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Chat state
let chatHistory = [
	{
		role: "assistant",
		content:
			"Hello! I'm here to help you practice your sales and customer support skills. How can I assist you today?",
	},
];
let isProcessing = false;

// Resource ID management (matching original localStorage pattern from SidePanelCedarChat.tsx:148-158)
let resourceId = localStorage.getItem("cedar_resourceId");
if (!resourceId) {
	// Generate 20-character alphanumeric resource ID (matching original pattern)
	resourceId = Array.from({ length: 20 }, () =>
		Math.floor(Math.random() * 36).toString(36)
	).join("");
	localStorage.setItem("cedar_resourceId", resourceId);
}

// Thread ID for conversation context
let threadId = `thread-${Date.now()}`;

// Chat type (scenario or transcript)
let chatType = "scenario"; // Default to scenario chat

// Auto-resize textarea as user types
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

// Send button click handler
sendButton.addEventListener("click", sendMessage);

/**
 * Sends a message to the chat API and processes the response
 */
async function sendMessage() {
	const message = userInput.value.trim();

	// Don't send empty messages
	if (message === "" || isProcessing) return;

	// Disable input while processing
	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	// Add user message to chat
	addMessageToChat("user", message);

	// Clear input
	userInput.value = "";
	userInput.style.height = "auto";

	// Show typing indicator
	typingIndicator.classList.add("visible");

	// Add message to history
	chatHistory.push({ role: "user", content: message });

	try {
		// Create new assistant response element
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantMessageEl.innerHTML = "<p></p>";
		chatMessages.appendChild(assistantMessageEl);

		// Scroll to bottom
		chatMessages.scrollTop = chatMessages.scrollHeight;

		// Send request to streaming API (matching original /api/chat/stream pattern)
		const response = await fetch("/api/chat/stream", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				prompt: message,
				additionalContext: {
					chatType: {
						data: chatType,
					},
				},
				resourceId: resourceId,
				threadId: threadId,
			}),
		});

		// Handle errors
		if (!response.ok) {
			throw new Error("Failed to get response");
		}

		// Process SSE streaming response (matching original SSE handling pattern)
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let responseText = "";
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			// Decode chunk
			buffer += decoder.decode(value, { stream: true });

			// Process SSE format (matching original streamUtils.ts pattern)
			// SSE format: "data:text\n\n" or "data:text\n"
			const lines = buffer.split("\n");
			buffer = lines.pop() || ""; // Keep incomplete line in buffer

			for (const line of lines) {
				if (line.startsWith("data:")) {
					// Extract data after "data:" - preserve ALL characters including spaces
					const data = line.substring(5); // Use substring instead of slice for clarity
					
					// Check for completion event (only skip if truly empty)
					if (data.length === 0) {
						continue; // Empty data line
					}

					// Try to parse as JSON (for error messages) - only trim for JSON parsing
					let isJson = false;
					try {
						const trimmedData = data.trim();
						if (trimmedData.startsWith("{")) {
							const jsonData = JSON.parse(trimmedData);
							if (jsonData.type === "error") {
								throw new Error(jsonData.message || "Error from server");
							}
							isJson = true;
						}
					} catch (e) {
						// Not JSON or parse error - treat as text
						isJson = false;
					}
					
					// If not JSON, treat as text chunk - preserve spaces exactly as received!
					if (!isJson && data.length > 0) {
						responseText += data;
						assistantMessageEl.querySelector("p").textContent = responseText;
						chatMessages.scrollTop = chatMessages.scrollHeight;
					}
				} else if (line.startsWith("event: done")) {
					// Stream completed
					break;
				}
			}
		}

		// Process any remaining buffer
		if (buffer) {
			const lines = buffer.split("\n");
			for (const line of lines) {
				if (line.startsWith("data:")) {
					const data = line.slice(5);
					// Only skip if it's JSON error or truly empty
					if (data && !data.trim().startsWith("{")) {
						responseText += data;
						assistantMessageEl.querySelector("p").textContent = responseText;
					}
				}
			}
		}

		// Add completed response to chat history
		chatHistory.push({ role: "assistant", content: responseText });
	} catch (error) {
		console.error("Error:", error);
		addMessageToChat(
			"assistant",
			"Sorry, there was an error processing your request.",
		);
	} finally {
		// Hide typing indicator
		typingIndicator.classList.remove("visible");

		// Re-enable input
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

/**
 * Helper function to add message to chat
 */
function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	messageEl.innerHTML = `<p>${content}</p>`;
	chatMessages.appendChild(messageEl);

	// Scroll to bottom
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Generate transcript from chat history (matching original pattern from SidePanelCedarChat.tsx)
 * Original Pattern: messages.map((m) => m.role === "user" ? `user: ${m.content}` : `bart: ${m.content}`).filter(Boolean).join("\n")
 */
function generateTranscript() {
	return chatHistory
		.map((m) => {
			if (m.role === "user") {
				return `user: ${m.content}`;
			} else {
				// Use chatType to determine agent name
				return `${chatType === "scenario" ? "customer" : "assistant"}: ${m.content}`;
			}
		})
		.filter(Boolean)
		.join("\n");
}

/**
 * Handle "End Scenario" button click (matching original handleStop() pattern)
 * Calls feedback workflow and generates report
 */
async function handleEndScenario() {
	if (isProcessing) {
		alert("Please wait for the current message to complete.");
		return;
	}

	const transcript = generateTranscript();
	if (transcript.split("\n").length < 3) {
		alert("Please have at least a few exchanges before ending the scenario.");
		return;
	}

	try {
		// Disable button
		const endBtn = document.getElementById("end-scenario-btn");
		endBtn.disabled = true;
		endBtn.textContent = "Generating Feedback...";

		// Call feedback workflow (matching original pattern)
		const response = await fetch("/api/feedback", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				transcript: transcript,
				resourceId: resourceId,
				threadId: threadId,
			}),
		});

		if (!response.ok) {
			throw new Error("Failed to generate feedback");
		}

		const result = await response.json();

		// Store feedback report in localStorage (matching original pattern)
		if (result.combinedReport) {
			localStorage.setItem("reportData", JSON.stringify({
				segmentedAnalysis: result.segmentedAnalysis,
				summaryAnalysis: result.summaryAnalysis,
				detailedFeedback: result.detailedFeedback,
				combinedReport: result.combinedReport,
			}));
		}

		// Show success message
		alert("Feedback generated! Check console for report data.");
		console.log("Feedback Report:", result);

		// Reset button
		endBtn.disabled = false;
		endBtn.textContent = "End Scenario & Get Feedback";
	} catch (error) {
		console.error("Error generating feedback:", error);
		alert("Error generating feedback. Please try again.");
		const endBtn = document.getElementById("end-scenario-btn");
		endBtn.disabled = false;
		endBtn.textContent = "End Scenario & Get Feedback";
	}
}

// Add event listener for "End Scenario" button
document.addEventListener("DOMContentLoaded", function() {
	const endBtn = document.getElementById("end-scenario-btn");
	if (endBtn) {
		endBtn.addEventListener("click", handleEndScenario);
	}
});

