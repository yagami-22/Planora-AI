import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

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
    } = body;

    if (!user_id || !subject_id || !subject_name || !started_at || !ended_at) {
      return NextResponse.json(
        { error: "Missing required timer data" },
        { status: 400 }
      );
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
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Timer save error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Timer API error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}