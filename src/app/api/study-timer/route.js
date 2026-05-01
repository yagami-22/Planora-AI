import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const body = await req.json();

    const {
      user_id,
      subject_id,
      subject_name,
      started_at,
      ended_at,
      actual_minutes,
      actual_seconds,
    } = body;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "User not authenticated" }, { status: 401 });
    }

    if (user.id !== user_id) {
      return Response.json({ error: "User mismatch" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("study_timer_sessions")
      .insert([
        {
          user_id,
          subject_id,
          subject_name,
          started_at,
          ended_at,
          actual_minutes,
          actual_seconds,
        },
      ])
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}