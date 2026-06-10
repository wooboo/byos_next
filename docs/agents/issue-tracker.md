# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `wooboo/byos_next`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --repo wooboo/byos_next --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --repo wooboo/byos_next --comments`
- **List issues**: `gh issue list --repo wooboo/byos_next --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`
- **Comment on an issue**: `gh issue comment <number> --repo wooboo/byos_next --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --repo wooboo/byos_next --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --repo wooboo/byos_next --comment "..."`

## When a skill says "publish to the issue tracker"

Create a GitHub issue in `wooboo/byos_next`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --repo wooboo/byos_next --comments`.
