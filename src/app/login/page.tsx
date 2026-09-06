"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LegalAcknowledgement from "@/components/legal/LegalAcknowledgement";
import { signInToApp, usesNativeAuth } from "@/lib/client-auth";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();
  const nativeAuth = usesNativeAuth();

  const handleLogin = async () => {
    if (!identifier.trim() || !password) return;
    setSubmitting(true);
    setErrorMessage("");
    const result = await signInToApp(identifier, password);
    setSubmitting(false);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center
      bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]
      text-[#eafff2]
    ">

      {/* BACK BUTTON */}
      <button
        onClick={() => router.push("/pcs")}
        className="
          absolute top-8 left-8
          px-4 py-2 rounded-lg
          border border-[#00ff66]/50
          text-[#00ff66]
          backdrop-blur-md
          transition-all duration-200
          hover:bg-[#00ff66]/10
          hover:scale-105
        "
      >
        ← Back
      </button>

      {/* LOGIN BOX */}
      <div className="
        w-96 p-10 rounded-3xl
        bg-black/50 backdrop-blur-xl
        border border-[#00ff66]/30
        shadow-[0_0_60px_rgba(0,255,100,0.2)]
      ">

        <h1 className="
          text-3xl mb-8 text-center
          text-[#00ff66]
          tracking-[0.4em]
          font-bold
        ">
          ADMIN ACCESS
        </h1>

        <div className="mb-6">
          <label className="text-xs text-gray-400 tracking-widest">
            {nativeAuth ? "USERNAME" : "EMAIL"}
          </label>

          <input
            autoComplete={nativeAuth ? "username" : "email"}
            placeholder={nativeAuth ? "Enter username" : "Enter email"}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="
              w-full mt-2 p-3 rounded-xl
              bg-black/40 backdrop-blur-md
              border border-[#00ff66]/30
              text-[#00ff66]
              placeholder:text-[#00ff66]/40
              focus:border-[#00ff66]
              focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
              transition-all duration-300
            "
          />
        </div>

        {/* PASSWORD */}
        <div className="mb-8">
          <label className="text-xs text-gray-400 tracking-widest">
            PASSWORD
          </label>

          <input
            type="password"
            autoComplete="current-password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !submitting) void handleLogin();
            }}
            className="
              w-full mt-2 p-3 rounded-xl
              bg-black/40 backdrop-blur-md
              border border-[#00ff66]/30
              text-[#00ff66]
              placeholder:text-[#00ff66]/40
              focus:border-[#00ff66]
              focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
              transition-all duration-300
            "
          />
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={submitting || !identifier.trim() || !password}
          className="
            w-full py-3 rounded-xl
            bg-gradient-to-r from-[#00ff66] to-[#00cc44]
            text-black font-semibold
            shadow-lg
            hover:scale-105
            hover:shadow-[0_0_25px_rgba(0,255,100,0.6)]
            transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          {submitting ? "AUTHENTICATING" : "LOGIN"}
        </button>

        <div className="mt-6">
          <LegalAcknowledgement />
        </div>

      </div>
    </div>
  );
}
