declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

// @ts-expect-error: Deno/Supabase Edge Runtime import specifier
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async () => {
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase environment variables." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const { data: sheets, error: fetchError } = await supabase
    .from("attendance_sheets")
    .select("id")
    .eq("status", "APPROVED")
    .lt("date", cutoffDate.toISOString().slice(0, 10));

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!sheets?.length) {
    return new Response(JSON.stringify({ deletedSheets: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const sheetIds = sheets.map((sheet: { id: string }) => sheet.id);
  const { error: deleteError } = await supabase.from("attendance_sheets").delete().in("id", sheetIds);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ deletedSheets: sheetIds.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
