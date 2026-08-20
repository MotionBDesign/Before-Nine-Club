import { execFile } from 'node:child_process';
import { log } from './log.ts';

function osascript(script: string): void {
  execFile('/usr/bin/osascript', ['-e', script], (error) => {
    if (error) log.debug('osascript failed (not on macOS?)', error.message);
  });
}

/** AppleScript strings need their own escaping; the text is not shell-quoted. */
function quote(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function notify(title: string, message: string, subtitle?: string): void {
  const parts = [`display notification "${quote(message)}"`, `with title "${quote(title)}"`];
  if (subtitle) parts.push(`subtitle "${quote(subtitle)}"`);
  osascript(parts.join(' '));
}

export function openUrl(url: string): void {
  execFile('/usr/bin/open', [url], (error) => {
    if (error) log.warn(`Could not open ${url}`, error.message);
  });
}
