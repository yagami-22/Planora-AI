import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      user_id,
      subject_id,
      subject_name,
      planned_minutes,
      status,
    } = body;

    if (!user_id || !subject_id || !subject_name || !status) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const allowedStatuses = ["pending", "in_progress", "completed", "skipped"];

    if (!allowedStatuses.includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];
    const isCompleted = status === "completed";

    const { data, error } = await supabase
      .from("study_sessions")
      .upsert(
        {
          user_id,
          subject_id,
          subject_name,
          planned_minutes: planned_minutes || 60,
          completed_minutes: isCompleted ? planned_minutes || 60 : 0,
          is_completed: isCompleted,
          status,
          session_date: today,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,subject_id,session_date",
        }
      )
      .select();

    if (error) {
      console.error(error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: `Plan marked as ${status}`,
      data,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}