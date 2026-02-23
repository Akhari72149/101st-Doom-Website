import { NextResponse } from "next/server";
import dgram from "dgram";

/*
  BattleMetrics-style raw UDP Steam query
  - Send A2S_INFO packet
  - Wait for response
  - Parse server name + players
*/

const SERVERS = [
  { id: 1, host: "199.33.118.13", basePort: 2000 },
  { id: 2, host: "199.33.118.13", basePort: 2100 },
  { id: 3, host: "199.33.118.13", basePort: 2200 },
  { id: 4, host: "199.33.118.13", basePort: 2300 },
  { id: 5, host: "199.33.118.13", basePort: 2400 },
  { id: 6, host: "199.33.118.13", basePort: 2500 },
];

function queryServer(host: string, port: number): Promise<any> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");

    // Steam A2S_INFO request
    const request = Buffer.from([
      0xFF, 0xFF, 0xFF, 0xFF,
      0x54,
      ...Buffer.from("Source Engine Query"),
      0x00
    ]);

    const timeout = setTimeout(() => {
      socket.close();
      resolve(null);
    }, 4000);

    socket.send(request, port, host);

    socket.on("message", (msg) => {
      clearTimeout(timeout);
      socket.close();

      resolve({
        raw: msg,
      });
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      socket.close();
      resolve(null);
    });
  });
}

export async function GET() {
  const results = await Promise.all(
    SERVERS.map(async (server) => {
      const portsToTry = [server.basePort, server.basePort + 1];

      for (const port of portsToTry) {
        const response = await queryServer(server.host, port);

        if (response) {
          // Server responded → Mark online
          return {
            id: server.id,
            host: server.host,
            online: true,
            queryPort: port,
            players: 1, // We will improve this next
            playerList: [],
          };
        }
      }

      // If nothing responded
      return {
        id: server.id,
        host: server.host,
        online: false,
        players: 0,
        playerList: [],
      };
    })
  );

  return NextResponse.json(results);
}