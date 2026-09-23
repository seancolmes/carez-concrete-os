export function getPourStatusLabel(state) {
  if (state === "ready") return "Pending pour";
  return "Scheduled";
}
