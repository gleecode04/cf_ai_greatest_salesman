/**
 * History Page Logic
 * 
 * Displays list of past sessions
 */

/**
 * Load sessions from localStorage (for now - will be replaced with API call)
 */
function loadSessions() {
	// For UI preview, show placeholder sessions
	const placeholderSessions = [
		{
			id: "session-1",
			threadId: "thread-123",
			createdAt: Date.now() - 86400000, // 1 day ago
			scenarioType: "Sales Pitch",
			scores: {
				empathy: 85,
				clarity: 90,
				assertiveness: 75,
				persuasion: 80,
			},
			summary: "You demonstrated strong product knowledge and handled pricing objections well.",
		},
		{
			id: "session-2",
			threadId: "thread-456",
			createdAt: Date.now() - 172800000, // 2 days ago
			scenarioType: "Customer Support",
			scores: {
				empathy: 88,
				clarity: 85,
				assertiveness: 70,
				persuasion: 75,
			},
			summary: "Good customer service skills with empathetic responses to concerns.",
		},
	];

	renderSessions(placeholderSessions);
}

/**
 * Render sessions list
 */
function renderSessions(sessions) {
	const container = document.getElementById("sessions-list");
	container.innerHTML = "";

	if (sessions.length === 0) {
		container.innerHTML = `
			<div class="session-item placeholder">
				<div class="session-header">
					<h3>No sessions yet</h3>
					<span class="session-date">Complete a scenario to see your history</span>
				</div>
			</div>
		`;
		return;
	}

	sessions.forEach((session) => {
		const sessionItem = createSessionItem(session);
		container.appendChild(sessionItem);
	});
}

/**
 * Create a session item element
 */
function createSessionItem(session) {
	const item = document.createElement("div");
	item.className = "session-item";
	item.onclick = () => viewSession(session.threadId);

	const date = new Date(session.createdAt);
	const dateStr = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	const scoresHtml = Object.entries(session.scores || {})
		.map(([category, score]) => {
			const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
			return `<span class="score-badge"><strong>${categoryName}:</strong> ${score}/100</span>`;
		})
		.join("");

	item.innerHTML = `
		<div class="session-header">
			<h3>${session.scenarioType || "Practice Session"}</h3>
			<span class="session-date">${dateStr}</span>
		</div>
		<div class="session-preview">
			<div class="session-scores">
				${scoresHtml}
			</div>
		</div>
		<div class="session-summary">
			${session.summary || "No summary available"}
		</div>
	`;

	return item;
}

/**
 * View a specific session (navigate to report page)
 */
function viewSession(threadId) {
	// Store threadId for report page to load
	localStorage.setItem("viewThreadId", threadId);
	// Navigate to report page
	window.location.href = "report.html";
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
	loadSessions();
});

