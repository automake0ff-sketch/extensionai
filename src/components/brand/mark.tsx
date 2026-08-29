export function ExtenAIMark({ className = "" }: { className?: string }) {
  // A simplified puzzle-piece nub -- the universal shape of a browser
  // extension icon -- used as the wordmark glyph instead of a generic logo.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 3.5a2 2 0 0 1 4 0V4h2.5A1.5 1.5 0 0 1 17 5.5V8h.5a2 2 0 0 1 0 4H17v2.5a1.5 1.5 0 0 1-1.5 1.5H13v.5a2 2 0 1 1-4 0V16H6.5A1.5 1.5 0 0 1 5 14.5V12h-.5a2 2 0 0 1 0-4H5V5.5A1.5 1.5 0 0 1 6.5 4H9v-.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
