export function isAdminQueryKey(key: readonly unknown[]) {
  const [scope, , workspaceView] = key;
  return (typeof scope === "string" && scope.startsWith("admin-")) ||
    (scope === "workspace" && typeof workspaceView === "string" &&
      (workspaceView.startsWith("admin-") || workspaceView === "ice-vault-admin")) ||
    (scope === "support" && workspaceView === true);
}
