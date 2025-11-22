/**
 * ScoreBar Component
 * 
 * Original Reference: src/components/ScoreBar.tsx
 * Migrated to vanilla JavaScript
 */

const ScoreBar = {
	/**
	 * Create a score bar element
	 */
	create(category, score) {
		const container = document.createElement("div");
		container.className = "score-item";

		const label = document.createElement("div");
		label.className = "score-label";
		label.innerHTML = `
			<span>${category}</span>
			<span>${score}/100</span>
		`;

		const barContainer = document.createElement("div");
		barContainer.className = "score-bar-container";

		const barFill = document.createElement("div");
		barFill.className = "score-bar-fill";
		barFill.style.width = `${score}%`;

		barContainer.appendChild(barFill);
		container.appendChild(label);
		container.appendChild(barContainer);

		return container;
	},
};

// Export for use in other scripts
if (typeof window !== "undefined") {
	window.ScoreBar = ScoreBar;
}

