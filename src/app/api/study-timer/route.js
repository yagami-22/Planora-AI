import { NextResponse } from "next/server";
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
      started_at,
      ended_at,
      actual_minutes,
      actual_seconds,
    } = body;

    if (!user_id || !subject_id || !started_at || !ended_at) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { error: timerError } = await supabase
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
      ]);

    if (timerError) {
      return NextResponse.json(
        { error: timerError.message },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        is_studying: false,
        last_active: new Date().toISOString(),
      })
      .eq("id", user_id);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}