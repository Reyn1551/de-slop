import type { ProseFinding, ProseRuleFn } from '../types';
import { report } from '../utils';

// humanizer §19 — every list item gets a bold label and a colon.
const BOLD_LABEL = /^[ \t]*[-*+][ \t]+\*\*[^*\n]{2,40}:\*\*/;
const MINIMUM_ITEMS = 3;

export const noBoldDecoration: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  const lines = context.text.split('\n');

  let run = 0;
  let runStart = 0;
  let offset = 0;
  for (const line of lines) {
    if (BOLD_LABEL.test(line)) {
      if (run === 0) runStart = offset;
      run += 1;
    } else {
      if (run >= MINIMUM_ITEMS) {
        findings.push(
          report(
            context,
            runStart,
            'warning',
            `${run} list items use a bold label plus colon — turn them into prose or drop the bold`,
          ),
        );
      }
      run = 0;
    }
    offset += line.length + 1;
  }
  if (run >= MINIMUM_ITEMS) {
    findings.push(
      report(
        context,
        runStart,
        'warning',
        `${run} list items use a bold label plus colon — turn them into prose or drop the bold`,
      ),
    );
  }

  return findings;
};
