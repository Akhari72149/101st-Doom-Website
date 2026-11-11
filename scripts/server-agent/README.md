# 101st Arma Server Agent

This agent runs on the Windows box that hosts the Arma 3 servers. It polls the website over HTTPS, executes only the allow-listed operations in `agent.mjs`, and sends progress back to the website. It does not accept inbound network commands.

## Initial setup

1. Copy this folder to the Arma server box and rename `config.example.json` to `config.json`.
2. Replace the example paths, ports, profile arguments, and Workshop IDs with the values used by the current FASTER profiles.
3. Set `SERVER_AGENT_TOKEN` as a machine-level environment variable. Use the same random token on the website host.
4. Set `STEAMCMD_PASSWORD` only when a non-anonymous Steam account is required. Keep it on the Arma box. If the profiling branch requires a password, set `ARMA_SERVER_BRANCH_PASSWORD` there as well.
5. Run `node agent.mjs config.json` once in a console to verify the paths and website connection.
6. Run it at startup under a dedicated, non-administrator Windows account using Task Scheduler or an approved Windows service wrapper.

Complete the dedicated account's first SteamCMD login interactively on the Arma box so Steam Guard can establish its local sentry file. The agent sends later credentials through SteamCMD's input stream; they are not included in the process command line or returned to the website.

The website requires `SERVER_CONTROL_AGENT_ENABLED=true`, `SERVER_AGENT_ID=arma-primary`, and the matching `SERVER_AGENT_TOKEN`. Keep the feature disabled until migration 119 has been applied and the agent heartbeat appears.

Workshop updates are first downloaded into SteamCMD's cache and then mirrored into the existing numeric staging folders. The existing `D:\Arma\@mod` symbolic links remain unchanged. Server keys are copied only when an authorised operator uses the separate **Copy Keys** action.

When a server has an existing `-mod=` launch argument and no Workshop IDs configured, the agent preserves that launch list. Once a complete website preset is saved, its Workshop IDs become the source of truth and replace the configured `-mod=` argument at launch.

