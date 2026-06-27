// Keeps server.json (MCP Registry manifest) in lockstep with package.json.
// Runs as the npm `version` lifecycle script, so `npm version patch|minor|major`
// bumps package.json, package-lock.json and server.json in one go.
const fs = require("fs");
const path = require("path");

const { version } = require(path.join(__dirname, "..", "package.json"));
const serverJsonPath = path.join(__dirname, "..", "server.json");

const server = JSON.parse(fs.readFileSync(serverJsonPath, "utf8"));
server.version = version;
for (const pkg of server.packages ?? []) {
  pkg.version = version;
}
fs.writeFileSync(serverJsonPath, JSON.stringify(server, null, 2) + "\n");
console.log(`server.json synced to ${version}`);
