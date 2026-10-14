# Exposing the agent through a Cloudflare named tunnel

The agent runs on a home machine with no public IP. A named tunnel gives it a
stable hostname — `agent.upkeep.day` — that survives restarts and reboots,
so `EXPO_PUBLIC_AGENT_URL` is set once and never touched again.

A quick tunnel (`cloudflared tunnel --url ...`) needs no account, but its
hostname is random and changes every restart, which means editing `.env` and
rebuilding the bundle each time. That is why this uses a named one.

Requires a Cloudflare account with a domain on it. This project uses
`upkeep.day`, served at `agent.upkeep.day`.

## 1. Install cloudflared

```powershell
winget install --id Cloudflare.cloudflared
```

Then reopen the terminal so it lands on PATH, and check:

```powershell
cloudflared --version
```

## 2. Authenticate

```powershell
cloudflared tunnel login
```

This opens a browser. Pick the domain to use. It writes a certificate to
`%USERPROFILE%\.cloudflared\cert.pem`.

## 3. Create the tunnel

```powershell
cloudflared tunnel create upkeep-agent
```

Note the UUID it prints — it names the credentials file it just wrote to
`%USERPROFILE%\.cloudflared\<UUID>.json`, and it is the `<UUID>` referred to
below. `cloudflared tunnel list` shows it again if you lose it.

## 4. Point a hostname at it

```powershell
cloudflared tunnel route dns upkeep-agent agent.upkeep.day
```

This creates the DNS record for you; nothing to add by hand in the dashboard.

## 5. Configure ingress

Create `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: upkeep-agent
credentials-file: C:\Users\<you>\.cloudflared\<UUID>.json

ingress:
  # Everything for this hostname goes to the local FastAPI server.
  - hostname: agent.upkeep.day
    service: http://localhost:8000
  # Required catch-all: anything else is refused rather than forwarded.
  - service: http_status:404
```

Do not wrap the credentials path in double quotes — YAML reads `\U` as an
escape sequence and the file fails to parse. Unquoted or single-quoted is fine.

Check it before running:

```powershell
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://agent.upkeep.day/health
```

The first parses the file; the second shows which rule a request would hit.

## 6. Run it

```powershell
cloudflared tunnel run upkeep-agent
```

Check it end to end from anywhere:

```powershell
curl https://agent.upkeep.day/health
```

To keep it running across reboots instead of in a terminal, install it as a
Windows service (run the shell as administrator):

```powershell
cloudflared service install
```

## 7. Point the app at it

In the app's `.env`:

```
EXPO_PUBLIC_AGENT_URL=https://agent.upkeep.day
```

`EXPO_PUBLIC_*` values are read at bundle time, so restart Metro — a reload is
not enough.

## 8. Stop listening on the LAN

With the tunnel carrying the traffic, the server no longer needs to be
reachable from other machines on the network. Bind it to loopback only:

```powershell
python -m uvicorn agent_server:app --host 127.0.0.1 --port 8000
```

`cloudflared` connects to `localhost:8000` from the same machine, so this
costs nothing and removes the open LAN port.

## Security notes

The tunnel makes this URL reachable by anyone who learns it, so:

- **`ALLOW_TEST_JWT` must stay unset.** It lets a request with no token fall
  back to `TEST_JWT`, i.e. act as the test user. It is a LAN-only convenience.
- Every request is verified against Supabase before the model is called, so an
  absent or forged token costs a cheap round trip rather than GPU time.
- Supabase RLS remains the thing protecting the data. The agent holds the
  anon key and the caller's token — never the service role key, which would
  bypass RLS entirely.
- There is no rate limiting. A valid signed-in user can still call the model
  as often as they like. Cloudflare WAF rate limiting on the hostname is the
  place to add that if it matters.
