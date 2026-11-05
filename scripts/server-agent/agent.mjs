import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

const VERSION = "0.1.0";
const configPath = path.resolve(process.argv[2] || "scripts/server-agent/config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const token = String(process.env[config.tokenEnvironmentVariable || "SERVER_AGENT_TOKEN"] || "").trim();
const endpoint = new URL("/api/internal/server-agent", String(config.websiteBaseUrl)).toString();
const agentId = String(config.agentId || "arma-primary").trim().toLowerCase();
const pollInterval = Math.max(2_000, Number(config.pollIntervalMs) || 5_000);

if (token.length < 32) throw new Error("SERVER_AGENT_TOKEN must contain at least 32 characters.");
if (!/^https:\/\//i.test(endpoint) && !config.allowInsecureHttp) throw new Error("The agent requires an HTTPS website URL.");

let stopping = false;
let activeJob = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, agentId }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Website returned ${response.status}`);
  return data;
}

async function log(job, message, level = "info") {
  const clean = String(message || "").trim();
  if (!clean) return;
  console.log(`[${level}] ${clean}`);
  await request({ action: "log", jobId: job.id, claimToken: job.claim_token, level, message: clean.slice(0, 4000) });
}

function serverConfig(serverId) {
  const server = config.servers?.[String(serverId)];
  if (!server) throw new Error(`Server ${serverId} is not configured on this agent.`);
  const port = Number(server.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Server ${serverId} has an invalid port.`);
  return { ...server, port };
}

function runProcess(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: options.cwd, windowsHide: true, env: process.env });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      const line = String(chunk);
      output = (output + line).slice(-20_000);
      options.onOutput?.(line);
    });
    child.stderr?.on("data", (chunk) => {
      const line = String(chunk);
      output = (output + line).slice(-20_000);
      options.onOutput?.(line);
    });
    if (options.input !== undefined) child.stdin?.end(String(options.input));
    child.once("error", reject);
    child.once("exit", (code) => (options.successCodes || [0]).includes(code) ? resolve({ code, output }) : reject(new Error(`${path.basename(executable)} exited with code ${code}. ${output.slice(-1200)}`)));
  });
}

async function modLaunchArgument(server) {
  const ids = [...new Set((server.workshopModIds || []).map(String))];
  if (!ids.length) return null;
  const root = String(config.steamcmd?.modRootDirectory || server.workingDirectory);
  const folders = await readdir(root, { withFileTypes: true });
  const linksById = new Map();
  for (const folder of folders) {
    if (!folder.name.startsWith("@") || (!folder.isDirectory() && !folder.isSymbolicLink())) continue;
    try {
      const target = await realpath(path.join(root, folder.name));
      const id = path.basename(target);
      if (/^\d+$/.test(id)) linksById.set(id, folder.name);
    } catch {
      // Broken links are reported below when required by the selected preset.
    }
  }
  const missing = ids.filter((id) => !linksById.has(id));
  if (missing.length) throw new Error(`The selected preset has no D:\\Arma link for Workshop IDs: ${missing.join(", ")}`);
  return `-mod=${ids.map((id) => linksById.get(id)).join(";")};`;
}

async function findServerPids(server) {
  const processName = path.basename(String(server.executable || ""));
  if (!/^[a-z0-9_.-]+$/i.test(processName)) throw new Error("The configured Arma process name is invalid.");
  const script = `$port=${server.port}; @(Get-CimInstance Win32_Process -Filter "Name = '${processName}'" | Where-Object { $_.CommandLine -match ('(?:^|\\s)-port=' + $port + '(?:\\s|$)') } | Select-Object -ExpandProperty ProcessId) -join ','`;
  const result = await runProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  return String(result.output).trim().split(",").map(Number).filter((pid) => Number.isInteger(pid) && pid > 0);
}

