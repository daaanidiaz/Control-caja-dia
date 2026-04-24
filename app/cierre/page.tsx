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

type ExistingClosingRow = {
  id: number;
  edit_count: number;
  store_id: number;
  register_number: number | null;
  closing_date: string;
  total_tpv?: number;
  total_card?: number;
  withdrawals_amount?: number;
  virtual_sales?: number;
  peak_amount?: number;
  counted_cash?: number;
  notes?: string | null;
};

export default function CierrePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [registers, setRegisters] = useState<StoreRegisterRow[]>([]);

  const today = new Date().toISOString().slice(0, 10);

  const [registerNumber, setRegisterNumber] = useState("");
  const [totalTpv, setTotalTpv] = useState("");
  const [totalCard, setTotalCard] = useState("");
  const [withdrawalsAmount, setWithdrawalsAmount] = useState("");
  const [virtualSales, setVirtualSales] = useState("");
  const [peakAmount, setPeakAmount] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "">("");
  const [loading, setLoading] = useState(false);
  const [existingClosing, setExistingClosing] =
    useState<ExistingClosingRow | null>(null);

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

  useEffect(() => {
    if (!user?.store_id || !registerNumber) return;
    checkExistingClosing(user.store_id, Number(registerNumber), today);
  }, [user, registerNumber, today]);

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

  const checkExistingClosing = async (
    storeId: number,
    registerNum: number,
    closingDate: string
  ) => {
    const { data } = await supabase
      .from("daily_closings")
      .select(
        "id, edit_count, store_id, register_number, closing_date, total_tpv, total_card, withdrawals_amount, virtual_sales, peak_amount, counted_cash, notes"
      )
      .eq("store_id", storeId)
      .eq("register_number", registerNum)
      .eq("closing_date", closingDate)
      .maybeSingle();

    setExistingClosing(data ?? null);

    if (data) {
      setTotalTpv(String(data.total_tpv ?? ""));
      setTotalCard(String(data.total_card ?? ""));
      setWithdrawalsAmount(String(data.withdrawals_amount ?? ""));
      setVirtualSales(String(data.virtual_sales ?? ""));
      setPeakAmount(String(data.peak_amount ?? ""));
      setCountedCash(String(data.counted_cash ?? ""));
      setNotes(data.notes ?? "");
    } else {
      setTotalTpv("");
      setTotalCard("");
      setWithdrawalsAmount("");
      setVirtualSales("");
      setPeakAmount("");
      setCountedCash("");
      setNotes("");
    }
  };

  const nRegisterNumber = Number(registerNumber || 0);
  const nTotalTpv = Number(totalTpv || 0);
  const nTotalCard = Number(totalCard || 0);
  const nWithdrawalsAmount = Number(withdrawalsAmount || 0);
  const nVirtualSales = Number(virtualSales || 0);
  const nPeakAmount = Number(peakAmount || 0);
  const nCountedCash = Number(countedCash || 0);

  const cashSales = useMemo(() => {
    return nTotalTpv - nTotalCard + nVirtualSales;
  }, [nTotalTpv, nTotalCard, nVirtualSales]);

  const expectedCash = useMemo(() => {
    return cashSales - nWithdrawalsAmount;
  }, [cashSales, nWithdrawalsAmount]);

  const differenceAmount = useMemo(() => {
    return nCountedCash - expectedCash;
  }, [nCountedCash, expectedCash]);

  const clearForm = () => {
    setTotalTpv("");
    setTotalCard("");
    setWithdrawalsAmount("");
    setVirtualSales("");
    setPeakAmount("");
    setCountedCash("");
    setNotes("");
  };

  const validateFields = () => {
    const fields = [
      { val: registerNumber, name: "caja" },
      { val: totalTpv, name: "total TPV" },
      { val: totalCard, name: "total tarjeta" },
      { val: withdrawalsAmount, name: "retiradas" },
      { val: virtualSales, name: "venta virtual" },
      { val: peakAmount, name: "pico" },
      { val: countedCash, name: "efectivo contado" },
    ];

    for (const field of fields) {
      if (field.val === "") {
        setMsg(`Debes rellenar el campo: ${field.name}`);
        setMsgType("error");
        return false;
      }
    }

    if (Number.isNaN(nVirtualSales)) {
      setMsg("La venta virtual no es válida");
      setMsgType("error");
      return false;
    }

    if (nVirtualSales > 0) {
      setMsg("La venta virtual tiene que ser negativa. Ejemplo: -50");
      setMsgType("error");
      return false;
    }

    return true;
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

    if (!validateFields()) return;

    setLoading(true);

    const status = Math.abs(differenceAmount) < 0.01 ? "ok" : "alert";

    if (!existingClosing) {
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
          virtual_sales: nVirtualSales,
          expected_cash: expectedCash,
          counted_cash: nCountedCash,
          difference_amount: differenceAmount,
          total_tpv: nTotalTpv,
          total_card: nTotalCard,
          peak_amount: nPeakAmount,
          notes: notes.trim() || null,
          status,
          edit_count: 0,
        },
      ]);

      if (error) {
        setLoading(false);
        setMsg(`Error al guardar: ${error.message}`);
        setMsgType("error");
        return;
      }

      setLoading(false);
      setMsg("Cierre guardado correctamente. Si te has equivocado, puedes modificarlo una sola vez.");
      setMsgType("success");
      clearForm();
      await checkExistingClosing(user.store_id!, nRegisterNumber, today);
      return;
    }

    if (existingClosing.edit_count >= 1) {
      setLoading(false);
      setMsg("Este cierre ya fue modificado una vez y no se puede volver a cambiar");
      setMsgType("error");
      return;
    }

    const { error } = await supabase
      .from("daily_closings")
      .update({
        cash_sales: cashSales,
        card_sales: nTotalCard,
        withdrawals_amount: nWithdrawalsAmount,
        virtual_sales: nVirtualSales,
        expected_cash: expectedCash,
        counted_cash: nCountedCash,
        difference_amount: differenceAmount,
        total_tpv: nTotalTpv,
        total_card: nTotalCard,
        peak_amount: nPeakAmount,
        notes: notes.trim() || null,
        status,
        edit_count: 1,
        last_edited_at: new Date().toISOString(),
        last_edited_by: user.id,
      })
      .eq("id", existingClosing.id);

    if (error) {
      setLoading(false);
      setMsg(`Error al modificar: ${error.message}`);
      setMsgType("error");
      return;
    }

    setLoading(false);
    setMsg("Cierre modificado correctamente. Ya no se podrá volver a editar.");
    setMsgType("success");
    await checkExistingClosing(user.store_id!, nRegisterNumber, today);
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

          {existingClosing ? (
            <div className="rounded-xl bg-yellow-100 p-4 text-lg font-bold text-yellow-800">
              {existingClosing.edit_count === 0
                ? "Cierre guardado correctamente. Si te has equivocado, puedes modificarlo una sola vez."
                : "Este cierre ya fue corregido una vez. No se puede volver a modificar."}
            </div>
          ) : null}

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
            placeholder="Venta virtual (-)"
            value={virtualSales}
            onChange={(e) => setVirtualSales(e.target.value)}
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
            disabled={loading || (!!existingClosing && existingClosing.edit_count >= 1)}
            className="h-16 w-full rounded-2xl bg-black text-2xl font-black text-white hover:bg-neutral-800 transition-colors disabled:bg-neutral-400"
          >
            {loading
              ? "Guardando..."
              : existingClosing
              ? "Modificar cierre"
              : "Guardar cierre"}
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