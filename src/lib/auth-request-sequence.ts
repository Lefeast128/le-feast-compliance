/**
 * Prevents a session bootstrap request started before login/logout from
 * overwriting the newer authentication state when that request completes late.
 */
export function createAuthRequestSequence() {
  let revision = 0;
  return {
    beginMutation() {
      revision += 1;
      return revision;
    },
    capture() {
      return revision;
    },
    isCurrent(candidate: number) {
      return candidate === revision;
    },
  };
}
