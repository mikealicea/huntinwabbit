export function ThemeSwitch({
  isHydrated,
  isDark,
  nextTheme,
  onToggle,
}: {
  isHydrated: boolean;
  isDark: boolean;
  nextTheme: 'light' | 'dark';
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-ghost min-h-11"
      disabled={!isHydrated}
      aria-label={isHydrated ? `Switch to ${nextTheme} theme` : 'Theme loading'}
      onClick={onToggle}
    >
      {isHydrated ? `${isDark ? 'Light' : 'Dark'} mode` : 'Theme'}
    </button>
  );
}
