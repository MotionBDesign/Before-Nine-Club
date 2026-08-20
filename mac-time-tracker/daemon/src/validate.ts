import fs from 'node:fs';
import type { Config, Rule } from './types.ts';
import { compileRegex } from './regex.ts';
import { expandHome } from './paths.ts';

export interface Problem {
  severity: 'error' | 'warning';
  message: string;
}

const RULE_WHEN_KEYS = new Set(['bundleId', 'appRegex', 'titleRegex', 'pathRegex', 'pathContains', 'urlRegex']);
const RULE_THEN_KEYS = new Set(['taskId', 'taskIdFrom', 'folder', 'folderFrom', 'list', 'space', 'taskQueryFrom']);

/**
 * Catch the mistakes that would otherwise show up as "it just isn't
 * suggesting anything" three days later. Everything here is reported by
 * `cli.ts doctor` and logged once at startup.
 */
export function validateConfig(config: Config): Problem[] {
  const problems: Problem[] = [];

  if (!config.clickup.workspaceId) {
    problems.push({ severity: 'error', message: 'clickup.workspaceId is empty; nothing can be pushed.' });
  } else if (!/^\d+$/.test(config.clickup.workspaceId)) {
    problems.push({ severity: 'error', message: `clickup.workspaceId "${config.clickup.workspaceId}" should be digits only.` });
  }

  if (!Array.isArray(config.projectRoots)) {
    problems.push({ severity: 'error', message: 'projectRoots must be an array of { path, clientSegment }.' });
  } else {
    for (const root of config.projectRoots) {
      if (typeof root?.path !== 'string' || !root.path) {
        problems.push({ severity: 'error', message: 'Every projectRoots entry needs a "path".' });
        continue;
      }
      if (!Number.isInteger(root.clientSegment) || root.clientSegment < 0) {
        problems.push({ severity: 'error', message: `projectRoots "${root.path}" needs a clientSegment of 0 or more.` });
      }
      const expanded = expandHome(root.path);
      if (!expanded.startsWith('/')) {
        problems.push({ severity: 'error', message: `projectRoots "${root.path}" must be an absolute path.` });
      } else if (!fs.existsSync(expanded)) {
        // Normal for a network share that isn't mounted yet, so not an error.
        problems.push({
          severity: 'warning',
          message: `projectRoots "${expanded}" is not present right now. If that is the file server, mount it; client detection falls back to folder-name matching meanwhile.`,
        });
      }
    }
    if (config.projectRoots.length === 0) {
      problems.push({
        severity: 'warning',
        message: 'No projectRoots set. Client detection works only where a ClickUp folder name appears verbatim in the path.',
      });
    }
  }

  const capture = config.capture;
  if (capture.sampleIntervalSeconds < 1 || capture.sampleIntervalSeconds > 60) {
    problems.push({ severity: 'error', message: 'capture.sampleIntervalSeconds should be between 1 and 60.' });
  }
  if (capture.idleThresholdSeconds < capture.sampleIntervalSeconds) {
    problems.push({
      severity: 'error',
      message: 'capture.idleThresholdSeconds is below the sample interval, so every sample counts as idle.',
    });
  }
  if (capture.minBlockSeconds >= capture.mergeGapSeconds) {
    problems.push({
      severity: 'warning',
      message: 'capture.minBlockSeconds is at or above mergeGapSeconds; short pieces of work will be absorbed rather than merged.',
    });
  }
  if (capture.roundToMinutes > 0 && capture.minEntryMinutes > 0 && capture.minEntryMinutes % capture.roundToMinutes !== 0) {
    problems.push({
      severity: 'warning',
      message: `capture.minEntryMinutes (${capture.minEntryMinutes}) is not a multiple of roundToMinutes (${capture.roundToMinutes}).`,
    });
  }

  for (const [field, patterns] of Object.entries(config.ignore)) {
    if (!Array.isArray(patterns)) {
      problems.push({ severity: 'error', message: `ignore.${field} must be an array.` });
      continue;
    }
    if (field === 'bundleIds') continue;
    for (const pattern of patterns as string[]) {
      if (!compileRegex(pattern)) {
        problems.push({ severity: 'error', message: `ignore.${field} pattern will not compile: ${pattern}` });
      }
    }
  }

  if (config.server.host !== '127.0.0.1' && config.server.host !== 'localhost') {
    problems.push({
      severity: 'error',
      message: `server.host is "${config.server.host}". The review UI has no authentication and must stay on loopback.`,
    });
  }
  if (config.server.port < 1024 || config.server.port > 65535) {
    problems.push({ severity: 'error', message: 'server.port should be between 1024 and 65535.' });
  }

  if (config.clickup.onlyMyTasks) {
    problems.push({
      severity: 'warning',
      message: 'clickup.onlyMyTasks is on. Most tasks in this workspace have no assignee, so the catalog will be nearly empty.',
    });
  }

  const { dailyMinutes, billableMinutes } = config.targets;
  if (!Number.isFinite(dailyMinutes) || dailyMinutes < 0 || dailyMinutes > 1440) {
    problems.push({ severity: 'error', message: `targets.dailyMinutes (${dailyMinutes}) must be between 0 and 1440.` });
  }
  if (!Number.isFinite(billableMinutes) || billableMinutes < 0 || billableMinutes > 1440) {
    problems.push({ severity: 'error', message: `targets.billableMinutes (${billableMinutes}) must be between 0 and 1440.` });
  }
  if (billableMinutes > dailyMinutes) {
    problems.push({ severity: 'warning', message: 'targets.billableMinutes is above dailyMinutes; the billable goal alone will drive the display.' });
  }

  config.quickLog.forEach((button, index) => {
    const where = `quickLog[${index}]${button?.label ? ` ("${button.label}")` : ''}`;
    if (!button?.label) problems.push({ severity: 'error', message: `${where} needs a label.` });
    if (!button?.taskId) problems.push({ severity: 'error', message: `${where} needs a taskId.` });
    if (!Number.isFinite(button?.minutes) || button.minutes <= 0 || button.minutes > 480) {
      problems.push({ severity: 'error', message: `${where} needs minutes between 1 and 480.` });
    }
    if (typeof button?.billable !== 'boolean') {
      problems.push({ severity: 'error', message: `${where} needs billable: true or false.` });
    }
  });

  for (const hour of config.review.notifyHours) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      problems.push({ severity: 'error', message: `review.notifyHours contains "${hour}"; hours must be 0-23.` });
    }
  }

  return problems;
}

