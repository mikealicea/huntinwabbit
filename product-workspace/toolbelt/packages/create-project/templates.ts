export function indexTemplate(
  projectName: string,
  workspaceParent: string,
  date: string,
): string {
  return `---
parent:
  - "[[${workspaceParent}]]"
date: ${date}
status: 🟡 In Progress
---

# ${projectName}

## Overview

<!-- Describe the project purpose and goals here -->

## Notes

<!-- Key decisions, context, relevant links -->
`;
}

export function planTemplate(
  projectName: string,
  indexNoteName: string,
  date: string,
): string {
  return `---
parent:
  - "[[${indexNoteName}]]"
date: ${date}
---

# ${projectName} — Plan

## Objective

<!-- What does success look like? -->

## Approach

<!-- High-level plan -->

## Todo

<!-- Actionable steps — move items to todo/ doing/ done/ as you work -->
`;
}
