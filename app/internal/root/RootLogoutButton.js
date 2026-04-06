"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RootLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/internal/root/auth/logout", { method: "POST", credentials: "include" });
      router.push("/internal/root-login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="rounded-lg px-1 py-0.5 text-white/90 underline-offset-2 hover:bg-white/15 hover:text-white hover:underline disabled:opacity-50"
    >
      Abmelden
    </button>
  );
}
