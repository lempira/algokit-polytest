import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";

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

function parseCSVRecords(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, "utf-8");

  // Remove BOM if present
  const cleanContent = content.charCodeAt(0) === 0xFEFF
    ? content.slice(1)
    : content;

  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < cleanContent.length) {
    const char = cleanContent[i];
    const nextChar = cleanContent[i + 1];

    if (char === '"') {
      if (inQuotes) {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        // Start of quoted field
        inQuotes = true;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (currentField !== "" || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        records.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      // Handle \r\n
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
    } else {
      currentField += char;
    }

    i++;
  }

  // Handle last field/row if file doesn't end with newline
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    records.push(currentRow);
  }

  return records;
}

function parseCSVFile(filePath: string): JiraIssue[] {
  const records = parseCSVRecords(filePath);

  if (records.length === 0) {
    return [];
  }

  const headers = records[0];

  // Find column indices
  const summaryIdx = headers.indexOf("Summary");
  const keyIdx = headers.indexOf("Issue key");
  const typeIdx = headers.indexOf("Issue Type");
  const descIdx = headers.indexOf("Description");
  const acceptanceCriteriaIdx = headers.indexOf("Custom field (Acceptance Criteria)");
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

function generateConfig(issues: JiraIssue[]): ConfigOutput {
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
    const formattedDesc = formatDescription(epicKey, epicName, epicDesc, epic.acceptanceCriteria);

    // Add to suite
    suite[epicKey] = {
      desc: formattedDesc,
      groups: [epicKey],
    };

    // Add to group (empty initially)
    group[epicKey] = {
      desc: formattedDesc,
      test: {},
    };
  }

  // Process stories and add to their parent epic
  for (const story of stories) {
    const storyKey = story.issueKey;
    const storyName = story.summary;
    const storyDesc = story.description;
    const parentKey = story.parentKey;
    const formattedDesc = formatDescription(storyKey, storyName, storyDesc, story.acceptanceCriteria);

    if (parentKey && group[parentKey]) {
      group[parentKey].test[storyKey] = {
        desc: formattedDesc,
      };
    } else {
      // If no parent or parent not found, add to a default group
      const defaultKey = "Uncategorized";
      if (!group[defaultKey]) {
        group[defaultKey] = {
          desc: "Uncategorized stories",
          test: {},
        };
      }
      group[defaultKey].test[storyKey] = {
        desc: formattedDesc,
      };
    }
  }

  return {
    name: "Wallet utilities",
    package_name: "algokit_utils",
    resource_dir: "../resources/",
    version: "0.7.0",
    suite,
    group,
    target: {
      pytest: {
        out_dir: "../../tests/modules/transact",
        resource_dir: "../../tests/modules/transact/polytest_resources",
      },
      vitest: {
        out_dir: "../../tests",
        resource_dir: "../../tests/polytest_resources",
      },
    },
    document: {
      markdown: {
        out_file: "../docs/test_plans/transact.md",
      },
    },
  };
}

function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] ||
    path.join(import.meta.dirname!, "./wallet.csv");
  const outputFile = args[1] ||
    path.join(import.meta.dirname!, "../../test_configs/wallet.jsonc");

  console.log(`Parsing ${inputFile}...`);
  const issues = parseCSVFile(inputFile);

  console.log(
    `Found ${issues.length} issues (${
      issues.filter((i) => i.issueType === "Epic").length
    } epics, ${issues.filter((i) => i.issueType === "Story").length} stories)`,
  );

  const config = generateConfig(issues);

  // Write JSONC with comments
  const jsoncContent = `{
  "name": "${config.name}",
  "package_name": "${config.package_name}",
  "resource_dir": "${config.resource_dir}",
  "version": "${config.version}",
  "suite": ${
    JSON.stringify(config.suite, null, 2).split("\n").map((l) => "  " + l).join(
      "\n",
    )
  },
  "group": ${
    JSON.stringify(config.group, null, 2).split("\n").map((l) => "  " + l).join(
      "\n",
    )
  },
  "target": ${
    JSON.stringify(config.target, null, 2).split("\n").map((l) => "  " + l)
      .join("\n")
  },
  "document": ${
    JSON.stringify(config.document, null, 2).split("\n").map((l) => "  " + l)
      .join("\n")
  }
}`;

  fs.writeFileSync(outputFile, jsoncContent);
  console.log(`Generated JSONC config at ${outputFile}`);
}

main();
