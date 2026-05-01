import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: "AI timetable API disabled",
  }, { status: 500 });
}