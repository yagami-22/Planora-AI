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
      planned_minutes,
      status,
    } = body;

    // 🔴 Strict validation
    if (!user_id || !subject_id || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const allowedStatuses = ["pending", "in_progress", "completed", "skipped"];

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase
      .from("study_sessions")
      .upsert(
        [
          {
            user_id,
            subject_id,
            subject_name: subject_name || "",
            planned_minutes: planned_minutes || 0,
            status,
            session_date: today,
            updated_at: new Date().toISOString(),
          },
        ],
        {
          onConflict: "user_id,subject_id,session_date",
        }
      );

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Session updated successfully",
    });

  } catch (err) {
    console.error("Server error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}