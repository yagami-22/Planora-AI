export async function POST() {
    return Response.json(
      {
        error: "API disabled",
      },
      { status: 500 }
    );
  }