# Contributing

Issues and pull requests are welcome.

## Reporting a bug

Open an issue with: what you expected, what happened instead, and a minimal reproduction (a failing test is ideal, a short code snippet is fine too). Include your Node version and package version.

## Proposing a change

For anything beyond a small fix, open an issue first to discuss the approach before writing code — this project has a specific, deliberately scoped surface (see the README's "Non-goals" section), and it's better to align on whether a change fits before either of us spends time on it.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

All three must pass before a PR is reviewed. Add a test for any behavior change — this project's test suite runs against the real underlying library/protocol, not mocks, so a new test should do the same wherever practical.

## Pull requests

- Keep the diff focused on one change.
- Update the README if the change affects documented behavior, the API table, or the non-goals list.
- Conventional commit-style messages are appreciated but not required.
