"use client";

import dynamic from "next/dynamic";

const ModelCustomiser = dynamic(() => import("./ModelCustomiser"), {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#00e985" }}>
      Initialising model customiser...
    </main>
  ),
});

export default function ModelCustomiserLoader() {
  return <ModelCustomiser />;
}

