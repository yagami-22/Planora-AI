import OpenAI from "openai";

export async function POST(req) {
  try {
    const body = await req.json();
    const { subjects, hoursPerDay } = body;

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OpenAI API key is missing" },
        { status: 500 }
      );
    }

    if (!subjects || subjects.length === 0) {
      return Response.json(
        { error: "No subjects provided" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
Create a 7-day smart study timetable.

Subjects data:
${JSON.stringify(subjects, null, 2)}

Daily available hours: ${hoursPerDay || "Use subject-wise daily hours if available"}

Rules:
- Focus more on weak subjects.
- Give more time to low-progress subjects.
- Consider exam dates.
- Include revision slots.
- Return ONLY clean readable day-wise timetable.
- Do not add extra explanation.
`;

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
    });

    return Response.json({
      timetable: response.output_text,
    });
  } catch (error) {
    console.error("AI timetable error:", error);

    return Response.json(
      { error: error.message || "AI timetable generation failed" },
      { status: 500 }
    );
  }
}