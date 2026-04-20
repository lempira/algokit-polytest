import * as fs from "node:fs";
import process from "node:process";
import { parse } from "@std/csv";

function sanitizeContent(content: string): string {
  return content
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, "");
}

interface JiraIssue {
  summary: string;
  issueKey: string;
  issueType: string;
  description: string;
  acceptanceCriteria?: string;
  parentKey?: string;
  parentSummary?: string;
}

interface ConfigOutput {
  name: string;
  package_name: string;
  resource_dir: string;
  version: string;
  suite: Record<string, {
    desc: string;
    groups: string[];
  }>;
  group: Record<string, {
    desc: string;
    test: Record<string, {
      desc: string;
    }>;
  }>;
  target: Record<string, any>;
  document: Record<string, any>;
}

function formatDescription(
  key: string,
  name: string,
  description: string,
  acceptanceCriteria?: string,
): string {
  let result = `${key}: ${name}`;
  if (description && description.trim()) {
    result += `. ${description.trim()}`;
  }
  if (acceptanceCriteria && acceptanceCriteria.trim()) {
    result += `\n\nAcceptance Criteria:\n${acceptanceCriteria.trim()}`;
  }
  return result;
}

function parseCSVFile(filePath: string): JiraIssue[] {
  const content = fs.readFileSync(filePath, "utf-8");

  // Sanitize content to remove control characters
  const sanitizedContent = sanitizeContent(content);

  // Parse as arrays without column constraints
  const records = parse(sanitizedContent) as string[][];

  if (records.length === 0) {
    return [];
  }

  const headers = records[0];

  // Find column indices
  const summaryIdx = headers.indexOf("Summary");
  const keyIdx = headers.indexOf("Issue key");
  const typeIdx = headers.indexOf("Issue Type");
  const descIdx = headers.indexOf("Description");
  const acceptanceCriteriaIdx = headers.indexOf(
    "Custom field (Acceptance Criteria)",
  );
  const parentKeyIdx = headers.indexOf("Parent key");
  const parentSummaryIdx = headers.indexOf("Parent summary");

  const issues: JiraIssue[] = [];

  for (let i = 1; i < records.length; i++) {
    const fields = records[i];
    if (fields.length < headers.length) continue;

    const issueType = fields[typeIdx]?.trim();

    if (issueType === "Epic" || issueType === "Story") {
      issues.push({
        summary: fields[summaryIdx]?.trim() || "",
        issueKey: fields[keyIdx]?.trim() || "",
        issueType: issueType,
        description: fields[descIdx]?.trim() || "",
        acceptanceCriteria: acceptanceCriteriaIdx >= 0
          ? fields[acceptanceCriteriaIdx]?.trim() || undefined
          : undefined,
        parentKey: fields[parentKeyIdx]?.trim() || undefined,
        parentSummary: fields[parentSummaryIdx]?.trim() || undefined,
      });
    }
  }

  return issues;
}

function loadExistingConfig(existingConfigPath: string): ConfigOutput {
  const content = fs.readFileSync(existingConfigPath, "utf-8");
  return JSON.parse(content) as ConfigOutput;
}

function generateConfig(
  issues: JiraIssue[],
  existingConfigPath: string,
): ConfigOutput {
  // Load existing config or use defaults
  const existingConfig = loadExistingConfig(existingConfigPath);

  const epics = issues.filter((i) => i.issueType === "Epic");
  const stories = issues.filter((i) => i.issueType === "Story");

  const suite: Record<string, { desc: string; groups: string[] }> = {};
  const group: Record<
    string,
    { desc: string; test: Record<string, { desc: string }> }
  > = {};

  // Process epics
  for (const epic of epics) {
    const epicKey = epic.issueKey;
    const epicName = epic.summary;
    const epicDesc = epic.description;
    const formattedDesc = formatDescription(
      epicKey,
      epicName,
      epicDesc,
      epic.acceptanceCriteria,
    );

    const suiteId = `Epic ${epicKey}`;
    const groupId = `${epicKey} Stories`;

    // Add to suite
    suite[suiteId] = {
      desc: formattedDesc,
      groups: [groupId],
    };

    // Add to group (empty initially)
    group[groupId] = {
      desc: formattedDesc,
      test: {},
    };
  }

  // Process stories and add to their parent epic
  for (const story of stories) {
    const storyKey = story.issueKey;
    const storyName = story.summary;
    const storyDesc = story.description;
    const formattedDesc = formatDescription(
      storyKey,
      storyName,
      storyDesc,
      story.acceptanceCriteria,
    );
    const parentGroupId = `${story.parentKey} Stories`;

    if (group[parentGroupId]) {
      group[parentGroupId].test[storyKey] = {
        desc: formattedDesc,
      };
    } else {
      throw Error(`Could not resolve group ${parentGroupId}`);
    }
  }

  // Merge: keep existing config but update suite and group
  return {
    ...existingConfig as ConfigOutput,
    suite,
    group,
  };
}

function main() {
  const args = process.argv.slice(2);
  const jiraCsv = args[0];
  const polytestJson = args[1];

  console.log(`Parsing ${jiraCsv}...`);
  const issues = parseCSVFile(jiraCsv);

  console.log(
    `Found ${issues.length} issues (${
      issues.filter((i) => i.issueType === "Epic").length
    } epics, ${issues.filter((i) => i.issueType === "Story").length} stories)`,
  );

  const config = generateConfig(issues, polytestJson);

  fs.writeFileSync(polytestJson, JSON.stringify(config, null, 2));
  console.log(`Generated JSONC config at ${polytestJson}`);
}

main();
