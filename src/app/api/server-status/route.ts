import { NextResponse } from "next/server";
import dgram from "dgram";

const SERVERS = [
  { id: 1, host: "77.68.28.88", basePort: 2100 },
  { id: 2, host: "77.68.28.88", basePort: 2200 },
  { id: 3, host: "77.68.28.88", basePort: 2300 },
];


function queryPlayers(host: string, port: number): Promise<string[]> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    let closed = false;
    const close = () => { if (!closed) { closed = true; try { socket.close(); } catch {} } };
    const finish = (players: string[]) => { clearTimeout(timeout); close(); resolve(players); };
    const request = (challenge = Buffer.from([0xff, 0xff, 0xff, 0xff])) => {
      socket.send(Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff, 0x55]), challenge]), port, host);
    };
    const timeout = setTimeout(() => finish([]), 3500);

    socket.on("message", (message) => {
      const type = message[4];
      if (type === 0x41 && message.length >= 9) {
        request(message.subarray(5, 9));
        return;
      }
      if (type !== 0x44 || message.length < 6) return;

      const names: string[] = [];
      const count = message.readUInt8(5);
      let offset = 6;
      for (let index = 0; index < count && offset < message.length; index += 1) {
        offset += 1;
        const end = message.indexOf(0x00, offset);
        if (end < 0) break;
        const name = message.toString("utf8", offset, end).trim();
        offset = end + 1 + 8;
        if (name) names.push(name.slice(0, 120));
      }
      finish(names);
    });
    socket.on("error", () => finish([]));
    request();
  });
}

function queryServer(host: string, port: number): Promise<null | { online: boolean; players: number; maxPlayers: number; missionFile: string; playerList: string[] }> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");

    let socketClosed = false;

    function safeClose() {
      if (socketClosed) return;
      socketClosed = true;

      try {
        socket.close();
      } catch {}
    }

    const baseRequest = Buffer.from([
      0xff, 0xff, 0xff, 0xff,
      0x54,
      ...Buffer.from("Source Engine Query"),
      0x00,
    ]);

    const timeout = setTimeout(() => {
      safeClose();
      resolve(null);
    }, 8000);

    let challengeToken: Buffer | null = null;

    socket.send(baseRequest, port, host);

    socket.on("message", (msg) => {
      clearTimeout(timeout);

      const type = msg[4];

      if (type === 0x41) {
        challengeToken = msg.slice(5);

        const challengeRequest = Buffer.concat([
          baseRequest,
          challengeToken,
        ]);

        socket.send(challengeRequest, port, host);
        return;
      }

      if (type === 0x49) {
        let offset = 5;
        offset += 1;

        const readString = () => {
          const end = msg.indexOf(0x00, offset);
          const str = msg.toString("utf8", offset, end);
          offset = end + 1;
          return str;
        };

        readString();
        const mapName = readString();
        readString();
        readString();

        offset += 2;

        const players = msg.readUInt8(offset);
        offset += 1;

        const maxPlayers = msg.readUInt8(offset);
        offset += 1;

        const missionFile = mapName;

        safeClose();
        void queryPlayers(host, port).then((playerList) => resolve({
          online: true,
          players,
          maxPlayers,
          missionFile,
          playerList,
        }));

        return;
      }
    });

    socket.on("error", (err) => {
      console.error("UDP Error:", err);
      clearTimeout(timeout);
      safeClose();
      resolve(null);
    });
  });
}


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

      console.error(
        `[SERVER OFFLINE] Failed to query ${server.id} (${server.host}) on ports ${ports.join(", ")}`
      );

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
