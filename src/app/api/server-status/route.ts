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
/* ================= SAFE SOCKET CLOSE ================== */
/* ===================================================== */

function queryServer(host: string, port: number): Promise<any> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");

    // ✅ Track socket state ourselves
    let socketClosed = false;

    function safeClose() {
      if (socketClosed) return;
      socketClosed = true;

      try {
        socket.close();
      } catch (err) {
        // ignore
      }
    }

    const baseRequest = Buffer.from([
      0xff, 0xff, 0xff, 0xff,
      0x54,
      ...Buffer.from("Source Engine Query"),
      0x00,
    ]);

    let timeout = setTimeout(() => {
      safeClose();
      resolve(null);
    }, 8000);

    let challengeToken: Buffer | null = null;

    socket.send(baseRequest, port, host);

    socket.on("message", (msg) => {
      clearTimeout(timeout);

      const type = msg[4];

      /* ================= CHALLENGE ================= */
      if (type === 0x41) {
        challengeToken = msg.slice(5);

        const challengeRequest = Buffer.concat([
          baseRequest,
          challengeToken,
        ]);

        socket.send(challengeRequest, port, host);
        return;
      }

      /* ================= SERVER INFO ================= */
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
        readString();
        readString();
        readString();

        offset += 2;

        const players = msg.readUInt8(offset);
        offset += 1;

        const maxPlayers = msg.readUInt8(offset);
        offset += 1;

        const playerRequest = Buffer.from([
          0xff, 0xff, 0xff, 0xff,
          0x55,
          ...(challengeToken ?? []),
        ]);

        socket.send(playerRequest, port, host);

        return resolvePlayerListener(players, maxPlayers);
      }

      /* ================= PLAYER RESPONSE ================= */
      if (type === 0x44) {
        
        const playerCount = msg.readUInt8(5);
        let offset = 3;

        const playerList: string[] = [];

        for (let i = 0; i < playerCount; i++) {
          offset += 4;

          const end = msg.indexOf(0x00, offset);
          const name = msg.toString("utf8", offset, end);

          playerList.push(name);
          offset = end + 1;
        }

        safeClose();

        resolve({
          online: true,
          players: playerList.length,
          maxPlayers: 0,
          playerList,
        });
      }
    });

    function resolvePlayerListener(players: number, maxPlayers: number) {
      socket.once("message", (playerMsg) => {
        const type = playerMsg[4];

        if (type !== 0x44) {
          safeClose();
          resolve({
            online: true,
            players,
            maxPlayers,
            playerList: [],
          });
          return;
        }

        const playerCount = playerMsg.readUInt8(5);
        let offset = 6;

        const playerList: string[] = [];

        for (let i = 0; i < playerCount; i++) {

  // Arma / Source player packet format:
  // 1 byte index
  // 2 bytes score
  // 1 byte time connected
  offset += 1;

  const end = playerMsg.indexOf(0x00, offset);
  if (end === -1) break;

  const rawName = playerMsg.toString("utf8", offset, end);

  console.log("RAW PLAYER STRING FROM PACKET:", rawName);

  playerList.push(rawName.trim());

  offset = end + 1;
}

        safeClose();

        resolve({
          online: true,
          players,
          maxPlayers,
          playerList,
        });
      });
    }

    socket.on("error", (err) => {
      console.error("UDP Error:", err);
      clearTimeout(timeout);
      safeClose();
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
        console.log(`Querying server ${server.id} on port ${port}`);
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