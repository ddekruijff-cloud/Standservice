"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

// Ververst de pagina zodra er een opdracht of opmerking bijkomt of verandert.
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const channel = supabase
      .channel("opdrachten")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_events" }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