async function startServer(job, server) {
  const existing = await findServerPids(server);
  if (existing.length) return { alreadyRunning: true, pids: existing };
  if (!existsSync(server.executable)) throw new Error(`Arma executable was not found: ${server.executable}`);
  const args = Array.isArray(server.arguments) ? server.arguments.map(String) : [];
  const modArgument = await modLaunchArgument(server);
  if (modArgument) args.push(modArgument);
  const output = openSync(server.consoleLog || path.join(server.workingDirectory, `server-${server.port}.log`), "a");
  const child = spawn(server.executable, args, {
    cwd: server.workingDirectory,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", output, output],
    env: process.env,
  });
  child.unref();
  await log(job, `Started Server ${job.server_id} as process ${child.pid}.`);
  await delay(4_000);
  const pids = await findServerPids(server);
  if (!pids.length) throw new Error("The Arma process did not remain running after launch.");
  return { pids };
}

async function stopServer(job, server) {
  const pids = await findServerPids(server);
  if (!pids.length) return { alreadyStopped: true };
  for (const pid of pids) {
    await log(job, `Stopping Server ${job.server_id} process ${pid}.`);
    await runProcess("taskkill.exe", ["/PID", String(pid), "/T"]);
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!(await findServerPids(server)).length) return { stoppedPids: pids };
    await delay(1_000);
  }
  throw new Error("The server did not stop within 20 seconds. Forced termination was not used.");
}

function steamValue(value) {
  const text = String(value || "");
  if (/[\r\n]/.test(text)) throw new Error("SteamCMD values cannot contain line breaks.");
  return `"${text.replaceAll('"', '\\"')}"`;
}

function steamLoginCommand() {
  const steam = config.steamcmd || {};
  const username = String(steam.username || "anonymous");
  if (username === "anonymous") return "login anonymous";
  const password = String(process.env[steam.passwordEnvironmentVariable || "STEAMCMD_PASSWORD"] || "");
  if (!password) throw new Error("The configured SteamCMD account password is unavailable on the agent box.");
  return `login ${steamValue(username)} ${steamValue(password)}`;
}

async function runSteamCmd(job, commands) {
  const executable = String(config.steamcmd?.executable || "");
  if (!existsSync(executable)) throw new Error(`SteamCMD was not found: ${executable}`);
  let lastSent = 0;
  await log(job, "SteamCMD operation started.");
  const input = ["@ShutdownOnFailedCommand 1", "@NoPromptForPassword 1", steamLoginCommand(), ...commands, "quit", ""].join("\r\n");
  const result = await runProcess(executable, [], {
    cwd: path.dirname(executable),
    input,
    onOutput: (chunk) => {
      const now = Date.now();
      if (now - lastSent > 2_000) {
        lastSent = now;
        const message = String(chunk).trim().split(/\r?\n/).filter(Boolean).slice(-1)[0];
        if (message) log(job, message).catch(() => {});
      }
    },
  });
  await log(job, "SteamCMD operation completed.");
  return { exitCode: result.code };
}

async function mirrorWorkshopMods(job, modIds) {
  const appId = String(config.steamcmd?.workshopAppId || "107410");
  const sourceRoot = String(config.steamcmd?.workshopContentDirectory || path.join(path.dirname(config.steamcmd.executable), "steamapps", "workshop", "content", appId));
  const stagingRoot = String(config.steamcmd?.modStagingDirectory || "");
  if (!stagingRoot) throw new Error("A mod staging directory is required before Workshop updates can be enabled.");
  for (const id of modIds) {
    const source = path.join(sourceRoot, id);
    const target = path.join(stagingRoot, id);
    if (!existsSync(source)) throw new Error(`SteamCMD completed but Workshop item ${id} was not found at ${source}.`);
    await mkdir(target, { recursive: true });
    await log(job, `Applying Workshop item ${id} to the staging directory.`);
    await runProcess("robocopy.exe", [source, target, "/MIR", "/R:2", "/W:2", "/NFL", "/NDL", "/NJH", "/NJS"], { successCodes: [0, 1, 2, 3, 4, 5, 6, 7] });
  }
}

async function findKeyFiles(directory, depth = 0) {
  if (depth > 5) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findKeyFiles(fullPath, depth + 1));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".bikey")) files.push(fullPath);
  }
  return files;
}

