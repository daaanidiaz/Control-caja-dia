"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function CierrePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [registers, setRegisters] = useState<StoreRegisterRow[]>([]);

  const today = new Date().toISOString().slice(0, 10);

  const [registerNumber, setRegisterNumber] = useState("");
  const [totalTpv, setTotalTpv] = useState("");
  const [totalCard, setTotalCard] = useState("");
  const [withdrawalsAmount, setWithdrawalsAmount] = useState("");
  const [peakAmount, setPeakAmount] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "">("");
  const [loading, setLoading] = useState(false);

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
    const { data, error } = await supabase
      .from("store_registers")
      .select("*")
      .eq("store_id", storeId)
      .eq("active", true)
      .order("register_number", { ascending: true });

    if (!error && data) {
      setRegisters(data);
      if (data.length > 0) {
        setRegisterNumber(String(data[0].register_number));
      }
    }
  };

  const nRegisterNumber = Number(registerNumber || 0);
  const nTotalTpv = Number(totalTpv || 0);
  const nTotalCard = Number(totalCard || 0);
  const nWithdrawalsAmount = Number(withdrawalsAmount || 0);
  const nPeakAmount = Number(peakAmount || 0);
  const nCountedCash = Number(countedCash || 0);

  const cashSales = useMemo(() => {
    return nTotalTpv - nTotalCard;
  }, [nTotalTpv, nTotalCard]);

  const expectedCash = useMemo(() => {
    return cashSales - nWithdrawalsAmount;
  }, [cashSales, nWithdrawalsAmount]);

  const differenceAmount = useMemo(() => {
    return nCountedCash - expectedCash;
  }, [nCountedCash, expectedCash]);

  const resetForm = () => {
    if (registers.length > 0) {
      setRegisterNumber(String(registers[0].register_number));
    }
    setTotalTpv("");
    setTotalCard("");
    setWithdrawalsAmount("");
    setPeakAmount("");
    setCountedCash("");
    setNotes("");
  };

  const handleSave = async () => {
    if (!user) return;
    setMsg("");
    setMsgType("");

    if (user.role === "owner") {
      setMsg("El dueño no puede hacer cierres desde esta pantalla");
      setMsgType("error");
      return;
    }

    const fields = [
      { val: registerNumber, name: "caja" },
      { val: totalTpv, name: "total TPV" },
      { val: totalCard, name: "total tarjeta" },
      { val: withdrawalsAmount, name: "retiradas" },
      { val: peakAmount, name: "pico" },
      { val: countedCash, name: "efectivo contado" },
    ];

    for (const field of fields) {
      if (field.val === "") {
        setMsg(`Debes rellenar el campo: ${field.name}`);
        setMsgType("error");
        return;
      }
    }

    setLoading(true);

    const status = Math.abs(differenceAmount) < 0.01 ? "ok" : "alert";

    const { error } = await supabase.from("daily_closings").insert([
      {
        closing_date: today,
        store_id: user.store_id,
        user_id: user.id,
        register_number: nRegisterNumber,
        opening_cash: 0,
        cash_sales: cashSales,
        card_sales: nTotalCard,
        returns_amount: 0,
        expenses_amount: 0,
        withdrawals_amount: nWithdrawalsAmount,
        expected_cash: expectedCash,
        counted_cash: nCountedCash,
        difference_amount: differenceAmount,
        total_tpv: nTotalTpv,
        total_card: nTotalCard,
        peak_amount: nPeakAmount,
        notes: notes.trim() || null,
        status,
      },
    ]);

    if (error) {
      setLoading(false);
      setMsg(`Error al guardar: ${error.message}`);
      setMsgType("error");
      return;
    }

    setLoading(false);
    setMsg("Cierre guardado correctamente");
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

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow space-y-4">
          <label className="block text-sm font-bold ml-1">Seleccionar Caja</label>
          <select
            className="h-16 w-full rounded-2xl border px-4 text-2xl"
            value={registerNumber}
            onChange={(e) => setRegisterNumber(e.target.value)}
          >
            {registers.map((register) => (
              <option key={register.id} value={register.register_number}>
                Caja {register.register_number}
              </option>
            ))}
          </select>

          <input
            className="h-16 w-full rounded-2xl border px-4 text-2xl"
            type="number"
            placeholder="Total TPV"
            value={totalTpv}
            onChange={(e) => setTotalTpv(e.target.value)}
          />

          <input
            className="h-16 w-full rounded-2xl border px-4 text-2xl"
            type="number"
            placeholder="Total tarjeta"
            value={totalCard}
            onChange={(e) => setTotalCard(e.target.value)}
          />

          <input
            className="h-16 w-full rounded-2xl border px-4 text-2xl"
            type="number"
            placeholder="Retiradas de efectivo"
            value={withdrawalsAmount}
            onChange={(e) => setWithdrawalsAmount(e.target.value)}
          />

          <input
            className="h-16 w-full rounded-2xl border px-4 text-2xl"
            type="number"
            placeholder="Pico (Fondo de caja)"
            value={peakAmount}
            onChange={(e) => setPeakAmount(e.target.value)}
          />

          <input
            className="h-16 w-full rounded-2xl border px-4 text-2xl"
            type="number"
            placeholder="Efectivo contado real"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
          />

          <textarea
            className="w-full rounded-2xl border px-4 py-4 text-2xl"
            placeholder="Observaciones..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button
            onClick={handleSave}
            disabled={loading}
            className="h-16 w-full rounded-2xl bg-black text-2xl font-black text-white hover:bg-neutral-800 transition-colors disabled:bg-neutral-400"
          >
            {loading ? "Guardando..." : "Guardar cierre"}
          </button>

          {msg && (
            <div
              className={`p-4 rounded-xl text-center text-lg font-bold ${
                msgType === "success"
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {msg}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}