"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/");
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

        {/* EMAIL */}
        <div className="mb-6">
          <label className="text-xs text-gray-400 tracking-widest">
            EMAIL
          </label>

          <input
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        {/* LOGIN BUTTON */}
        <button
          onClick={handleLogin}
          className="
            w-full py-3 rounded-xl
            bg-gradient-to-r from-[#00ff66] to-[#00cc44]
            text-black font-semibold
            shadow-lg
            hover:scale-105
            hover:shadow-[0_0_25px_rgba(0,255,100,0.6)]
            transition-all duration-200
          "
        >
          LOGIN
        </button>

      </div>
    </div>
  );
}