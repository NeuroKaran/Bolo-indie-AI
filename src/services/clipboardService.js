// ========================================
// Clipboard Service
// ========================================

import { formatPromptAsMarkdown } from './promptService';

/**
 * Copy structured prompt to clipboard as formatted markdown.
 * Returns true on success.
 */
export async function copyPromptToClipboard(prompt) {
    const markdown = formatPromptAsMarkdown(prompt);
    return copyTextToClipboard(markdown);
}

/**
 * Copy raw text to clipboard
 */
export async function copyTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for older browsers
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (fallbackErr) {
            console.error('Failed to copy to clipboard:', fallbackErr);
            return false;
        }
    }
}
