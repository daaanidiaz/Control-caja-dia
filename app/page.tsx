"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserRow = {
  id: number;
  username: string;
  password: string;
  full_name: string;
  role: "owner" | "manager";
  store_id: number | null;
  active: boolean;
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username.trim())
      .eq("active", true)
      .maybeSingle<UserRow>();

    if (error) {
      setErrorMsg("Error al conectar con la base de datos");
      setLoading(false);
      return;
    }

    if (!data) {
      setErrorMsg("Usuario no encontrado");
      setLoading(false);
      return;
    }

    if (data.password !== password) {
      setErrorMsg("Contraseña incorrecta");
      setLoading(false);
      return;
    }

    localStorage.setItem(
      "ccdia_user",
      JSON.stringify({
        id: data.id,
        username: data.username,
        full_name: data.full_name,
        role: data.role,
        store_id: data.store_id,
      })
    );

    window.location.href = "/panel";
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex items-center justify-center p-6">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow"
      >
        <h1 className="mb-8 text-center text-4xl font-black text-neutral-900">
          Control de caja
        </h1>

        <label className="mb-2 block text-lg font-bold text-neutral-800">
          Usuario
        </label>
        <input
          className="mb-5 h-16 w-full rounded-2xl border border-neutral-300 px-4 text-xl outline-none"
          type="text"
          placeholder="Escribe tu usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="mb-2 block text-lg font-bold text-neutral-800">
          Contraseña
        </label>
        <input
          className="mb-6 h-16 w-full rounded-2xl border border-neutral-300 px-4 text-xl outline-none"
          type="password"
          placeholder="Escribe tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="h-16 w-full rounded-2xl bg-black text-2xl font-black text-white"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        {errorMsg ? (
          <p className="mt-4 text-center text-lg font-semibold text-red-600">
            {errorMsg}
          </p>
        ) : null}
      </form>
    </main>
  );
}