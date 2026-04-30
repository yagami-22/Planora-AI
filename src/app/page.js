"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

        const urgencyScore = Math.max(0, 100 - Math.min(daysLeft, 100));
        const weaknessScore = 100 - Number(s.progress);
        const priorityScore =
          s.priority === "High" ? 30 : s.priority === "Medium" ? 18 : 8;

        const aiScore = Math.min(
          100,
          Math.round(urgencyScore * 0.35 + weaknessScore * 0.45 + priorityScore)
        );

        return {
          ...s,
          daysLeft,
          aiScore,
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
        const hours = Number(s.daily_hours) || 2;

        let studyType = "Concept Study + Practice";
        let timeAllocation = `${Math.max(1, hours - 1)}h concept + 1h practice`;

        if (s.progress < 35) {
          studyType = "Weak Topic Recovery + Basics";
          timeAllocation = `${Math.max(1, hours - 1)}h basics + 1h practice`;
        } else if (s.daysLeft <= 5) {
          studyType = "Revision + PYQs";
          timeAllocation = `${Math.max(1, hours - 1)}h revision + 1h PYQs`;
        } else if (s.priority === "High") {
          studyType = "High Priority Practice";
          timeAllocation = `${Math.max(1, hours - 1)}h practice + 1h recap`;
        } else if (s.progress >= 70) {
          studyType = "Quick Revision + Self Test";
          timeAllocation = `${Math.max(1, hours - 1)}h revision + 1h test`;
        }

        if (day === "Sunday") {
          studyType = "Light Revision + Weekly Recap";
          timeAllocation = `${Math.max(1, hours - 1)}h recap + 1h planning`;
        }

        return {
          day,
          subject: s.subject_name,
          studyType,
          timeAllocation,
          reason: `${s.subject_name} was selected because progress is ${s.progress}%, priority is ${s.priority}, and exam is in ${s.daysLeft} days.`,
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

  const weakSubjects = subjects.filter(
    (s) => s.priority === "High" || Number(s.progress) < 40
  );

  const averageProgress =
    subjects.length === 0
      ? 0
      : Math.round(
          subjects.reduce((sum, s) => sum + Number(s.progress), 0) /
            subjects.length
        );

  function exportPDF() {
    const doc = new jsPDF("p", "mm", "a4");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const strongestSubject =
      subjects.length > 0
        ? [...subjects].sort(
            (a, b) => Number(b.progress) - Number(a.progress)
          )[0]?.subject_name
        : "N/A";

    const weakestSubject =
      subjects.length > 0
        ? [...subjects].sort(
            (a, b) => Number(a.progress) - Number(b.progress)
          )[0]?.subject_name
        : "N/A";

    function addHeader(title) {
      doc.setFillColor(88, 28, 135);
      doc.rect(0, 0, pageWidth, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Planora AI", 14, 13);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("AI Powered Study Planner Report", 14, 20);

      doc.setFontSize(12);
      doc.text(title, pageWidth - 14, 17, { align: "right" });

      doc.setTextColor(0, 0, 0);
    }

    function addFooter() {
      const pages = doc.internal.getNumberOfPages();

      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(
          `Generated by Planora AI | Page ${i} of ${pages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      doc.setTextColor(0, 0, 0);
    }

    addHeader("Study Report");

    doc.setFontSize(11);
    doc.setTextColor(70);
    doc.text(`Student Email: ${user?.email || "N/A"}`, 14, 38);
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 14, 45);

    doc.setTextColor(0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Dashboard Summary", 14, 60);

    autoTable(doc, {
      startY: 66,
      head: [["Metric", "Value"]],
      body: [
        ["Total Subjects", subjects.length],
        ["Weak Subjects", weakSubjects.length],
        ["Average Progress", `${averageProgress}%`],
        ["Weakest Subject", weakestSubject],
        ["Strongest Subject", strongestSubject],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [88, 28, 135],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
    });

    let y = doc.lastAutoTable.finalY + 12;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Subjects Overview", 14, y);

    autoTable(doc, {
      startY: y + 6,
      head: [["Subject", "Exam Date", "Daily Hours", "Priority", "Progress"]],
      body:
        subjects.length > 0
          ? subjects.map((s) => [
              s.subject_name,
              s.exam_date,
              `${s.daily_hours} hrs`,
              s.priority,
              `${s.progress}%`,
            ])
          : [["No subjects added", "-", "-", "-", "-"]],
      theme: "striped",
      headStyles: {
        fillColor: [126, 34, 206],
        textColor: [255, 255, 255],
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
    });

    y = doc.lastAutoTable.finalY + 12;

    if (y > 235) {
      doc.addPage();
      addHeader("Timetable");
      y = 40;
    }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Saved AI Timetable", 14, y);

    autoTable(doc, {
      startY: y + 6,
      head: [["Day", "Subject", "Study Type", "Time", "AI Score"]],
      body:
        timetable.length > 0
          ? timetable.map((item) => [
              item.day,
              item.subject,
              item.studyType || "AI Planned Study",
              item.timeAllocation || "Flexible",
              item.aiScore || "N/A",
            ])
          : [["No timetable generated", "-", "-", "-", "-"]],
      theme: "grid",
      headStyles: {
        fillColor: [21, 128, 61],
        textColor: [255, 255, 255],
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
      },
    });

    y = doc.lastAutoTable.finalY + 12;

    if (y > 220) {
      doc.addPage();
      addHeader("Strategy");
      y = 40;
    }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("AI Study Strategy", 14, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const strategyText = `Based on your current data, your main focus should be weak topic recovery. Give more time to low-progress and high-priority subjects first. Use medium-progress subjects for regular revision, and use strong subjects for quick tests instead of long theory sessions. Your weakest subject is ${weakestSubject}, so it should get the first study slot whenever exams are near.`;

    doc.text(doc.splitTextToSize(strategyText, 180), 14, y + 8);

    y += 38;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Weak Subject Analysis", 14, y);

    autoTable(doc, {
      startY: y + 6,
      head: [["Weak Subject", "Priority", "Progress", "Suggestion"]],
      body:
        weakSubjects.length > 0
          ? weakSubjects.map((s) => [
              s.subject_name,
              s.priority,
              `${s.progress}%`,
              "Give extra revision and practice time",
            ])
          : [
              [
                "No weak subjects detected",
                "-",
                "-",
                "Current progress looks good",
              ],
            ],
      theme: "striped",
      headStyles: {
        fillColor: [185, 28, 28],
        textColor: [255, 255, 255],
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
    });

    y = doc.lastAutoTable.finalY + 12;

    if (timetable.length > 0) {
      if (y > 220) {
        doc.addPage();
        addHeader("Reasoning");
        y = 40;
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Timetable Reasoning", 14, y);

      autoTable(doc, {
        startY: y + 6,
        head: [["Day", "Reason"]],
        body: timetable.map((item) => [
          item.day,
          item.reason || "Based on priority, progress, and exam date.",
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: [255, 255, 255],
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 155 },
        },
      });
    }

    addFooter();
    doc.save("Planora_AI_Study_Report.pdf");
  }

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
              Export Premium PDF Report
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

                      <p className="text-sm text-gray-400 mb-2">
                        Exam Date: {s.exam_date}
                      </p>

                      <div className="w-64 bg-zinc-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            s.progress < 40
                              ? "bg-red-500"
                              : s.progress < 70
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${s.progress}%` }}
                        ></div>
                      </div>
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

        <div className="mt-6 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
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
                  Subject: <span className="font-normal">{item.subject}</span>
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
      </section>
    </main>
  );
}