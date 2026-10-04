# Jev Semantic Merge Gate

A GitHub Action for declared semantic merge policies. It is deliberately **not** a general AI reviewer: every finding belongs to a repository-owned rule and cites one exact added line.

## Offline proof

```bash
npm test
npm run demo
```

The fixture identifies an explicitly deferred rollback and exits non-zero. No network or API key is used.

## GitHub Action

Copy `examples/release-safety.json` to `.jev/policy.json`, then add:

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: gbesse/jev-semantic-merge-gate@v0.1.0
  with:
    typesafe-api-key: ${{ secrets.TYPESAFE_API_KEY }}
    policy: .jev/policy.json
    base: origin/main
```

Rules choose `warning` or `failure`. The action sends only non-empty added lines, caps each request at the TypeSafe finite-choice limit, and fails closed on malformed provider output. This first release expects at most 255 changed non-empty lines; chunking large diffs is planned.

## Boundaries

This gate complements tests, linters and security scanners. A probability is not proof of a defect. Keep high-impact rules narrow, measure false positives, and give maintainers an explicit override process. The provider key remains a GitHub secret.

Independent community integration. MIT licensed.
