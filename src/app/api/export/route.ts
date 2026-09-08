import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("promises")
    .select("category, promise_text, extracted_value, risk_flag, risk_reason, created_at, conversations(created_at)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const header = [
    "conversation_date",
    "category",
    "promise_text",
    "extracted_value",
    "risk_flag",
    "risk_reason",
  ];

  const rows = data.map((p) => {
    const conversation = p.conversations as unknown as { created_at: string } | null;
    return [
      conversation?.created_at ?? p.created_at,
      p.category,
      p.promise_text,
      p.extracted_value ?? "",
      p.risk_flag ? "true" : "false",
      p.risk_reason ?? "",
    ]
      .map((v) => csvEscape(String(v)))
      .join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pactly-audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
