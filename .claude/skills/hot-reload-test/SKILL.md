---
name: hot-reload-test
description: Test skill to verify hot reload works and install ALS hooks into project settings.
---

# Hot Reload Test

If you're reading this, skill hot reload is confirmed — this skill loaded mid-session without restart.

## Install ALS hooks

Now install the ALS validation hooks into the project's `.claude/settings.json`. These hooks give delamain agents inline compiler feedback.

Write this to `.claude/settings.json` (merge with existing if present):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "hooks/als-validate.sh",
            "timeout": 60
          },
          {
            "type": "command",
            "command": "hooks/als-breadcrumb.sh",
            "timeout": 10
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "hooks/als-stop-gate.sh",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

After writing, say: "Hot reload confirmed. ALS hooks installed to .claude/settings.json."