async function copyModKeys(job, server) {
  const stagingRoot = String(config.steamcmd?.modStagingDirectory || "");
  const keysDirectory = String(config.steamcmd?.serverKeysDirectory || path.join(server.workingDirectory, "keys"));
  if (!stagingRoot) throw new Error("The mod staging directory is not configured.");
  await mkdir(keysDirectory, { recursive: true });
  const modIds = [...new Set((server.workshopModIds || []).map(String))];
  let copied = 0;
  for (const id of modIds) {
    const modDirectory = path.join(stagingRoot, id);
    if (!existsSync(modDirectory)) throw new Error(`Workshop item ${id} is missing from the staging directory.`);
    const keys = await findKeyFiles(modDirectory);
    for (const key of keys) {
      await copyFile(key, path.join(keysDirectory, path.basename(key)));
      copied += 1;
    }
  }
  await log(job, `Copied ${copied} server keys into ${keysDirectory}.`);
  return { copiedKeys: copied, destination: keysDirectory };
}

async function execute(job) {
  const server = serverConfig(job.server_id);
  if (job.action === "server.start") return startServer(job, server);
  if (job.action === "server.stop") return stopServer(job, server);
  if (job.action === "server.restart") {
    await stopServer(job, server);
    await delay(Math.max(2_000, Number(server.restartDelayMs) || 5_000));
    return startServer(job, server);
  }
  if (job.action === "steamcmd.server.update") {
    if ((await findServerPids(server)).length) throw new Error("Stop the server before applying an Arma server update.");
    const installDirectory = String(config.steamcmd?.serverInstallDirectory || server.workingDirectory);
    const appId = String(config.steamcmd?.serverAppId || "233780");
    if (!/^\d+$/.test(appId)) throw new Error("Invalid SteamCMD server app ID.");
    const branch = String(config.steamcmd?.serverBranch || "").trim();
    const branchPassword = String(process.env[config.steamcmd?.serverBranchPasswordEnvironmentVariable || "ARMA_SERVER_BRANCH_PASSWORD"] || "").trim();
    let updateCommand = `app_update ${appId}`;
    if (branch) updateCommand += ` -beta ${steamValue(branch)}`;
    if (branchPassword) updateCommand += ` -betapassword ${steamValue(branchPassword)}`;
    updateCommand += " validate";
    return runSteamCmd(job, [`force_install_dir ${steamValue(installDirectory)}`, updateCommand]);
  }
  if (job.action === "steamcmd.mods.update") {
    if ((await findServerPids(server)).length) throw new Error("Stop the server before updating its Workshop mods.");
    const workshopAppId = String(config.steamcmd?.workshopAppId || "107410");
    const modIds = [...new Set((server.workshopModIds || []).map(String))];
    if (!modIds.length || modIds.some((id) => !/^\d+$/.test(id))) throw new Error("No valid Workshop mod IDs are configured for this server.");
    const result = await runSteamCmd(job, modIds.map((id) => `workshop_download_item ${workshopAppId} ${id} validate`));
    await mirrorWorkshopMods(job, modIds);
    return { ...result, updatedMods: modIds.length };
  }
  if (job.action === "mods.keys.copy") return copyModKeys(job, server);
  throw new Error(`Unsupported action: ${job.action}`);
}

async function heartbeat() {
  await request({
    action: "heartbeat",
    displayName: config.displayName || "Primary Arma Server",
    version: VERSION,
    details: { hostname: process.env.COMPUTERNAME || "unknown", activeJob: activeJob?.id || null },
  });
}

async function loop() {
  while (!stopping) {
    try {
      await heartbeat();
      const { job } = await request({ action: "claim" });
      if (!job) {
        await delay(pollInterval);
        continue;
      }
      activeJob = job;
      try {
        await log(job, `Agent accepted ${job.action} for Server ${job.server_id}.`);
        const result = await execute(job);
        await request({ action: "complete", jobId: job.id, claimToken: job.claim_token, result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Agent operation failed.";
        await log(job, message, "error").catch(() => {});
        await request({ action: "fail", jobId: job.id, claimToken: job.claim_token, error: message });
      } finally {
        activeJob = null;
      }
    } catch (error) {
      console.error(`[agent] ${error instanceof Error ? error.message : error}`);
      await delay(Math.max(pollInterval, 10_000));
    }
  }
}

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
console.log(`[agent] Starting ${agentId} v${VERSION} using ${configPath}`);
const heartbeatTimer = setInterval(() => heartbeat().catch((error) => console.error(`[agent] Heartbeat failed: ${error.message}`)), 15_000);
await loop();
clearInterval(heartbeatTimer);

