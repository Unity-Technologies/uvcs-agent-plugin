# Locks (exclusive checkout)

Binary files that cannot be merged — textures, models, audio, Unity scenes in many projects — are
usually protected by **locks**. They are server-side and configured by an admin (`lock.conf`):
when a path matches a lock rule, `cm checkout` takes an exclusive lock on it, and nobody else can
check it out until it is released. Editing such a file without checking it out first leaves no
lock and invites a change that cannot be merged, so check out before editing a locked type.

Verified against `cm` 11.0.16.10512.

## Who holds a lock — read-only

```
cm lock list                                              # every lock on the workspace's server
cm lock list serverpath:/Assets/Art/Hero.psd#br:/main     # one file (any rev spec; several allowed)
cm lock list --onlycurrentuser                            # mine
cm lock list --onlycurrentuser --onlycurrentworkspace     # mine, taken in this workspace
cm lock list --repository=<repo>@<server> --anystatus     # include Retained locks
cm lock list --machinereadable --smartlocks --fieldseparator="|"
```

- One line per lock: repository, item id, date, destination branch, its revision, holder branch,
  its revision, **status**, **user**, **workspace**, server path. `--machinereadable` alone
  prints only GUID, user, workspace and path; add `--smartlocks` for all twelve fields
  (repository, item id, GUID, date, destination branch and revid, holder branch and revid,
  status, user, workspace, path). `-1` marks an unset field.
- **Status**: `Locked` — someone has it checked out now. `Retained` — the change was checked in
  on a task branch, and the lock stays until that revision reaches the **destination branch**
  (`/main` by default), so nobody edits from an older base meanwhile. Retained locks are hidden
  unless `--anystatus` is passed.
- With no `--server` / `--repository`, it queries the workspace's server; outside a workspace,
  pass one.
- `--ignorecase` matches a `serverpath:` regardless of casing.

## Taking and releasing your locks — mutating, visible to everyone

```
cm checkout Assets/Art/Hero.psd                 # takes the lock if a lock rule matches
cm undocheckout Assets/Art/Hero.psd             # discards the edit AND releases the lock
cm checkin Assets/Art/Hero.psd -c "..."         # Locked becomes Retained until it merges
cm lock unlock item:<workspace path>            # release your own lock, keep the file as is
cm lock unlock itemid:<id>@<repo>               # same, by the item id `cm lock list` prints
```

- `cm checkout --ignorefailed` carries on past paths it could not lock instead of failing.
- `cm undocheckout` is irreversible for the edit (see `status-and-checkin.md`); `cm lock unlock`
  releases the lock without touching the workspace. **A user can release only their own
  locks**; releasing someone else's, and `cm lock unlock --remove` (delete the lock record), are
  admin-only — ask the holder, by the user name and workspace `cm lock list` shows.
- `cm lock create <branch> <items>` is admin-only and creates `Retained` locks.
