// ── Not Found ────────────────────────────────────────
export function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found`,
  });
}
