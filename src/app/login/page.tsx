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
      bg-gradient-to-br from-[#001200] via-[#002700] to-[#000a00]
      text-[#eafff2] font-orbitron">

      {/* BACK BUTTON */}
      <button
        onClick={() => router.push("/pcs")}
        className="
          mb-8
          border border-[#00ff4c]
          px-5 py-2
          rounded-lg
          transition-all duration-300
          shadow-[0_0_15px_rgba(0,255,80,0.3)]
          hover:bg-[#003d14]
          hover:text-[#00ff4c]
          hover:scale-105
          hover:shadow-[0_0_25px_rgba(0,255,80,0.6)]
        "
      >
        ← Back to Dashboard
      </button>

      {/* LOGIN BOX */}
      <div className="
        border border-[#00ff4c]
        bg-black/60 backdrop-blur-xl
        p-10 rounded-2xl w-96
        shadow-[0_0_50px_rgba(0,255,80,0.25)]
      ">

        <h1 className="text-3xl mb-8 text-center text-[#00ff4c] tracking-widest">
          ADMIN ACCESS
        </h1>

        {/* EMAIL */}
        <input
          className="
            mb-6 w-full p-3
            bg-black
            border border-[#00ff4c]
            rounded-lg
            text-white
            placeholder-gray-400
            focus:outline-none
            focus:ring-2 focus:ring-[#00ff4c]
            transition-all duration-300
            shadow-[0_0_15px_rgba(0,255,80,0.2)]
          "
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* PASSWORD */}
        <input
          type="password"
          className="
            mb-6 w-full p-3
            bg-black
            border border-[#00ff4c]
            rounded-lg
            text-white
            placeholder-gray-400
            focus:outline-none
            focus:ring-2 focus:ring-[#00ff4c]
            transition-all duration-300
            shadow-[0_0_15px_rgba(0,255,80,0.2)]
          "
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* LOGIN BUTTON */}
        <button
          onClick={handleLogin}
          className="
            w-full
            border border-[#00ff4c]
            py-3 rounded-lg
            text-[#00ff4c]
            transition-all duration-300
            shadow-[0_0_20px_rgba(0,255,80,0.4)]
            hover:bg-[#003d14]
            hover:text-[#00ff4c]
            hover:scale-105
            hover:shadow-[0_0_30px_rgba(0,255,80,0.7)]
          "
        >
          LOGIN
        </button>

      </div>
    </div>
  );
}