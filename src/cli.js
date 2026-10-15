"use strict";

const { connectDatabase } = require("./db");
const { parseId, SpeciesRepository } = require("./species-repository");
const { InputValidationError, validateSpecies } = require("./validation");

const CLI_FIELDS = {
  "scientific-name": "scientificName",
  "common-name": "commonName",
  habitat: "habitat",
  "conservation-status": "conservationStatus"
};

function parseArguments(args) {
  const [command, ...flags] = args;
  if (!command || command === "help" || command === "--help") {
    return { command: "help", options: {} };
  }

  const options = {};
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (!flag.startsWith("--") || flag.length === 2) {
      throw new InputValidationError(`Expected a --flag, received "${flag}".`);
    }

    const name = flag.slice(2);
    const value = flags[index + 1];
    if (!value || value.startsWith("--")) {
      throw new InputValidationError(`${flag} requires a value.`);
    }
    if (Object.hasOwn(options, name)) {
      throw new InputValidationError(`${flag} may only be supplied once.`);
    }

    options[name] = value;
    index += 1;
  }
  return { command, options };
}

function requireOnlyOptions(options, allowed) {
  const unknown = Object.keys(options).filter((name) => !allowed.includes(name));
  if (unknown.length > 0) {
    throw new InputValidationError(`Unknown option(s): ${unknown.map((name) => `--${name}`).join(", ")}.`);
  }
}

function getSpeciesInput(options, { allowId = false } = {}) {
  const input = {};
  for (const [flag, field] of Object.entries(CLI_FIELDS)) {
    if (Object.hasOwn(options, flag)) {
      input[field] = options[flag];
    }
  }
  requireOnlyOptions(options, allowId ? [...Object.keys(CLI_FIELDS), "id"] : Object.keys(CLI_FIELDS));
  return input;
}

function printHelp() {
  console.log(`Species CRUD CLI

Commands:
  create --scientific-name VALUE --common-name VALUE --habitat VALUE --conservation-status STATUS
  list
  get --id OBJECT_ID
  update --id OBJECT_ID [--scientific-name VALUE] [--common-name VALUE] [--habitat VALUE] [--conservation-status STATUS]
  delete --id OBJECT_ID

Allowed conservation statuses: Least Concern, Near Threatened, Vulnerable, Endangered,
Critically Endangered, Extinct in the Wild, Extinct, Data Deficient, Not Evaluated.`);
}

async function run(args = process.argv.slice(2)) {
  const { command, options } = parseArguments(args);
  if (command === "help") {
    requireOnlyOptions(options, []);
    printHelp();
    return;
  }

  let requiredId;
  let speciesInput;
  switch (command) {
    case "create":
      speciesInput = getSpeciesInput(options);
      break;
    case "list":
      requireOnlyOptions(options, []);
      break;
    case "get":
    case "delete":
      requireOnlyOptions(options, ["id"]);
      requiredId = options.id;
      if (!requiredId) {
        throw new InputValidationError(`${command} requires --id.`);
      }
      break;
    case "update":
      requiredId = options.id;
      if (!requiredId) {
        throw new InputValidationError("update requires --id.");
      }
      speciesInput = getSpeciesInput(options, { allowId: true });
      if (Object.keys(speciesInput).length === 0) {
        throw new InputValidationError("update requires at least one species field.");
      }
      break;
    default:
      throw new InputValidationError(`Unknown command "${command}". Run "node src/cli.js help" for usage.`);
  }

  if (command === "create") {
    validateSpecies(speciesInput);
  } else if (command === "update") {
    parseId(requiredId);
    validateSpecies(speciesInput, { partial: true });
  } else if (command === "get" || command === "delete") {
    parseId(requiredId);
  }

  const { client, database } = await connectDatabase();
  try {
    const collection = database.collection("species");
    await collection.createIndex({ scientificName: 1 }, { unique: true });
    const repository = new SpeciesRepository(collection);

    let result;
    switch (command) {
      case "create":
        result = await repository.create(speciesInput);
        break;
      case "list":
        result = await repository.list();
        break;
      case "get":
        result = await repository.getById(requiredId);
        break;
      case "update":
        result = await repository.updateById(requiredId, speciesInput);
        break;
      case "delete":
        result = await repository.deleteById(requiredId);
        break;
      default:
        throw new Error(`Unhandled command "${command}".`);
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(`${error.name}: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { parseArguments, run };
