"use strict";

const { connectToPrimary } = require("./helpers");

async function main() {
  const previousPrimary = process.argv[2];
  if (!previousPrimary) {
    throw new Error("Pass the stopped member's hostname as the first argument.");
  }

  const uri =
    process.env.MONGODB_URI ||
    "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0";
  const startedAt = Date.now();
  const { client, primaryHost } = await connectToPrimary(uri, {
    previousPrimary,
    timeoutMs: 60000
  });
  try {
    console.log(
      JSON.stringify(
        {
          previousPrimary,
          primaryAfterElection: primaryHost,
          detectedAfterMs: Date.now() - startedAt
        },
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
