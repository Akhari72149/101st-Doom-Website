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

    const baseRequest = Buffer.from([
      0xff, 0xff, 0xff, 0xff,
      0x54,
      ...Buffer.from("Source Engine Query"),
      0x00,
    ]);

    let timeout = setTimeout(() => {
      socket.close();
      resolve(null);
    }, 4000);

    // 🔥 Send initial request
    socket.send(baseRequest, port, host);

    socket.on("message", (msg) => {

      clearTimeout(timeout);

      const type = msg[4];

      /* ===================================================== */
      /* ============== CHALLENGE RESPONSE (0x41) ============ */
      /* ===================================================== */

      if (type === 0x41) {

        // Challenge token is usually 4 bytes after header
        const challenge = msg.slice(5, 9);

        const challengeRequest = Buffer.concat([
          baseRequest,
          challenge,
        ]);

        // Resend with challenge
        socket.send(challengeRequest, port, host);
        return;
      }

      /* ===================================================== */
      /* ================= INFO RESPONSE (0x49) ============== */
      /* ===================================================== */

      if (type === 0x49) {


        try {
          let offset = 5;

          // Skip protocol
          offset += 1;

          const readString = () => {
            const end = msg.indexOf(0x00, offset);
            const str = msg.toString("utf8", offset, end);
            offset = end + 1;
            return str;
          };

          // Server metadata
          readString(); // server name
          readString(); // map
          readString(); // folder
          readString(); // game

          // Skip app id
          offset += 2;

          const players = msg[offset];
          offset += 1;

          const maxPlayers = msg[offset];
          offset += 1;



          socket.close();

          resolve({
            online: true,
            players,
            maxPlayers,
            playerList: [],
          });

          return;
        } catch (err) {
          console.error("Parsing error:", err);
          socket.close();
          resolve(null);
        }
      }

      /* ===================================================== */
      /* ============= UNKNOWN RESPONSE (FALLBACK) =========== */
      /* ===================================================== */

      socket.close();
      resolve({
        online: true,
        players: 0,
        maxPlayers: 0,
        playerList: [],
      });
    });

    socket.on("error", (err) => {
      console.error("Socket error:", err);
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