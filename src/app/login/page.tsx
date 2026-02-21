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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b140b] text-white">
	<button
    onClick={() => router.push("/")}
    className="mb-6 bg-[#002700] px-4 py-2 hover:bg-[#004d00] transition"
  >
    ← Back to Dashboard
  </button>
      <h1 className="text-3xl mb-6">Admin Login</h1>

      <input
        className="mb-4 p-2 bg-[#0f1a0f] border border-[#002700]"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        className="mb-4 p-2 bg-[#0f1a0f] border border-[#002700]"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleLogin}
        className="bg-[#002700] px-6 py-2 hover:bg-[#004d00]"
      >
        Login
      </button>
    </div>
  );
}