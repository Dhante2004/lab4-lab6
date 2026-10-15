"use strict";

const { MongoClient } = require("mongodb");
const { connectToPrimary } = require("./helpers");

const replicaSetUri =
  process.env.MONGODB_URI ||
  "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0";
const directUri =
  process.env.REPLICA_SET_INIT_URI ||
  "mongodb://mongo1:27017/?directConnection=true&serverSelectionTimeoutMS=5000";

async function main() {
  const initializer = new MongoClient(directUri);
  try {
    await initializer.connect();
    const admin = initializer.db("admin");
    try {
      await admin.command({ replSetGetStatus: 1 });
      console.log("Replica set rs0 is already initialized.");
    } catch (error) {
      if (error.code !== 94 && error.codeName !== "NotYetInitialized") {
        throw error;
      }
      await admin.command({
        replSetInitiate: {
          _id: "rs0",
          members: [
            { _id: 0, host: "mongo1:27017" },
            { _id: 1, host: "mongo2:27017" },
            { _id: 2, host: "mongo3:27017" }
          ]
        }
      });
      console.log("Initiated replica set rs0 with mongo1, mongo2, and mongo3.");
    }
  } finally {
    await initializer.close();
  }

  const { client, primaryHost } = await connectToPrimary(replicaSetUri);
  try {
    const hello = await client.db("admin").command({ hello: 1 });
    const members = hello.hosts || [];
    if (members.length !== 3) {
      throw new Error(`Expected 3 replica-set members; discovered ${members.length}.`);
    }
    console.log(JSON.stringify({ replicaSet: "rs0", members, primaryHost }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
});
