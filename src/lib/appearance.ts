export function usesDarkMode(preferences: unknown) {
  const darkMode = (preferences as { darkMode?: boolean | string } | null)?.darkMode;
  return darkMode !== false && darkMode !== "false";
}

export function applyAppearance(darkMode: boolean) {
  document.documentElement.classList.toggle("dark", darkMode);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", darkMode ? "#0a1c15" : "#f6f9f7");
}
