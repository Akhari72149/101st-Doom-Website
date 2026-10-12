export const battalionServers = [
  { id: 1, name: "Server 1", purpose: "MainOp & Training" },
  { id: 2, name: "Server 2", purpose: "FunOp" },
  { id: 3, name: "Server 3", purpose: "Misc" },
] as const;

export const battalionServerIds = battalionServers.map((server) => server.id);

export function battalionServer(serverId: number) {
  return battalionServers.find((server) => server.id === serverId) || battalionServers[0];
}
