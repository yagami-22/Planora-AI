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
You are an expert AI study planner.

Create a detailed weekly timetable based on:
Subjects: ${subjects
      .map(
        (s) =>
          `${s.name} (priority: ${s.priority}, exam in ${s.daysLeft} days, progress: ${s.progress}%)`
      )
      .join(", ")}
Daily available hours: ${hoursPerDay}

Rules:
- Give DIFFERENT study strategies. Do not repeat the same task every day.
- Mix Concept Study, Practice Problems, Revision, Mock Tests, Previous Year Questions, and Weak Topic Recovery.
- Prioritize subjects with lower progress, higher priority, and closer exam dates.
- Include realistic time splits like 2h theory + 1h practice + 1h revision.
- Add variety across Monday to Sunday.
- Include at least one light revision/rest-focused day.
- Make it look like a smart human-made plan.

Output format exactly like this:

Monday:
Subject:
Study Type:
Time Allocation:
Reason:
AI Score:

Tuesday:
Subject:
Study Type:
Time Allocation:
Reason:
AI Score:

Wednesday:
Subject:
Study Type:
Time Allocation:
Reason:
AI Score:

Thursday:
Subject:
Study Type:
Time Allocation:
Reason:
AI Score:

Friday:
Subject:
Study Type:
Time Allocation:
Reason:
AI Score:

Saturday:
Subject:
Study Type:
Time Allocation:
Reason:
AI Score:

Sunday:
Subject:
Study Type:
Time Allocation:
Reason:
AI Score:
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
      { error: error?.message || "AI timetable generation failed" },
      { status: 500 }
    );
  }
}