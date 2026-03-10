"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SessionUser = {
  id: number;
  username: string;
  full_name: string;
  role: "owner" | "manager";
  store_id: number | null;
};

type StoreRegisterRow = {
  id: number;
  store_id: number;
  register_number: number;
  active: boolean;
};

type MainType = "withdrawal" | "incident";
type IncidentType = "refund_cancel" | "abandon_cancel";

export default function RegistroPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [registers, setRegisters] = useState<StoreRegisterRow[]>([]);

  const [mainType, setMainType] = useState<MainType>("withdrawal");
  const [incidentType, setIncidentType] =
    useState<IncidentType>("refund_cancel");
  const [registerNumber, setRegisterNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [envelopeNumber, setEnvelopeNumber] = useState("");
  const [envelopePhoto, setEnvelopePhoto] = useState<File | null>(null);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "">("");
  const [loading, setLoading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    const savedUser = localStorage.getItem("ccdia_user");

    if (!savedUser) {
      window.location.href = "/";
      return;
    }

    const parsedUser: SessionUser = JSON.parse(savedUser);
    setUser(parsedUser);

    if (parsedUser.store_id) {
      loadRegisters(parsedUser.store_id);
    }
  }, []);

  const loadRegisters = async (storeId: number) => {
    const { data } = await supabase
      .from("store_registers")
      .select("*")
      .eq("store_id", storeId)
      .eq("active", true)
      .order("register_number", { ascending: true });

    if (data) {
      setRegisters(data);

      if (data.length > 0) {
        setRegisterNumber(String(data[0].register_number));
      }
    }
  };

  const pageTitle = useMemo(() => {
    return mainType === "withdrawal" ? "Retirada" : "Incidencia";
  }, [mainType]);

  const resetForm = () => {
    setMainType("withdrawal");
    setIncidentType("refund_cancel");
    if (registers.length > 0) {
      setRegisterNumber(String(registers[0].register_number));
    } else {
      setRegisterNumber("");
    }
    setAmount("");
    setComment("");
    setEnvelopeNumber("");
    setEnvelopePhoto(null);
    setFileInputKey((prev) => prev + 1);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setEnvelopePhoto(file);
  };

  const handleSave = async () => {
    if (!user) return;

    setMsg("");
    setMsgType("");

    if (user.role === "owner") {
      setMsg("El dueño no puede registrar movimientos desde esta pantalla");
      setMsgType("error");
      return;
    }

    if (!user.store_id) {
      setMsg("Este usuario no tiene tienda asignada");
      setMsgType("error");
      return;
    }

    if (!registerNumber || !amount) {
      setMsg("Rellena caja e importe");
      setMsgType("error");
      return;
    }

    const parsedRegisterNumber = Number(registerNumber);
    const parsedAmount = Number(amount);

    if (Number.isNaN(parsedRegisterNumber) || parsedRegisterNumber <= 0) {
      setMsg("La caja debe ser válida");
      setMsgType("error");
      return;
    }

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setMsg("El importe debe ser un número mayor que 0");
      setMsgType("error");
      return;
    }

    if (mainType === "withdrawal" && !envelopeNumber.trim()) {
      setMsg("Debes poner el número de sobre");
      setMsgType("error");
      return;
    }

    setLoading(true);

    let uploadedPhotoUrl: string | null = null;

    if (mainType === "withdrawal" && envelopePhoto) {
      const extension = envelopePhoto.name.split(".").pop() || "jpg";
      const safeName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;
      const filePath = `store-${user.store_id}/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("quick-records")
        .upload(filePath, envelopePhoto);

      if (uploadError) {
        setLoading(false);
        setMsg(`Error al subir la foto: ${uploadError.message}`);
        setMsgType("error");
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("quick-records")
        .getPublicUrl(filePath);

      uploadedPhotoUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase.from("quick_records").insert([
      {
        store_id: user.store_id,
        user_id: user.id,
        type: mainType,
        incident_type: mainType === "incident" ? incidentType : null,
        register_number: parsedRegisterNumber,
        employee_name: user.full_name,
        amount: parsedAmount,
        reason: comment.trim() || null,
        envelope_number: mainType === "withdrawal" ? envelopeNumber.trim() : null,
        envelope_photo_url:
          mainType === "withdrawal" ? uploadedPhotoUrl : null,
      },
    ]);

    setLoading(false);

    if (error) {
      if (
        error.message.includes("duplicate key") ||
        error.message.includes("quick_records_unique_store_envelope_withdrawal")
      ) {
        setMsg("Ese número de sobre ya existe en esta tienda");
        setMsgType("error");
        return;
      }

      setMsg(`Error al guardar: ${error.message}`);
      setMsgType("error");
      return;
    }

    setMsg("Guardado correctamente");
    setMsgType("success");
    resetForm();
  };

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-100">
        <p className="text-2xl font-bold">Cargando...</p>
      </main>
    );
  }

  if (user.role === "owner") {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow">
          <h1 className="mb-4 text-4xl font-black">Registro rápido</h1>
          <p className="text-2xl font-bold text-red-600">
            El dueño no puede registrar movimientos desde esta pantalla.
          </p>
          <p className="mt-4 text-xl text-neutral-700">
            Cierra sesión y entra con un usuario de tienda.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow">
          <h1 className="text-4xl font-black">Registro rápido</h1>
          <p className="mt-2 text-xl text-neutral-700">
            Usuario: {user.full_name} · Tienda: {user.store_id}
          </p>
          <p className="text-base text-neutral-500">
            La fecha y la hora se guardan automáticamente.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow space-y-4">
          <p className="text-2xl font-black">¿Qué estás apuntando?</p>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMainType("withdrawal")}
              className={`h-20 rounded-2xl border text-2xl font-black ${
                mainType === "withdrawal"
                  ? "border-black bg-black text-white"
                  : "border-neutral-300 bg-white text-black"
              }`}
            >
              Retirada
            </button>

            <button
              type="button"
              onClick={() => setMainType("incident")}
              className={`h-20 rounded-2xl border text-2xl font-black ${
                mainType === "incident"
                  ? "border-black bg-black text-white"
                  : "border-neutral-300 bg-white text-black"
              }`}
            >
              Incidencia
            </button>
          </div>

          {mainType === "incident" ? (
            <select
              className="h-16 w-full rounded-2xl border border-neutral-300 px-4 text-2xl outline-none"
              value={incidentType}
              onChange={(e) =>
                setIncidentType(e.target.value as IncidentType)
              }
            >
              <option value="refund_cancel">Anulación devolución</option>
              <option value="abandon_cancel">Anulación abandono</option>
            </select>
          ) : null}

          <select
            className="h-16 w-full rounded-2xl border border-neutral-300 px-4 text-2xl outline-none"
            value={registerNumber}
            onChange={(e) => setRegisterNumber(e.target.value)}
          >
            {registers.map((register) => (
              <option
                key={register.id}
                value={register.register_number}
              >
                Caja {register.register_number}
              </option>
            ))}
          </select>

          <input
            className="h-16 w-full rounded-2xl border border-neutral-300 px-4 text-2xl outline-none"
            placeholder="Importe (€)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          {mainType === "withdrawal" ? (
            <>
              <input
                className="h-16 w-full rounded-2xl border border-neutral-300 px-4 text-2xl outline-none"
                placeholder="Nº de sobre"
                value={envelopeNumber}
                onChange={(e) => setEnvelopeNumber(e.target.value)}
              />

              <div className="rounded-2xl border border-neutral-300 bg-white p-4">
                <label className="mb-2 block text-xl font-bold text-neutral-800">
                  Foto del sobre
                </label>
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-lg"
                />
                <p className="mt-2 text-base text-neutral-600">
                  Puedes guardar la retirada sin foto, pero la opción está disponible.
                </p>
              </div>
            </>
          ) : null}

          <input
            className="h-16 w-full rounded-2xl border border-neutral-300 px-4 text-2xl outline-none"
            placeholder={
              mainType === "withdrawal"
                ? "Comentario (opcional)"
                : `${pageTitle} (opcional)`
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <button
            onClick={handleSave}
            disabled={loading}
            className="h-16 w-full rounded-2xl bg-black text-2xl font-black text-white disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>

          {msg ? (
            <p
              className={`text-lg font-bold ${
                msgType === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {msg}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}