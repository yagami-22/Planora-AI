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

    // ✅ Validation
    if (!user_id || !subject_id || !started_at || !ended_at) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("study_timer_sessions").insert([
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

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}