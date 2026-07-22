// Regenerates the stats block in profile/README.MD from the GitHub API.
// Run by .github/workflows/stats.yml — no dependencies, needs Node 20+.

import { readFile, writeFile } from "node:fs/promises";

const ORG = process.env.ORG ?? "Lumeo-AI";
const README = new URL("../profile/README.MD", import.meta.url);
const START = "<!-- stats:start -->";
const END = "<!-- stats:end -->";

// Repos shown in the per-model table, in the order the family is introduced.
const FAMILY = [
  ["Solis", "Solis-1.0"],
  ["Prism", "Prism-0.1"],
  ["Beacon", "Beacon-0.1"],
];

const headers = {
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  ...(process.env.GITHUB_TOKEN
    ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  return { body: await res.json(), link: res.headers.get("link") ?? "" };
}

// Ask for a single commit and read the page count off the Link header — one
// request per repo instead of paging through the whole history.
async function commitCount(repo) {
  try {
    const { body, link } = await gh(`/repos/${ORG}/${repo}/commits?per_page=1`);
    const last = link.match(/[?&]page=(\d+)>; rel="last"/);
    return last ? Number(last[1]) : body.length;
  } catch {
    return 0; // empty repo
  }
}

const day = (iso) => (iso ? iso.slice(0, 10) : "—");

const { body: repos } = await gh(`/orgs/${ORG}/repos?per_page=100&type=public`);
const counted = await Promise.all(
  repos.map(async (r) => ({ ...r, commits: await commitCount(r.name) })),
);
const by = Object.fromEntries(counted.map((r) => [r.name, r]));

const sum = (key) => counted.reduce((n, r) => n + r[key], 0);
const lastPush = counted
  .map((r) => r.pushed_at)
  .sort()
  .at(-1);

const summary = [
  "| Public repos | Stars | Commits | Languages | Last push |",
  "|---|---|---|---|---|",
  `| ${counted.length} | ${sum("stargazers_count")} | ${sum("commits")} | ` +
    `${new Set(counted.map((r) => r.language).filter(Boolean)).size} | ${day(lastPush)} |`,
];

const family = [
  "| Model | Repository | Commits | Stars | Last update |",
  "|---|---|---|---|---|",
  ...FAMILY.map(([model, repo]) => {
    const r = by[repo];
    if (!r) return `| **${model}** | \`${repo}\` | — | — | — |`;
    return (
      `| **${model}** | [\`${repo}\`](https://github.com/${ORG}/${repo}) | ` +
      `${r.commits} | ${r.stargazers_count} | ${day(r.pushed_at)} |`
    );
  }),
];

const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
const block = [
  START,
  "",
  ...summary,
  "",
  ...family,
  "",
  `<sub>Updated automatically — last run ${stamp} UTC.</sub>`,
  "",
  END,
].join("\n");

const readme = await readFile(README, "utf8");
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!pattern.test(readme)) throw new Error("stats markers missing from README");
await writeFile(README, readme.replace(pattern, block));
console.log(block);
