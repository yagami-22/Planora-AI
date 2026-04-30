"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [subjects, setSubjects] = useState([]);
  const [subjectName, setSubjectName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [progress, setProgress] = useState("");
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function getSession() {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    }

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSubjects(user.id);
      fetchTimetable(user.id);
    } else {
      setSubjects([]);
      setTimetable([]);
    }
  }, [user]);

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);
    alert("Signup successful. Now login.");
    setAuthMode("login");
  }

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return alert(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function fetchSubjects(userId) {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: true });

    if (error) return alert("Failed to fetch subjects");
    setSubjects(data || []);
  }

  async function fetchTimetable(userId) {
    const { data, error } = await supabase
      .from("timetables")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) return console.error(error);
    if (data?.length > 0) setTimetable(data[0].plan || []);
  }

  async function addSubject() {
    if (!subjectName || !examDate || !dailyHours || !progress) {
      return alert("Fill all fields");
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("subjects")
      .insert([
        {
          subject_name: subjectName,
          exam_date: examDate,
          daily_hours: Number(dailyHours),
          priority,
          progress: Number(progress),
          user_id: user.id,
        },
      ])
      .select();

    setLoading(false);

    if (error) return alert("Failed to save subject");

    setSubjects([...subjects, data[0]]);
    setSubjectName("");
    setExamDate("");
    setDailyHours("");
    setPriority("Medium");
    setProgress("");
  }

  async function deleteSubject(id) {
    const { error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return alert("Delete failed");
    setSubjects(subjects.filter((s) => s.id !== id));
  }

  async function clearAllData() {
    await supabase.from("subjects").delete().eq("user_id", user.id);
    await supabase.from("timetables").delete().eq("user_id", user.id);
    setSubjects([]);
    setTimetable([]);
  }

  async function generateTimetable() {
    if (subjects.length === 0) return alert("Add subjects first");

    setLoading(true);

    try {
      const today = new Date();

      const scored = subjects.map((s) => {
        const exam = new Date(s.exam_date);
        const daysLeft = Math.max(
          1,
          Math.ceil((exam - today) / (1000 * 60 * 60 * 24))
        );

        const urgencyScore = Math.max(0, 100 - daysLeft);
        const weaknessScore = 100 - Number(s.progress);
        const priorityScore =
          s.priority === "High" ? 40 : s.priority === "Medium" ? 20 : 10;

        return {
          ...s,
          daysLeft,
          aiScore: urgencyScore + weaknessScore + priorityScore,
        };
      });

      const sorted = [...scored].sort((a, b) => b.aiScore - a.aiScore);

      const days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];

      const plan = days.map((day, index) => {
        const s = sorted[index % sorted.length];

        let studyType = "Concept Study + Practice";

        if (s.progress < 35) studyType = "Weak Topic Recovery";
        else if (s.daysLeft <= 5) studyType = "Revision + PYQs";
        else if (s.priority === "High") studyType = "High Priority Practice";
        else if (s.progress >= 70) studyType = "Quick Revision + Test";

        return {
          day,
          subject: s.subject_name,
          studyType,
          timeAllocation: `${s.daily_hours} hour(s)`,
          reason: `${s.subject_name} selected because progress is ${s.progress}%, priority is ${s.priority}, and exam is in ${s.daysLeft} days.`,
          aiScore: s.aiScore,
        };
      });

      await supabase.from("timetables").delete().eq("user_id", user.id);

      const { error } = await supabase.from("timetables").insert([
        {
          user_id: user.id,
          plan,
        },
      ]);

      if (error) return alert("Failed to save timetable");

      setTimetable(plan);
    } catch (error) {
      console.error("Timetable error:", error);
      alert("Something went wrong while generating timetable");
    } finally {
      setLoading(false);
    }
  }

  function exportPDF() {
    window.print();
  }

  const weakSubjects = subjects.filter(
    (s) => s.priority === "High" || s.progress < 40
  );

  const averageProgress =
    subjects.length === 0
      ? 0
      : Math.round(
          subjects.reduce((sum, s) => sum + s.progress, 0) / subjects.length
        );

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md border border-zinc-800">
          <h1 className="text-4xl font-bold text-center mb-2">
            Planora <span className="text-purple-500">AI</span>
          </h1>

          <p className="text-gray-400 text-center mb-6">
            {authMode === "login" ? "Login to continue" : "Create account"}
          </p>

          <input
            className="w-full p-3 mb-3 bg-black border border-zinc-700 rounded-xl"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full p-3 mb-4 bg-black border border-zinc-700 rounded-xl"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={authMode === "login" ? login : signUp}
            className="w-full bg-purple-600 p-3 rounded-xl font-semibold"
          >
            {authMode === "login" ? "Login" : "Sign Up"}
          </button>

          <button
            onClick={() =>
              setAuthMode(authMode === "login" ? "signup" : "login")
            }
            className="w-full mt-4 text-purple-400"
          >
            {authMode === "login"
              ? "New user? Create account"
              : "Already have account? Login"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #pdf-section, #pdf-section * { visibility: visible; }
          #pdf-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
            padding: 30px;
          }
        }
      `}</style>

      <section className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-5xl font-bold">
              Planora <span className="text-purple-500">AI</span>
            </h1>
            <p className="text-gray-400 mt-2">Logged in as {user.email}</p>
          </div>

          <button onClick={logout} className="bg-red-600 px-5 py-2 rounded-xl">
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
            <h2 className="text-2xl font-semibold mb-5">Add Study Details</h2>

            <input
              className="w-full p-3 mb-3 bg-black border border-zinc-700 rounded-xl"
              placeholder="Subject name"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
            />

            <input
              type="date"
              className="w-full p-3 mb-3 bg-black border border-zinc-700 rounded-xl"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />

            <input
              type="number"
              className="w-full p-3 mb-3 bg-black border border-zinc-700 rounded-xl"
              placeholder="Daily free hours"
              value={dailyHours}
              onChange={(e) => setDailyHours(e.target.value)}
            />

            <input
              type="number"
              className="w-full p-3 mb-3 bg-black border border-zinc-700 rounded-xl"
              placeholder="Progress %"
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
            />

            <select
              className="w-full p-3 mb-3 bg-black border border-zinc-700 rounded-xl"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>

            <button
              onClick={addSubject}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 p-3 rounded-xl font-semibold mb-3 disabled:opacity-60"
            >
              {loading ? "Saving..." : "Add Subject"}
            </button>

            <button
              onClick={generateTimetable}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-200 text-black p-3 rounded-xl font-semibold mb-3 disabled:opacity-60"
            >
              {loading
                ? "Generating AI Timetable..."
                : "Generate & Save AI Timetable"}
            </button>

            <button
              onClick={exportPDF}
              className="w-full bg-green-500 hover:bg-green-400 text-black p-3 rounded-xl font-semibold mb-3"
            >
              Export Timetable as PDF
            </button>

            <button
              onClick={clearAllData}
              className="w-full bg-red-600 hover:bg-red-700 p-3 rounded-xl font-semibold"
            >
              Clear All Data
            </button>
          </div>

          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
            <h2 className="text-2xl font-semibold mb-5">Dashboard Overview</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-black p-4 rounded-xl">
                <p className="text-gray-400">Total Subjects</p>
                <h3 className="text-3xl font-bold">{subjects.length}</h3>
              </div>

              <div className="bg-black p-4 rounded-xl">
                <p className="text-gray-400">Weak Subjects</p>
                <h3 className="text-3xl font-bold text-red-400">
                  {weakSubjects.length}
                </h3>
              </div>

              <div className="bg-black p-4 rounded-xl">
                <p className="text-gray-400">Average Progress</p>
                <h3 className="text-3xl font-bold text-green-400">
                  {averageProgress}%
                </h3>
              </div>
            </div>

            <h3 className="text-xl font-semibold mb-3">Subjects</h3>

            {subjects.length === 0 ? (
              <p className="text-gray-500">No subjects added yet.</p>
            ) : (
              <div className="space-y-3">
                {subjects.map((s) => (
                  <div
                    key={s.id}
                    className="bg-black p-4 rounded-xl flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-semibold">{s.subject_name}</h4>
                      <p className="text-sm text-gray-400">
                        Exam Date: {s.exam_date}
                      </p>
                    </div>

                    <div className="flex gap-4 items-center">
                      <span>{s.progress}%</span>
                      <span className="bg-purple-600 px-3 py-1 rounded-full text-sm">
                        {s.priority}
                      </span>
                      <button
                        onClick={() => deleteSubject(s.id)}
                        className="bg-red-600 px-3 py-1 rounded-lg text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          id="pdf-section"
          className="mt-6 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"
        >
          <h2 className="text-2xl font-semibold mb-5">Saved AI Timetable</h2>

          {timetable.length === 0 ? (
            <p className="text-gray-500">No timetable generated yet.</p>
          ) : (
            timetable.map((item, index) => (
              <div
                key={index}
                className="bg-black p-5 rounded-xl mb-4 border border-zinc-800"
              >
                <h3 className="font-bold text-purple-400 text-lg mb-2">
                  {item.day}
                </h3>

                <p className="text-white font-semibold">
                  Subject:{" "}
                  <span className="font-normal">{item.subject}</span>
                </p>

                <p className="text-gray-300">
                  Study Type:{" "}
                  <span className="text-gray-400">
                    {item.studyType || "AI Planned Study"}
                  </span>
                </p>

                <p className="text-gray-300">
                  Time Allocation:{" "}
                  <span className="text-gray-400">
                    {item.timeAllocation || "Flexible"}
                  </span>
                </p>

                <p className="text-gray-300">
                  Reason:{" "}
                  <span className="text-gray-400">
                    {item.reason ||
                      "Based on priority, progress, and exam date."}
                  </span>
                </p>

                <p className="text-sm mt-2">
                  AI Score:
                  <span className="ml-2 px-2 py-1 rounded bg-green-900 text-green-400">
                    {item.aiScore || "N/A"}
                  </span>
                </p>
              </div>
            ))
          )}
        </div>

        {timetable.length > 0 && (
          <div className="mt-6 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <h2 className="text-xl font-semibold mb-2 text-blue-400">
              Why this timetable?
            </h2>

            <p className="text-gray-300">
              This free AI-style planner prioritizes subjects with lower
              progress, higher priority, and closer exam dates. It mixes concept
              study, practice, revision, and weak-topic recovery so the student
              can improve without burning out.
            </p>
          </div>
        )}

        <div className="mt-6 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
          <h2 className="text-2xl font-semibold mb-5 text-red-400">
            Weak Subject Analysis
          </h2>

          {weakSubjects.length === 0 ? (
            <p className="text-gray-500">No weak subjects detected.</p>
          ) : (
            weakSubjects.map((s) => (
              <div
                key={s.id}
                className="bg-black border border-red-900 p-4 rounded-xl mb-3"
              >
                <h3 className="font-bold text-red-400">{s.subject_name}</h3>
                <p className="text-gray-400">
                  Needs extra focus because priority is {s.priority} and
                  progress is {s.progress}%.
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}