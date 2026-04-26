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

type StoreRow = {
  id: number;
  name: string;
  code: string;
};

type ClosingRow = {
  id: number;
  created_at: string;
  closing_date: string;
  store_id: number;
  register_number: number | null;
  total_tpv?: number;
  total_card?: number;
  withdrawals_amount: number;
  peak_amount?: number;
  counted_cash: number;
  difference_amount: number;
  status: string;
  edit_count?: number;
  last_edited_at?: string | null;
};

type QuickRecordRow = {
  id: number;
  created_at: string;
  store_id: number;
  type: "withdrawal" | "incident";
  incident_type: "refund_cancel" | "abandon_cancel" | null;
  register_number: number | null;
  employee_name: string;
  amount: number;
  reason: string | null;
  envelope_number: string | null;
  envelope_photo_url: string | null;
};

type LiveAlertRow = {
  id: string;
  created_at: string;
  store_id: number | null;
  register_number: number | null;
  level: "low" | "medium" | "high";
  message: string;
};

export default function PanelPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [closings, setClosings] = useState<ClosingRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [quickRecords, setQuickRecords] = useState<QuickRecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStore, setFilterStore] = useState<string>("all");
  const [filterRegister, setFilterRegister] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");

  useEffect(() => {
    const savedUser = localStorage.getItem("ccdia_user");

    if (!savedUser) {
      window.location.href = "/";
      return;
    }

    const parsedUser: SessionUser = JSON.parse(savedUser);
    setUser(parsedUser);

    if (parsedUser.role === "owner") {
      loadOwnerData();
    } else {
      loadStoresOnly();
    }
  }, []);

  const loadStoresOnly = async () => {
    const { data } = await supabase.from("stores").select("*").order("id");

    if (data) {
      setStores(data);
    }

    setLoading(false);
  };

  const loadOwnerData = async () => {
    const { data: closingsData } = await supabase
      .from("daily_closings")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: storesData } = await supabase
      .from("stores")
      .select("*")
      .order("id", { ascending: true });

    const { data: quickRecordsData } = await supabase
      .from("quick_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (closingsData) setClosings(closingsData);
    if (storesData) setStores(storesData);
    if (quickRecordsData) setQuickRecords(quickRecordsData);

    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("ccdia_user");
    window.location.href = "/";
  };

  const getAlertColor = (level: "low" | "medium" | "high") => {
    if (level === "high") return "bg-red-100 text-red-700";
    if (level === "medium") return "bg-yellow-100 text-yellow-700";
    return "bg-blue-100 text-blue-700";
  };

  const getStoreName = (storeId: number | null) => {
    if (!storeId) return "-";
    const store = stores.find((s) => s.id === storeId);
    return store ? store.name : `Tienda ${storeId}`;
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);

    return date.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getQuickRecordTypeLabel = (record: QuickRecordRow) => {
    if (record.type === "withdrawal") return "Retirada";
    if (record.incident_type === "refund_cancel") return "Anulación devolución";
    if (record.incident_type === "abandon_cancel") return "Anulación abandono";
    return "Incidencia";
  };

  const getRegisterLabel = (registerNumber: number | null) => {
    return registerNumber ? `Caja ${registerNumber}` : "Retirada manual";
  };

  const getLiveDifference = (closing: ClosingRow) => {
    const totalTpv = Number(closing.total_tpv ?? 0);
    const totalCard = Number(closing.total_card ?? 0);
    const withdrawals = Number(closing.withdrawals_amount ?? 0);
    const counted = Number(closing.counted_cash ?? 0);

    const cashSales = totalTpv - totalCard;
    const expectedCash = cashSales - withdrawals;
    return counted - expectedCash;
  };

  const getLiveExpectedCash = (closing: ClosingRow) => {
    const totalTpv = Number(closing.total_tpv ?? 0);
    const totalCard = Number(closing.total_card ?? 0);
    const withdrawals = Number(closing.withdrawals_amount ?? 0);

    const cashSales = totalTpv - totalCard;
    return cashSales - withdrawals;
  };

  const getLiveStatus = (closing: ClosingRow) => {
    const difference = getLiveDifference(closing);
    return Math.abs(difference) < 0.01 ? "ok" : "alert";
  };

  const filteredClosings = useMemo(() => {
    return closings.filter((c) => {
      if (filterStore !== "all" && c.store_id !== Number(filterStore)) {
        return false;
      }

      if (
        filterRegister !== "all" &&
        c.register_number !== Number(filterRegister)
      ) {
        return false;
      }

      if (filterDate && c.closing_date !== filterDate) {
        return false;
      }

      return true;
    });
  }, [closings, filterStore, filterRegister, filterDate]);

  const liveAlerts = useMemo(() => {
    const base = closings
      .filter((c) => {
        if (filterStore !== "all" && c.store_id !== Number(filterStore)) {
          return false;
        }

        if (
          filterRegister !== "all" &&
          c.register_number !== Number(filterRegister)
        ) {
          return false;
        }

        if (filterDate && c.closing_date !== filterDate) {
          return false;
        }

        return true;
      })
      .map((closing) => {
        const liveDifference = getLiveDifference(closing);
        const absDiff = Math.abs(liveDifference);

        if (absDiff < 0.01) return null;

        const level: "low" | "medium" | "high" =
          absDiff >= 20 ? "high" : absDiff >= 10 ? "medium" : "low";

        return {
          id: `live-${closing.id}`,
          created_at: closing.created_at,
          store_id: closing.store_id,
          register_number: closing.register_number,
          level,
          message: `Descuadre de ${liveDifference.toFixed(2)} € en cierre del ${
            closing.closing_date
          } · ${getRegisterLabel(closing.register_number)}`,
        } as LiveAlertRow;
      })
      .filter(Boolean) as LiveAlertRow[];

    return base.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [closings, filterStore, filterRegister, filterDate]);

  const filteredQuickRecords = useMemo(() => {
    return quickRecords.filter((r) => {
      if (filterStore !== "all" && r.store_id !== Number(filterStore)) {
        return false;
      }

      if (
        filterRegister !== "all" &&
        r.register_number !== Number(filterRegister)
      ) {
        return false;
      }

      if (filterDate) {
        const recordDate = new Date(r.created_at).toISOString().slice(0, 10);
        if (recordDate !== filterDate) {
          return false;
        }
      }

      return true;
    });
  }, [quickRecords, filterStore, filterRegister, filterDate]);

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-100">
        <p className="text-2xl font-bold">Cargando...</p>
      </main>
    );
  }

  if (user.role === "manager") {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow">
            <h1 className="text-4xl font-black">Hola, {user.full_name}</h1>
            <p className="mt-2 text-xl text-neutral-700">
              Tienda: {getStoreName(user.store_id)}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <a
              href="/registro"
              className="rounded-3xl bg-white p-8 text-3xl font-black shadow"
            >
              Registro rápido
            </a>

            <a
              href="/cierre"
              className="rounded-3xl bg-white p-8 text-3xl font-black shadow"
            >
              Cierre diario
            </a>
          </div>

          <button
            onClick={handleLogout}
            className="h-16 rounded-2xl bg-black px-8 text-xl font-black text-white"
          >
            Salir
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow">
          <h1 className="text-4xl font-black">Panel del dueño</h1>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow space-y-4">
          <h2 className="text-2xl font-black">Filtros</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <select
              className="h-14 rounded-2xl border px-4 text-xl"
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
            >
              <option value="all">Todas las tiendas</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>

            <select
              className="h-14 rounded-2xl border px-4 text-xl"
              value={filterRegister}
              onChange={(e) => setFilterRegister(e.target.value)}
            >
              <option value="all">Todas las cajas</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  Caja {n}
                </option>
              ))}
            </select>

            <input
              type="date"
              className="h-14 rounded-2xl border px-4 text-xl"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow">
          <h2 className="mb-4 text-3xl font-black">Alertas</h2>
          <p className="mb-4 text-sm text-neutral-500">
            Estas alertas se calculan en vivo con la fórmula correcta del cierre.
          </p>

          {loading ? (
            <p className="text-xl font-bold">Cargando alertas...</p>
          ) : liveAlerts.length === 0 ? (
            <p className="text-xl font-bold">No hay alertas</p>
          ) : (
            <div className="space-y-3">
              {liveAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-2xl border border-neutral-200 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xl font-black">
                        {getStoreName(alert.store_id)}
                      </p>
                      <p className="mt-1 text-lg text-neutral-700">
                        {alert.message}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {formatDateTime(alert.created_at)}
                      </p>
                    </div>

                    <div
                      className={`rounded-2xl px-4 py-2 text-lg font-black ${getAlertColor(
                        alert.level
                      )}`}
                    >
                      {alert.level === "high"
                        ? "ALTA"
                        : alert.level === "medium"
                        ? "MEDIA"
                        : "BAJA"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow overflow-auto">
          <h2 className="mb-4 text-3xl font-black">Todos los cierres</h2>

          {loading ? (
            <p className="text-xl font-bold">Cargando cierres...</p>
          ) : filteredClosings.length === 0 ? (
            <p className="text-xl font-bold">No hay cierres registrados</p>
          ) : (
            <table className="w-full min-w-[1400px] text-left">
              <thead>
                <tr className="border-b text-xl font-bold">
                  <th className="p-3 whitespace-nowrap">Fecha cierre</th>
                  <th className="p-3 whitespace-nowrap">Hora guardado</th>
                  <th className="p-3 whitespace-nowrap">Tienda</th>
                  <th className="p-3 whitespace-nowrap">Caja</th>
                  <th className="p-3 whitespace-nowrap">TPV</th>
                  <th className="p-3 whitespace-nowrap">Tarjeta</th>
                  <th className="p-3 whitespace-nowrap">Retiradas</th>
                  <th className="p-3 whitespace-nowrap">Pico</th>
                  <th className="p-3 whitespace-nowrap">Contado</th>
                  <th className="p-3 whitespace-nowrap">Debería haber</th>
                  <th className="p-3 whitespace-nowrap">Diferencia</th>
                  <th className="p-3 whitespace-nowrap">Estado</th>
                  <th className="p-3 whitespace-nowrap">Modificado</th>
                  <th className="p-3 whitespace-nowrap">Última modificación</th>
                </tr>
              </thead>
              <tbody>
                {filteredClosings.map((c) => {
                  const liveDifference = getLiveDifference(c);
                  const liveExpectedCash = getLiveExpectedCash(c);
                  const liveStatus = getLiveStatus(c);

                  return (
                    <tr key={c.id} className="border-b text-lg">
                      <td className="p-3 whitespace-nowrap">{c.closing_date}</td>
                      <td className="p-3 whitespace-nowrap">
                        {formatDateTime(c.created_at)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {getStoreName(c.store_id)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {getRegisterLabel(c.register_number)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {Number(c.total_tpv ?? 0).toFixed(2)} €
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {Number(c.total_card ?? 0).toFixed(2)} €
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {Number(c.withdrawals_amount ?? 0).toFixed(2)} €
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {Number(c.peak_amount ?? 0).toFixed(2)} €
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {Number(c.counted_cash).toFixed(2)} €
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {Number(liveExpectedCash).toFixed(2)} €
                      </td>
                      <td
                        className={`p-3 whitespace-nowrap font-bold ${
                          Math.abs(Number(liveDifference)) < 0.01
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {Number(liveDifference).toFixed(2)} €
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {liveStatus === "ok" ? "OK" : "ALERTA"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {(c.edit_count ?? 0) > 0 ? "Sí" : "No"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {c.last_edited_at
                          ? formatDateTime(c.last_edited_at)
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow overflow-auto">
          <h2 className="mb-4 text-3xl font-black">Registros rápidos</h2>

          {loading ? (
            <p className="text-xl font-bold">Cargando registros...</p>
          ) : filteredQuickRecords.length === 0 ? (
            <p className="text-xl font-bold">No hay registros rápidos</p>
          ) : (
            <table className="w-full min-w-[1300px] text-left">
              <thead>
                <tr className="border-b text-xl font-bold">
                  <th className="p-3 whitespace-nowrap">Fecha y hora</th>
                  <th className="p-3 whitespace-nowrap">Tienda</th>
                  <th className="p-3 whitespace-nowrap">Tipo</th>
                  <th className="p-3 whitespace-nowrap">Caja</th>
                  <th className="p-3 whitespace-nowrap">Empleado</th>
                  <th className="p-3 whitespace-nowrap">Importe</th>
                  <th className="p-3 whitespace-nowrap">Nº sobre</th>
                  <th className="p-3 whitespace-nowrap">Comentario</th>
                  <th className="p-3 whitespace-nowrap">Foto</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuickRecords.map((record) => (
                  <tr key={record.id} className="border-b text-lg">
                    <td className="p-3 whitespace-nowrap">
                      {formatDateTime(record.created_at)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {getStoreName(record.store_id)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {getQuickRecordTypeLabel(record)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {getRegisterLabel(record.register_number)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {record.employee_name}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {Number(record.amount).toFixed(2)} €
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {record.envelope_number || "-"}
                    </td>
                    <td className="p-3">{record.reason || "-"}</td>
                    <td className="p-3 whitespace-nowrap">
                      {record.envelope_photo_url ? (
                        <a
                          href={record.envelope_photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-blue-600 underline"
                        >
                          Ver foto
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="h-16 rounded-2xl bg-black px-8 text-xl font-black text-white"
        >
          Salir
        </button>
      </div>
    </main>
  );
}