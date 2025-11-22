/**
 * Report Page Logic
 * 
 * Original Reference: src/app/report/page.tsx
 * Migrated to vanilla JavaScript for Cloudflare Pages
 */

// Section state
const sections = {
	summary: false,
	evaluation: true,
	suggestions: false,
	transcript: true,
};

// Report data
let reportData = {
	summary: null,
	feedback: null,
	suggestions: null,
	segments: [],
	scores: [],
};

/**
 * Toggle section open/closed
 */
function toggleSection(sectionName) {
	sections[sectionName] = !sections[sectionName];
	const content = document.getElementById(`${sectionName}-content`);
	const chevron = document.getElementById(`${sectionName}-chevron`);

	if (sections[sectionName]) {
		content.classList.add("open");
		chevron.textContent = "▲";
	} else {
		content.classList.remove("open");
		chevron.textContent = "▼";
	}
}

/**
 * Load report data from localStorage
 * Original Pattern: Matches report/page.tsx lines 48-64
 */
function loadReportData() {
	const stored = localStorage.getItem("reportData");
	if (!stored) {
		console.log("No report data found in localStorage");
		// Show placeholder data for UI preview
		loadPlaceholderData();
		return;
	}

	try {
		// Parse the stored data (should be JSON string)
		const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
		
		// Use parser to extract structured data
		if (typeof Parser !== "undefined") {
			reportData = Parser(parsed.combinedReport || stored);
		} else {
			// Fallback if parser not loaded
			reportData = {
				summary: parsed.summaryAnalysis || "No summary available",
				feedback: parsed.summaryAnalysis || "No feedback available",
				suggestions: "No suggestions available",
				segments: [],
				scores: defaultScores,
			};
		}

		renderReport();
	} catch (error) {
		console.error("Error loading report data:", error);
		loadPlaceholderData();
	}
}

/**
 * Load placeholder data for UI preview
 */
function loadPlaceholderData() {
	reportData = {
		summary: `## CONVERSATION OVERVIEW
This was a sales conversation where you demonstrated strong product knowledge and addressed customer concerns about pricing and quality. The customer was skeptical but engaged, asking specific questions about value proposition and ROI.

## USER PERFORMANCE ANALYSIS
You effectively explained the product's unique features and compared it to competitors. You handled pricing objections well by focusing on long-term value. However, you could have been more proactive in uncovering the customer's specific needs earlier in the conversation.`,
		feedback: `You showed good product knowledge and handled objections professionally. Your explanations were clear and you maintained a consultative approach throughout.`,
		suggestions: `1. Ask more discovery questions early in the conversation to understand specific customer needs
2. Use more specific examples and case studies to support your value proposition
3. Address price concerns more directly with ROI calculations
4. Practice closing techniques to move the conversation toward a decision`,
		segments: [
			{
				title: "Opening & Rapport Building",
				content: `user: Hello, I'm interested in learning more about your product.
customer: Hi, I've been looking at similar products. What makes yours different?
user: <comment color="green" feedback="Good opening">Great question! Our product offers several unique features</comment> that set it apart from competitors.`,
			},
			{
				title: "Objection Handling",
				content: `customer: That's a pretty bold claim. Can you provide some actual numbers?
user: <comment color="yellow" feedback="Could be more specific">Absolutely, I can share some data with you</comment>. Our customers typically see a 30% improvement.
customer: How does that compare to other premium options?`,
			},
		],
		scores: [
			{ category: "Empathy", score: 85 },
			{ category: "Clarity", score: 90 },
			{ category: "Assertiveness", score: 75 },
			{ category: "Persuasion", score: 80 },
			{ category: "Active Listening", score: 88 },
			{ category: "Objection Handling", score: 82 },
			{ category: "Closing Ability", score: 70 },
		],
	};

	renderReport();
}

/**
 * Default scores (matching original pattern)
 */
const defaultScores = [
	{ category: "Empathy", score: 85 },
	{ category: "Clarity", score: 90 },
	{ category: "Assertiveness", score: 75 },
	{ category: "Persuasion", score: 80 },
	{ category: "Active Listening", score: 88 },
	{ category: "Objection Handling", score: 82 },
	{ category: "Closing Ability", score: 70 },
];

/**
 * Render the report sections
 */
function renderReport() {
	renderSummary();
	renderScores();
	renderSuggestions();
	renderTranscript();
}

/**
 * Render summary section
 */
function renderSummary() {
	const summaryText = document.getElementById("summary-text");
	if (reportData.summary) {
		// Simple markdown-like rendering
		const html = reportData.summary
			.replace(/##\s*(.+)/g, "<h3>$1</h3>")
			.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
			.replace(/\n\n/g, "</p><p>")
			.replace(/^(.+)$/gm, "<p>$1</p>");
		summaryText.innerHTML = html;
	} else {
		summaryText.textContent = "No summary available";
	}
}

/**
 * Render scores section
 */
function renderScores() {
	const container = document.getElementById("scores-container");
	container.innerHTML = "";

	const scores = reportData.scores || defaultScores;
	scores.forEach((score) => {
		if (typeof ScoreBar !== "undefined") {
			const scoreBar = ScoreBar.create(score.category, score.score);
			container.appendChild(scoreBar);
		} else {
			// Fallback if ScoreBar component not loaded
			const scoreItem = document.createElement("div");
			scoreItem.className = "score-item";
			scoreItem.innerHTML = `
				<div class="score-label">
					<span>${score.category}</span>
					<span>${score.score}/100</span>
				</div>
				<div class="score-bar-container">
					<div class="score-bar-fill" style="width: ${score.score}%"></div>
				</div>
			`;
			container.appendChild(scoreItem);
		}
	});
}

/**
 * Render suggestions section
 */
function renderSuggestions() {
	const suggestionsText = document.getElementById("suggestions-text");
	if (reportData.suggestions) {
		// Simple markdown-like rendering
		const html = reportData.suggestions
			.replace(/^\d+\.\s*(.+)$/gm, "<p><strong>$1</strong></p>")
			.replace(/\n\n/g, "</p><p>")
			.replace(/^(.+)$/gm, "<p>$1</p>");
		suggestionsText.innerHTML = html;
	} else {
		suggestionsText.textContent = "No suggestions available";
	}
}

/**
 * Render annotated transcript section
 */
function renderTranscript() {
	const transcriptContainer = document.getElementById("annotated-transcript-container");
	const chatContainer = document.getElementById("transcript-chat-container");

	if (typeof AnnotatedTranscript !== "undefined") {
		AnnotatedTranscript.render(transcriptContainer, reportData.segments);
	} else {
		// Fallback
		transcriptContainer.innerHTML = "<p>Annotated transcript will appear here</p>";
	}

	if (typeof TranscriptChatPanel !== "undefined") {
		TranscriptChatPanel.render(chatContainer, {
			segments: reportData.segments,
			feedback: reportData.feedback,
			suggestions: reportData.suggestions,
			scores: reportData.scores,
		});
	} else {
		// Fallback
		chatContainer.innerHTML = "<p>Chat panel will appear here</p>";
	}
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
	loadReportData();
	
	// Initialize section states
	Object.keys(sections).forEach((section) => {
		if (sections[section]) {
			toggleSection(section);
		}
	});
});

