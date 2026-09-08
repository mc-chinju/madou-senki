# API and session contract

This implementation uses the adopted second-online-v0.1-provisional rules. Formal START stays disabled while any selected card/ability is pending. A table can be recruited before the full engine is complete; this is not a claim that a full game is ready.

All JSON responses are no-store. Mutating HTTP requests and WebSocket upgrades require an exact Origin matching the request URL. The browser and Worker must share an origin (including during development via a proxy). JSON request bodies are bounded to 4KiB. The authenticated actor comes only from the session, never request fields or client headers.

| Endpoint | Body | Result |
|---|---|---|
| POST /api/sessions | `{name}` (1–24 Unicode codepoints, trim/NFC, no control/format characters) | 201 `{id,name}` and secure cookie; valid existing session returns200 with original identity/name |
| GET /api/sessions/current | — | `{id,name}` or401 |
| GET /api/rooms | — | `{rooms:[{roomId,revision,title,capacity,occupied,rulesetId}]}`; at most100 publicly recruiting tables |
| GET /api/rooms/:id/seat | — | `{seated:boolean}` for the current session;false also for nonexistent rooms; never joins |
| POST /api/rooms | `{title,capacity,visibility,rulesetId}` | 201 `{roomId,revision}`; creator owns the first seat |
| POST /api/rooms/:id/join | `{}` or `{inviteToken}` | `{roomId,revision}`; an existing seat is restored without duplication |
| POST /api/rooms/:id/invites | `{expectedRevision}` | Owner-only `{token,revision}`; replaces previous invitation |
| GET /api/rooms/:id/ws | Cookie + Origin + Upgrade |101 WebSocket for an existing seat |

Capacity is4–10; titles1–60 codepoints. Visibility is `public` or `private`. Guest sessions last30 days in a `__Host-madou_session` HttpOnly Secure SameSite=Lax cookie. Only a SHA256 token hash is stored in D1. Other-device/account recovery is outside this version. Creating a new session does not acquire an existing seat with the same display name.

Invite tokens are256-bit random secrets. The Worker returns the plaintext token only to the owner and accepts it in the join request body; the DO stores only its hash. The client must put shared tokens in the URL fragment, not the URL query/path, and omit them from logs. Rotation invalidates old links for new entrants; existing seated actors restore with their session. D1 keeps no private table metadata (only an opaque ID/revision tombstone).

## Commands

Wire envelope: `{protocolVersion:1,commandId,expectedRevision,command}`. Game commands additionally include the paired `windowId,windowRevision` whenever the current game window requires them. Lobby commands reject window fields. After any accepted command the server sends an ACK and each connected participant's own snapshot. Retries use the same exact envelope/commandId. Only the latest connection for an actor can submit; older tabs receive read-only snapshots.

| Command | Condition and effect |
|---|---|
| READY `{ready}` | Recruitment only; changes the sender's readiness |
| UPDATE_SETTINGS `{title,capacity,visibility}` | Owner/recruitment only; capacity cannot be below occupied seats; clears all readiness/closure votes |
| START | Owner only; all configured seats filled and ready; full catalog guard must pass |
| LEAVE | Recruitment only; oldest remaining member inherits ownership, readiness/votes reset; empty room closes |
| CLOSE_BY_AGREEMENT `{agree}` | Adds/removes own public vote; closes only on unanimous current-member agreement; does not decide a winner |

Membership changes clear readiness and closure votes. Disconnecting does not vacate a seat, start a timer, concede or transfer ownership. Running games reject newcomers and LEAVE; seated participants may restore. Agreed closure retains the saved game for inspection.

HTTP failures:400 invalid body/settings;401 no valid session;403 forbidden origin/entry/invitation or absent private room;409 capacity/status/stale revision;413 oversized body;415 non-JSON;426 missing WebSocket upgrade;500 fixed internal error. No raw exception/credential/private state is returned. Wire errors are a closed typed set, including `NOT_READY` and `RULESET_NOT_READY`. Formal start and double-start success-path tests remain at Task7 until all effects are registered.
