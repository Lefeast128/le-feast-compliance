export function correctiveActionReady(action: string, note: string) {
  return Boolean(action.trim()) && (action !== "Other" || Boolean(note.trim()));
}

export function temperatureActionNote(action: string, note: string) {
  const trimmedNote = note.trim();
  return trimmedNote ? `${action} — ${trimmedNote}` : action;
}
