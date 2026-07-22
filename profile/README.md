<div align="center">

<img src="./lumeo-sun-logo.png" width="90" alt="Lumeo logo" />

# Lumeo

**Language models, built from first light.**

Lumeo builds language models from scratch — no borrowed weights, no shortcuts.
We start with **Solis**, a mixture-of-experts model you can talk to today, with **Prism** and **Beacon** on the way.

**[lumeo.sushii.dev](https://lumeo.sushii.dev)**

</div>

---

## The family

Each model is built from the ground up for a different job, named for the way light behaves.

<!-- family:start -->

| Model | Focus | Status | Repository | Commits | Last update |
|---|---|---|---|---|---|
| **Solis** | Conversation | ✅ Available | [`Solis-1.0`](https://github.com/Lumeo-AI/Solis-1.0) | 1 | 2026-07-21 |
| **Prism** | Reasoning | 🔬 In research | _private_ | — | — |
| **Beacon** | Retrieval | 🛠️ In development | _private_ | — | — |

<!-- family:end -->

## About Solis

A from-scratch mixture-of-experts network — every token is routed through specialized experts.

<!-- solis:start -->

- **46.1M** parameters — **14.3M** active per token
- **8** experts / layer, top-2 routing
- **6** layers · **384** wide · **6** attention heads
- **260**-token byte-level vocabulary
- **512** token context, rotary positions + RMSNorm

<!-- solis:end -->

Solis is a small research model trained on a synthetic corpus — good for light conversation, not for anything you need to be true.

## By the numbers

<!-- stats:start -->

| Public repos | Stars | Commits | Languages | Last push |
|---|---|---|---|---|
| 1 | 0 | 1 | 1 | 2026-07-21 |

<sub>Generated from the GitHub API and `Solis-1.0/zeus/config.py` — last run 2026-07-22 04:41 UTC.</sub>

<!-- stats:end -->

## Links

- 🌐 [lumeo.sushii.dev](https://lumeo.sushii.dev) — talk to Solis
- 🔒 [Privacy Policy](https://lumeo.sushii.dev/privacy) · [Terms of Service](https://lumeo.sushii.dev/terms)
