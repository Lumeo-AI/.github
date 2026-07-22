// Regenerates every generated block in profile/README.md from live sources:
//   - org + repo numbers come from the GitHub API
//   - Solis's architecture numbers are derived from zeus/config.py in Solis-1.0
// Nothing numeric in the README is hand-maintained. Run by
// .github/workflows/stats.yml — no dependencies, needs Node 20+.

import { readFile, writeFile } from "node:fs/promises";

const ORG = process.env.ORG ?? "Lumeo-AI";
const README = new URL("../profile/README.md", import.meta.url);

// Focus and status are editorial, not measurements — they live here so the
// README itself stays fully generated. Everything else is fetched.
const FAMILY = [
  { model: "Solis", repo: "Solis-1.0", focus: "Conversation", status: "✅ Available" },
  { model: "Prism", repo: "Prism-0.1", focus: "Reasoning", status: "🔬 In research" },
  { model: "Beacon", repo: "Beacon-0.1", focus: "Retrieval", status: "🛠️ In development" },
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

async function file(repo, path) {
  const { body } = await gh(`/repos/${ORG}/${repo}/contents/${path}`);
  return Buffer.from(body.content, "base64").toString("utf8");
}

const day = (iso) => (iso ? iso.slice(0, 10) : "—");
const millions = (n) => `${(n / 1e6).toFixed(1)}M`;

// --- org + repo numbers -----------------------------------------------------

const { body: repos } = await gh(`/orgs/${ORG}/repos?per_page=100&type=public`);
const counted = await Promise.all(
  repos.map(async (r) => ({ ...r, commits: await commitCount(r.name) })),
);
const by = Object.fromEntries(counted.map((r) => [r.name, r]));

const sum = (key) => counted.reduce((n, r) => n + r[key], 0);
const lastPush = counted.map((r) => r.pushed_at).sort().at(-1);

// --- Solis architecture, read straight out of the training code -------------

// The package was renamed zeus -> solis and the config schema grew (GQA,
// shared experts, an explicit expert width). Try the current path first and
// fall back, so a rename in the model repo doesn't break the profile.
async function loadConfig() {
  for (const path of ["solis/config.py", "zeus/config.py"]) {
    try {
      const src = await file("Solis-1.0", path);
      const cfg = Object.fromEntries(
        [...src.matchAll(/^\s{4}(\w+):\s*(?:int|float|bool)\s*=\s*([\w.+-]+)/gm)].map(
          ([, k, v]) => [k, v === "True" ? true : v === "False" ? false : Number(v)],
        ),
      );
      if (Number.isFinite(cfg.dim) && Number.isFinite(cfg.n_layers)) return cfg;
    } catch {
      // try the next layout
    }
  }
  throw new Error("no parsable config.py found in Solis-1.0");
}

const cfg = await loadConfig();
const swiglu = (hidden) => 3 * cfg.dim * hidden;

// Mirrors SolisConfig.param_breakdown(): bias-free projections, SwiGLU experts
// (gate + up + down), two RMSNorms per block plus a final one.
function countParams(routedPerToken) {
  const d = cfg.dim;
  const tied = cfg.tie_embeddings ?? true;
  const embed = cfg.vocab_size * d * (tied ? 1 : 2);
  const norms = d * (2 * cfg.n_layers + 1);

  if (Number.isFinite(cfg.expert_hidden)) {
    // Current schema: grouped-query attention, a dense first layer, and a
    // shared expert that every token passes through.
    const qDim = cfg.n_heads * cfg.head_dim;
    const kvDim = cfg.n_kv_heads * cfg.head_dim;
    const attn =
      (2 * d * qDim + 2 * d * kvDim + (cfg.qk_norm ? 2 * cfg.head_dim : 0)) * cfg.n_layers;
    const dense = swiglu(cfg.dense_hidden) * cfg.dense_layers;
    const moe =
      (swiglu(cfg.expert_hidden) * (routedPerToken + cfg.n_shared_experts) + d * cfg.n_experts) *
      (cfg.n_layers - cfg.dense_layers);
    return embed + attn + dense + moe + norms;
  }

  // Original schema: dense multi-head attention, every layer an MoE layer.
  const attn = 4 * d ** 2 * cfg.n_layers;
  const moe =
    (swiglu(d * cfg.expert_hidden_mult) * routedPerToken + d * cfg.n_experts) * cfg.n_layers;
  return embed + attn + moe + norms;
}

const total = countParams(cfg.n_experts);
const active = countParams(cfg.n_experts_per_tok);

// --- blocks -----------------------------------------------------------------

const blocks = {
  family: [
    "| Model | Focus | Status | Repository | Commits | Last update |",
    "|---|---|---|---|---|---|",
    ...FAMILY.map(({ model, repo, focus, status }) => {
      const r = by[repo];
      const link = r ? `[\`${repo}\`](${r.html_url})` : "_private_";
      return `| **${model}** | ${focus} | ${status} | ${link} | ${r?.commits ?? "—"} | ${day(r?.pushed_at)} |`;
    }),
  ],

  solis: [
    `- **${millions(total)}** parameters — **${millions(active)}** active per token`,
    `- **${cfg.n_experts}** experts / layer, top-${cfg.n_experts_per_tok} routing` +
      (cfg.n_shared_experts ? `, plus ${cfg.n_shared_experts} shared` : ""),
    `- **${cfg.n_layers}** layers · **${cfg.dim}** wide · ` +
      (cfg.n_kv_heads
        ? `**${cfg.n_heads}** query / **${cfg.n_kv_heads}** KV heads (GQA)`
        : `**${cfg.n_heads}** attention heads`),
    `- **${cfg.vocab_size.toLocaleString("en-US")}**-token ` +
      `${cfg.expert_hidden ? "BPE" : "byte-level"} vocabulary, learned on our own corpus`,
    `- **${cfg.max_seq_len.toLocaleString("en-US")}** token context, rotary positions + RMSNorm`,
  ],

  stats: [
    "| Public repos | Stars | Commits | Languages | Last push |",
    "|---|---|---|---|---|",
    `| ${counted.length} | ${sum("stargazers_count")} | ${sum("commits")} | ` +
      `${new Set(counted.map((r) => r.language).filter(Boolean)).size} | ${day(lastPush)} |`,
  ],
};

const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
blocks.stats.push("", `<sub>Generated from the GitHub API and \`Solis-1.0/zeus/config.py\` — last run ${stamp} UTC.</sub>`);

let readme = await readFile(README, "utf8");
for (const [name, lines] of Object.entries(blocks)) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(readme)) throw new Error(`missing ${name} markers in README`);
  readme = readme.replace(pattern, [start, "", ...lines, "", end].join("\n"));
}
await writeFile(README, readme);
console.log(readme);
