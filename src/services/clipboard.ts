export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback
  }

  // Fallback using textarea; focus goes back to the button that asked for the copy
  const previousFocus = document.activeElement as HTMLElement | null;
  const textArea = document.createElement('textarea');
  try {
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    return document.execCommand('copy');
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  } finally {
    textArea.remove();
    previousFocus?.focus?.();
  }
}
