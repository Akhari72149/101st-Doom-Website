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
      bg-gradient-to-br from-[#05080f] via-[#0b0f1a] to-black 
      text-white font-orbitron">

      {/* BACK BUTTON */}
      <button
        onClick={() => router.push("/")}
        className="mb-8 border border-[#00e5ff] px-5 py-2 rounded-lg 
        hover:bg-[#00e5ff] hover:text-black transition 
        shadow-[0_0_15px_rgba(0,229,255,0.5)]"
      >
        ← Back to Dashboard
      </button>

      {/* LOGIN BOX */}
      <div className="border border-[#00e5ff] bg-black/60 backdrop-blur-xl 
        p-10 rounded-2xl w-96 
        shadow-[0_0_40px_rgba(0,229,255,0.3)]">

        <h1 className="text-3xl mb-8 text-center text-[#00e5ff] tracking-widest">
          ADMIN ACCESS
        </h1>

        {/* EMAIL */}
        <input
          className="mb-6 w-full p-3 bg-black border border-[#00e5ff] 
          rounded-lg text-white placeholder-gray-400 focus:outline-none 
          focus:shadow-[0_0_15px_rgba(0,229,255,0.6)] transition"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* PASSWORD */}
        <input
          type="password"
          className="mb-6 w-full p-3 bg-black border border-[#00e5ff] 
          rounded-lg text-white placeholder-gray-400 focus:outline-none 
          focus:shadow-[0_0_15px_rgba(0,229,255,0.6)] transition"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* LOGIN BUTTON */}
        <button
          onClick={handleLogin}
          className="w-full border border-[#00e5ff] py-3 rounded-lg 
          text-[#00e5ff] hover:bg-[#00e5ff] hover:text-black 
          transition shadow-[0_0_20px_rgba(0,229,255,0.6)]"
        >
          LOGIN
        </button>

      </div>
    </div>
  );
}