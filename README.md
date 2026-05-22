# Nick Pi Agent

Personal Pi agent setup for Nick's Agent.
<img width="2880" height="1800" alt="image" src="https://github.com/user-attachments/assets/73bacb5a-6835-486a-86b9-6c5aaf7c2290" />


## Included

- `APPEND_SYSTEM.md` identity prompt
- `settings.json` default model, thinking level, active theme, and Pi packages
- `extensions/flow-title.ts` custom Forest Night header
- `extensions/nick-footer.ts` compact Nick footer
- `extensions/react-code-reviewer.ts` React review command
- `prompts/react-review.md` React review prompt template
- `themes/forest-night.json` Forest Night Pi theme
- `themes/github-dark-default.json` alternate GitHub dark theme

## Not Included

The repo intentionally excludes:

- `auth.json`
- `sessions/`
- `npm/` installed package cache and dependencies

## Restore

Clone this repo as `~/.pi/agent`, then install/reload Pi packages:

```bash
pi install npm:context-mode
pi install npm:pi-web-access
pi install npm:@plannotator/pi-extension
pi install npm:@narumitw/pi-btw
```

Inside Pi, run:

```text
/reload
```

Useful commands:

- `/flow-title` enable the custom header
- `/flow-title-builtin` restore Pi's built-in header
- `/nick-footer` enable Nick's custom footer
- `/nick-footer-off` restore Pi's built-in footer
- `/react-review [target]` review React frontend code
- `/plannotator` toggle plan mode
- `/btw <question>` ask a side question
