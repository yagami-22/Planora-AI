export async function POST() {
    return Response.json({
      error: "AI timetable API disabled",
    }, { status: 500 });
  }