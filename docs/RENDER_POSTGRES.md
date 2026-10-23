# Render PostgreSQL deployment (Firewell CCG)

The server is a **single-instance** Node.js application. Use \`FIREWELL_STORAGE=postgres\`
for the hosted service. SQLite remains the default on desktop and is not removed:
\`FIREWELL_STORAGE=sqlite\`, \`FIREWELL_DB=./data/firewell.sqlite\`.

## Render settings

* Docker: repository \`LuwnFM/CCGame\`, branch \`main\`, region Frankfurt.
* From Render Postgres page, copy its **Internal Database URL** (never commit, email,
  or paste it into a public chat). In the web service's Environment page set
  \`DATABASE_URL\` to the copied private value.
* Set \`FIREWELL_STORAGE=postgres\`, \`FIREWELL_ALPHA_PASSWORD\` to a secret of
  10+ characters, and \`FIREWELL_BIND=0.0.0.0\`. Keep one replica.
* Deploy after the Postgres connection is configured. If the connection fails,
  startup fails instead of switching silently to ephemeral SQLite.
* The SQLite path \`FIREWELL_DB\` can remain configured, but is inactive while
  \`FIREWELL_STORAGE=postgres\`.
* Visit \`/api/health\`, then test registration, login after a redeploy, chat,
  matchmaking, reports and completed matches using test accounts.

The PostgreSQL storage adapter runs database work on a separate Node worker.
It preserves the existing synchronous game engine and serialized SQLite-like
transaction semantics. This is an alpha-compatibility layer, not a scalable
concurrent database backend. Heavy load requires a later fully asynchronous
storage layer and a multi-instance game-state redesign.

When PostgreSQL is selected, completed match history and its event journal are
stored in the database. Local gzip match archives are disabled, because a Free
Render web service does not have persistent disk storage. Plan a secure export
or external object store for archival retention before production.

**Data durability:** Render Free PostgreSQL expires after 30 days, has a 1 GB
limit, and offers no managed backup. The current database expires on
2026-11-22. Do not treat it as an indefinitely permanent database. Export
the data before expiry and migrate to long-lived storage or upgrade the plan.

## Keepalive and monitoring

Render Free services sleep after 15 minutes without incoming HTTP or WebSocket
messages. Configure an external monitor, e.g. UptimeRobot Free HTTP(s) monitor,
on \`https://firewell-ccg-alpha.onrender.com/api/health\` every 5 minutes.
A monitor checks availability and usually avoids idle sleep, but cannot promise
zero downtime. Monitor only while the service is needed; leaving it warm all
month consumes the free-instance-hour allowance. Render's own internal health
checks do not count as external user traffic.

The hosted service must not ping itself in a background loop.
