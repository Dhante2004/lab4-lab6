"use strict";

const { performance } = require("node:perf_hooks");
const { randomUUID } = require("node:crypto");
const { connectDatabase } = require("../src/db");

async function main() {
  const { client, database } = await connectDatabase();
  try {
    const hello = await client.db("admin").command({ hello: 1 });
    if (!hello.isWritablePrimary) {
      throw new Error("The experiment must begin while the replica set has an elected primary.");
    }

    const runId = randomUUID();
    const collection = database.collection("replica_set_lab_runs");
    const acknowledgements = [];

    for (const concern of [
      { label: "w:1", w: 1 },
      { label: "w:'majority'", w: "majority" }
    ]) {
      const document = {
        runId,
        writeConcern: concern.label,
        writtenAt: new Date(),
        note: `Replica-set write concern experiment (${concern.label})`
      };
      const startedAt = performance.now();
      const result = await collection.insertOne(document, {
        writeConcern: { w: concern.w, wtimeoutMS: 15000 }
      });
      acknowledgements.push({
        writeConcern: concern.label,
        acknowledged: result.acknowledged,
        insertedId: result.insertedId.toHexString(),
        acknowledgementMs: Number((performance.now() - startedAt).toFixed(2))
      });
    }

    console.log(
      JSON.stringify(
        { runId, primaryBeforeFailover: hello.me, writes: acknowledgements },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
});
