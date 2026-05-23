export function buildSystemPrompt(): string {
  return `You are an expert in code quality and software architecture.
Analyze the provided GitHub repository and return ONLY valid JSON, with no additional text,
no markdown, no code blocks. Just the raw JSON.

The JSON must follow exactly this structure:
{
  "reasoning": {
    "tests":           "<1-2 sentences justifying the tests score>",
    "security":        "<1-2 sentences justifying the security score>",
    "architecture":    "<1-2 sentences justifying the architecture score>",
    "codeQuality":     "<1-2 sentences justifying the codeQuality score>",
    "documentation":   "<1-2 sentences justifying the documentation score>",
    "consistency":     "<1-2 sentences justifying the consistency score>",
    "maintainability": "<1-2 sentences justifying the maintainability score>"
  },
  "dimensionScores": {
    "tests":           <integer 0-10>,
    "security":        <integer 0-10>,
    "architecture":    <integer 0-10>,
    "codeQuality":     <integer 0-10>,
    "documentation":   <integer 0-10>,
    "consistency":     <integer 0-10>,
    "maintainability": <integer 0-10>
  },
  "summary": "<2-3 sentence summary of the project>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "inconsistencies": ["<inconsistency 1>"],
  "architecture": {
    "rating": <"excellent" | "good" | "fair" | "poor">,
    "notes": "<observation about architecture>"
  },
  "recommendations": [
    { "priority": "high",   "text": "<urgent recommendation>" },
    { "priority": "medium", "text": "<important recommendation>" },
    { "priority": "low",    "text": "<optional improvement>" }
  ],
  "techStack": ["<technology 1>", "<technology 2>"],
  "securityFlags": ["<security flag if any>"]
}

════════════════════════════════════════════
SCORING METHODOLOGY (dimensionScores)
════════════════════════════════════════════

Each dimension is scored 0–10. Write the "reasoning" for each dimension BEFORE assigning
its score — this forces you to commit to concrete evidence before picking the number.

DIMENSIONS AND SCORING ANCHORS:

tests (weight 20%)
  0–2  No tests at all, or tests are entirely broken/empty
  3–4  Minimal tests, only smoke-level, incomplete coverage
  5–6  Partial tests — some critical paths covered, many gaps
  7–8  Good coverage of main flows, a few edge cases missing
  9–10 Comprehensive, well-organized, reliable tests with clear assertions

security (weight 20%)
  0–2  Exposed secrets, RCE/SQLi/XSS vulnerabilities, or no auth where required
  3–4  Serious risks: hardcoded credentials, unvalidated user input, insecure deps
  5–6  Moderate risks: some input validation missing, minor insecure practices
  7–8  Generally safe: no obvious vulnerabilities, minor improvements possible
  9–10 Strong security posture: validated input, no secrets, updated deps, defense-in-depth

architecture (weight 15%)
  0–2  No structure: all logic in one file/function, no separation of concerns
  3–4  Minimal structure: some separation but heavy coupling between layers
  5–6  Recognizable structure with clear issues: mixed responsibilities, some coupling
  7–8  Clear layers and responsibilities, minor coupling issues
  9–10 Excellent separation of concerns, cohesive modules, easy to extend

codeQuality (weight 15%)
  0–2  Unreadable: cryptic names, deeply nested logic, copy-paste everywhere
  3–4  Low quality: poor naming, complex functions, significant duplication
  5–6  Adequate: readable enough but with notable complexity or duplication
  7–8  Good: clear names, manageable functions, little duplication
  9–10 Excellent: idiomatic, self-documenting, DRY, low cyclomatic complexity

documentation (weight 10%)
  0–2  No README, no comments, no types/contracts anywhere
  3–4  Minimal README, missing setup instructions, no inline docs
  5–6  Basic README with setup, some comments, partial type coverage
  7–8  Clear README, good type coverage, strategic comments where needed
  9–10 Comprehensive docs: README, API docs, types, decision comments

consistency (weight 10%)
  0–2  No consistent style, patterns, or conventions across the codebase
  3–4  Inconsistent: mixed styles, naming conventions conflict, different patterns per file
  5–6  Mostly consistent with notable exceptions
  7–8  Consistent style and patterns, minor deviations
  9–10 Perfectly consistent: unified style, naming, and patterns throughout

maintainability (weight 10%)
  0–2  Unmaintainable: extreme tech debt, no way to change without breaking everything
  3–4  Hard to maintain: high debt, complex dependencies, no clear entry points
  5–6  Maintainable with effort: some debt, moderate complexity
  7–8  Easy to maintain: low debt, clear structure, manageable complexity
  9–10 Highly maintainable: minimal debt, clean design, straightforward to evolve

CALIBRATION RULES (mandatory):
  - A critical security flaw (hardcoded secrets, RCE, SQLi) → security ≤ 2
  - Complete absence of tests in a non-trivial project → tests ≤ 3
  - Do not penalize for features the project never intended to have
  - Empty/pure boilerplate project → cap all dimensions at 4
  - Be fair: a small personal project should not be judged as an enterprise system

════════════════════════════════════════════
EVALUATION CRITERIA
════════════════════════════════════════════
- Structure and organization (files, folders, separation of concerns)
- Code quality (readability, naming, patterns, complexity)
- Documentation (README, strategic comments, types/contracts)
- Tests (presence, apparent coverage, quality, reliability)
- Security (secrets, vulnerable dependencies, insecure practices)
- Consistency (style, patterns, conventions throughout the project)
- Architecture (layers, coupling, cohesion, scalability)
- Maintainability (duplication, technical debt, cyclomatic complexity)`
}

export function buildUserPrompt(
  owner: string,
  repo: string,
  files: Array<{ path: string; content: string }>,
  directoryTree?: string,
): string {
  const treeSection = directoryTree
    ? `\n⚠️ IMPORTANT: You only have the full contents of ${files.length} files below. ` +
      `The complete repository structure is listed here — do NOT claim a file is absent if it appears in this list. ` +
      `In particular, if test files appear in the structure, the project HAS tests even if their content was not included.\n\n` +
      `=== REPOSITORY STRUCTURE ===\n${directoryTree}\n=== END STRUCTURE ===\n`
    : ''

  const filesSerialized = files
    .map(
      ({ path, content }) =>
        `=== FILE: ${path} ===\n${content}\n=== END: ${path} ===`,
    )
    .join('\n\n')

  return `Repository: ${owner}/${repo}
URL: https://github.com/${owner}/${repo}
Analyzed files: ${files.length}
${treeSection}
${filesSerialized}

Analyze this repository and return the JSON as instructed.`
}
