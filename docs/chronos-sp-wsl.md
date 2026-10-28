# Chronos-SP development in WSL

The working repository is `~/projects/Chronos-SP` in Ubuntu-24.04. Its Git origin
is `https://github.com/breduv/Chronos-SP.git`. Node v22.23.3 and all dependencies
are installed inside Linux. The earlier Windows checkout is an initial clone;
make further changes in the Linux working repository.

From PowerShell, start the prototype with:

```powershell
wsl -d Ubuntu-24.04 -u gleb --cd /home/gleb/projects/Chronos-SP --exec bash tools/chronos-dev.sh
```

Open <http://localhost:4242/#/tag/TODAY/tasks>. Stop the server with Ctrl+C in
its terminal. The initial upstream onboarding still applies. Calendar and Habits
can be enabled under Settings → App Features. No demo tasks are added to your
browser automatically. Tasks and recorded durations use the existing local
storage; the first prototype has no new sync model or interval storage.

The Today page adds a day overview, a current-activity card with Pause, and a
recorded-time panel. Use the existing task controls to add tasks and start their
timers. Select a recorded entry to correct its duration. This is a task-level
summary, not a chronological start/end timeline. Parent totals include subtasks.

Open the source from Windows at
`\\wsl.localhost\Ubuntu-24.04\home\gleb\projects\Chronos-SP`.

Validated on 2026-10-28: development build, changed-file checks, translation
checks, 18,921 Angular tests plus 6,377 in the additional timezone, and two
Chromium scenarios covering time corrections, reload and a 390px layout.
