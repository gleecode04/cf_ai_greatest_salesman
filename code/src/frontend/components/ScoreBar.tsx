/**
 * ScoreBar Component
 */

interface ScoreBarProps {
  category: string;
  score: number;
}

export default function ScoreBar({ category, score }: ScoreBarProps) {
  return (
    <div>
      <div className="mx-2 mt-2 mb-3">
        <div className="flex justify-between mb-1 max-md:text-sm">
          <span className="font-semibold text-gray-700">{category}</span>
          <span className="font-mono font-bold text-orange-600">{score}/100</span>
        </div>
        <div className="max-md:hidden w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="md:h-3 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500"
            style={{ width: `${score}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

