import { NextResponse } from "next/server";
import dgram from "dgram";

const SERVERS = [
  { id: 1, host: "199.33.118.13", basePort: 2000 },
  { id: 2, host: "199.33.118.13", basePort: 2100 },
  { id: 3, host: "199.33.118.13", basePort: 2200 },
  { id: 4, host: "199.33.118.13", basePort: 2300 },
  { id: 5, host: "199.33.118.13", basePort: 2400 },
  { id: 6, host: "199.33.118.13", basePort: 2500 },
];

/* ===================================================== */
/* ================== UDP QUERY ======================== */
/* ===================================================== */

function queryServer(host: string, port: number): Promise<any> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");

    const request = Buffer.from([
      0xff, 0xff, 0xff, 0xff,
      0x54,
      ...Buffer.from("Source Engine Query"),
      0x00,
    ]);

    const timeout = setTimeout(() => {
      socket.close();
      resolve(null);
    }, 3000);

    socket.send(request, port, host);

    socket.on("message", (msg) => {
      clearTimeout(timeout);
      socket.close();

      try {
        const type = msg[4];

        // If it's an INFO response
        if (type === 0x49) {
          let offset = 5;

          // skip protocol
          offset += 1;

          const readString = () => {
            const end = msg.indexOf(0x00, offset);
            const str = msg.toString("utf8", offset, end);
            offset = end + 1;
            return str;
          };

          // server name
          readString();
          // map
          readString();
          // folder
          readString();
          // game
          readString();

          offset += 2; // app id

          const players = msg[offset];
          offset += 1;

          const maxPlayers = msg[offset];
          offset += 1;

          resolve({
            online: true,
            players,
            maxPlayers,
            playerList: [],
          });

          return;
        }

        resolve({
          online: true,
          players: 0,
          maxPlayers: 0,
          playerList: [],
        });

      } catch {
        resolve(null);
      }
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      socket.close();
      resolve(null);
    });
  });
}

/* ===================================================== */
/* ===================== API =========================== */
/* ===================================================== */

export async function GET() {
  const results = await Promise.all(
    SERVERS.map(async (server) => {
      const ports = [server.basePort, server.basePort + 1];

      for (const port of ports) {
        const data = await queryServer(server.host, port);

        if (data) {
          return {
            id: server.id,
            host: server.host,
            port,
            ...data,
          };
        }
      }

      return {
        id: server.id,
        host: server.host,
        online: false,
        players: 0,
        maxPlayers: 0,
        playerList: [],
      };
    })
  );

  return NextResponse.json(results);
}