export function validateRules(rules: Rule[]): Problem[] {
  const problems: Problem[] = [];
  const seen = new Set<string>();

  rules.forEach((rule, index) => {
    const where = rule.name ? `rule "${rule.name}"` : `rule #${index + 1}`;

    if (!rule.name) problems.push({ severity: 'warning', message: `${where} has no name; reasons shown in the UI will be unhelpful.` });
    else if (seen.has(rule.name)) problems.push({ severity: 'warning', message: `Two rules are both named "${rule.name}".` });
    seen.add(rule.name);

    const whenKeys = Object.keys(rule.when ?? {});
    if (whenKeys.length === 0) {
      problems.push({ severity: 'error', message: `${where} has an empty "when" and will never fire.` });
    }
    for (const key of whenKeys) {
      if (!RULE_WHEN_KEYS.has(key)) {
        problems.push({ severity: 'error', message: `${where}: "${key}" is not a valid "when" field. Valid: ${[...RULE_WHEN_KEYS].join(', ')}` });
      }
    }
    for (const key of Object.keys(rule.then ?? {})) {
      if (!RULE_THEN_KEYS.has(key)) {
        problems.push({ severity: 'error', message: `${where}: "${key}" is not a valid "then" field. Valid: ${[...RULE_THEN_KEYS].join(', ')}` });
      }
    }

    const captures = new Set<string>();
    for (const key of ['appRegex', 'titleRegex', 'pathRegex', 'urlRegex'] as const) {
      const pattern = rule.when?.[key];
      if (!pattern) continue;
      const regex = compileRegex(pattern);
      if (!regex) {
        problems.push({ severity: 'error', message: `${where}: ${key} will not compile: ${pattern}` });
        continue;
      }
      for (const match of pattern.matchAll(/\(\?<([A-Za-z_][A-Za-z0-9_]*)>/g)) {
        if (match[1]) captures.add(match[1]);
      }
    }

    // A `*From` that names a group no regex defines is silently inert, which
    // is exactly the kind of typo that looks like "matching is broken".
    for (const key of ['taskIdFrom', 'folderFrom', 'taskQueryFrom'] as const) {
      const group = rule.then?.[key];
      if (group && !captures.has(group)) {
        problems.push({
          severity: 'error',
          message: `${where}: ${key} refers to capture group "${group}", but no pattern in this rule defines (?<${group}>...).`,
        });
      }
    }

    if (!rule.ignore && Object.keys(rule.then ?? {}).length === 0) {
      problems.push({ severity: 'warning', message: `${where} has an empty "then" and cannot narrow anything.` });
    }
    if (typeof rule.weight !== 'number' || rule.weight <= 0) {
      problems.push({ severity: 'warning', message: `${where} has no positive weight; it will be treated as the default.` });
    }
  });

  return problems;
}
