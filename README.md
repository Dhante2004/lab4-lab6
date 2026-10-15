# Lab 4 and Lab 6: Replica Set and Driver Integration

This lab starts a three-member MongoDB replica set on your machine, demonstrates
write concerns and primary election, and provides a Node.js CLI for validated
CRUD operations on a `species` collection.

## Requirements

- Docker Desktop running with the Linux container engine.
- Node.js 20 or newer and npm (for running the unit tests on the host).
- PowerShell 5.1 or newer to run the failover experiment.

The MongoDB members and Node.js driver run in local Docker containers. Member
ports are bound to `127.0.0.1`; this lab does not publish them to the network.
No credentials or `.env` file are needed.

## Start the replica set and run the experiment

From the project folder, run:

```powershell
docker compose --profile tools up -d mongo1 mongo2 mongo3 app
docker compose exec -T app node scripts/init-replica-set.js
```

The initialization command configures replica set `rs0` with three voting
members: `mongo1:27017`, `mongo2:27017`, and `mongo3:27017`. It is safe to run
again if the replica set is already initialized.

Run the complete write-concern and failover exercise:

```powershell
.\scripts\run-failover-lab.ps1
```

The experiment writes one document with `w: 1` and one with `w: "majority"` to
`replica_set_lab_runs`, records each acknowledgement time, identifies the
primary, stops its container, and waits for a *different* primary to answer a
`hello` command. It saves the measured primary names, election duration, write
acknowledgements, and run ID to `results/latest.json`. Keep that generated
results file with your submission to record your actual experiment. The
script restarts the stopped member even if the experiment fails.

`electionTimeMs` measures from immediately before Docker stops the old primary
until the Node.js driver detects the newly elected primary, so it includes
container-stop and detection time. The individual `acknowledgementMs` values
are observed local timings, not guarantees about future runs.

## What to observe about write concerns

Both writes are acknowledged, but their acknowledgement conditions differ:

- `w: 1` returns when the primary has applied the write. It can acknowledge
  sooner, but if the primary fails before replication, the write can be lost
  during failover.
- `w: "majority"` waits for the write to be acknowledged by a majority of
  voting members. That provides stronger failover durability, with possible
  extra latency. In a three-voter replica set, a majority is two members.

Compare the recorded timings in `results/latest.json`; scheduling and local
machine load can make either write appear faster in an individual run. In a
clean local experiment both writes should succeed; the timing comparison does
not itself prove that a `w: 1` write was lost.

To inspect the running member status:

```powershell
docker compose exec -T mongo1 mongosh --quiet --eval "rs.status().members.map(m => ({ name: m.name, stateStr: m.stateStr }))"
```

## Species CRUD driver

The CLI connects to `rs0` and creates a unique index on `scientificName`. Run
the commands inside the app container so the replica set's Docker DNS hostnames
resolve correctly:

```powershell
docker compose exec -T app node src/cli.js create --scientific-name "Panthera tigris" --common-name "Tiger" --habitat "Forests and grasslands" --conservation-status "Endangered"
docker compose exec -T app node src/cli.js list
docker compose exec -T app node src/cli.js get --id 507f1f77bcf86cd799439011
docker compose exec -T app node src/cli.js update --id 507f1f77bcf86cd799439011 --habitat "Tropical forests"
docker compose exec -T app node src/cli.js delete --id 507f1f77bcf86cd799439011
```

Use the `_id` returned by `create` for `get`, `update`, and `delete`. The
example ID above is illustrative; it will not exist unless you have inserted
that exact record. The CLI validates required fields, types, blank and
overlong values, unknown options, conservation-status values, and MongoDB
ObjectIds. The `update` command accepts one or more fields.

To stop the containers while preserving data:

```powershell
docker compose --profile tools down
```

To delete all persisted lab data and start over, explicitly remove the
Compose volumes:

```powershell
docker compose --profile tools down -v
```

## Tests

The validation and CLI parser tests do not require a running MongoDB:

```powershell
npm ci
npm test
```

## GitHub submission

Initialize or connect this folder to your GitHub repository and push the
source files. `.gitignore` excludes `.env`, dependencies, and generated lab
results are not created until the experiment runs. Review `git status` before
committing; do not add credentials or personal connection strings.
