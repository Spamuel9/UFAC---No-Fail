const TOKEN_KEY = "noFailAuthToken";

const appState = {
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  activePlan: null,
  archives: [],
};

const authSection = document.getElementById("authSection");
const dashboard = document.getElementById("dashboard");
const welcomeMessage = document.getElementById("welcomeMessage");
const mainPanel = document.getElementById("mainPanel");
const planCreatorPanel = document.getElementById("planCreatorPanel");
const archivePanel = document.getElementById("archivePanel");
const archiveList = document.getElementById("archiveList");
const celebrationBanner = document.getElementById("celebrationBanner");
const logoutBtn = document.getElementById("logoutBtn");

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function daysBetween(startISO, endISO) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

async function api(path, method = "GET", body = null) {
  const headers = { "Content-Type": "application/json" };
  if (appState.token) headers.Authorization = `Bearer ${appState.token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function weeklyFocusTasks(weekIndex, baselineRunMinutes) {
  const build = Math.max(0, weekIndex - 1);
  return [
    { title: `Run/Walk ${baselineRunMinutes + build * 2} min + mobility`, type: "Endurance" },
    { title: `Speed intervals ${Math.max(12, baselineRunMinutes + build)} min total`, type: "Speed" },
    { title: `Steady run ${baselineRunMinutes + build * 3} min`, type: "Stamina" },
    { title: "Strength + optional easy jog", type: "Strength" },
  ];
}

function generatePlan(input) {
  const startDate = todayISO();
  const totalWeeks = Math.max(1, Math.ceil(Math.max(1, daysBetween(startDate, input.testDate)) / 7));
  const baseline = Number(input.currentRunMinutes);
  const tasks = [];

  for (let week = 1; week <= totalWeeks; week += 1) {
    weeklyFocusTasks(week, baseline).forEach((task, idx) => {
      tasks.push({ id: `${week}-${idx + 1}`, week, title: task.title, type: task.type, completed: false });
    });
  }

  return {
    createdAt: new Date().toISOString(),
    startDate,
    testDate: input.testDate,
    goalTime: input.goalTime,
    currentRunMinutes: baseline,
    notes: input.notes,
    skipAllowancePerWeek: 3,
    skipByWeek: {},
    tasks,
  };
}

function getPlanDayPointer(plan) {
  return plan.tasks.filter((t) => t.completed).length;
}

function archiveIfFinished() {
  const plan = appState.activePlan;
  if (!plan) return;

  const allDone = plan.tasks.every((t) => t.completed);
  const daysLeft = daysBetween(todayISO(), plan.testDate);
  if (!allDone || daysLeft > 0) return;

  appState.archives.unshift({
    finishedAt: new Date().toISOString(),
    summary: {
      startDate: plan.startDate,
      testDate: plan.testDate,
      totalTasks: plan.tasks.length,
      completedTasks: plan.tasks.filter((t) => t.completed).length,
      goalTime: plan.goalTime,
    },
  });
  appState.activePlan = null;
}

async function persistPlan() {
  await api("/api/plan", "PUT", {
    activePlan: appState.activePlan,
    archives: appState.archives,
  });
}

function renderAuth() {
  authSection.innerHTML = `
    <h2>Login</h2>
    <form id="loginForm">
      <label>Username <input name="username" required /></label>
      <label>Password <input type="password" name="password" required /></label>
      <button type="submit">Login</button>
    </form>
    <p class="muted">Need an account? Create one below.</p>
    <hr />
    <h3>Create Account</h3>
    <form id="signupForm">
      <label>Name <input name="name" required /></label>
      <label>Username <input name="username" required /></label>
      <label>Password <input type="password" name="password" required minlength="6" /></label>
      <button type="submit">Create Account</button>
    </form>
  `;

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const result = await api("/api/auth/login", "POST", {
        username: String(fd.get("username") || "").trim(),
        password: String(fd.get("password") || ""),
      });
      appState.token = result.token;
      appState.user = result.user;
      localStorage.setItem(TOKEN_KEY, appState.token);
      await hydrateUserData();
      render();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const result = await api("/api/auth/signup", "POST", {
        name: String(fd.get("name") || "").trim(),
        username: String(fd.get("username") || "").trim(),
        password: String(fd.get("password") || ""),
      });
      appState.token = result.token;
      appState.user = result.user;
      appState.activePlan = null;
      appState.archives = [];
      localStorage.setItem(TOKEN_KEY, appState.token);
      render();
    } catch (err) {
      alert(err.message);
    }
  });
}

function renderArchive() {
  if (!appState.archives.length) {
    archiveList.innerHTML = '<p class="muted">No archived plans yet.</p>';
    return;
  }

  archiveList.innerHTML = appState.archives
    .map(
      (a) => `<div class="agenda-item"><div><strong>Completed:</strong> ${new Date(a.finishedAt).toLocaleDateString()}<br /><span class="muted">Window: ${a.summary.startDate} → ${a.summary.testDate}</span></div><span class="badge">${a.summary.completedTasks}/${a.summary.totalTasks} tasks</span></div>`,
    )
    .join("");
}

function renderDashboard() {
  welcomeMessage.textContent = `Welcome, ${appState.user.name}`;
  celebrationBanner.classList.add("hidden");

  const menu = `<div class="menu"><button id="openPlanCreator">Create Plan</button><button id="toggleArchive" class="button secondary">View Archives</button></div>`;

  if (!appState.activePlan) {
    mainPanel.innerHTML = `${menu}<h3>Main Dashboard</h3><p class="muted">You do not have an active plan yet. Start with <strong>Create Plan</strong>.</p>`;
  } else {
    archiveIfFinished();
    const plan = appState.activePlan;
    const daysLeft = Math.max(0, daysBetween(todayISO(), plan.testDate));
    const pointer = getPlanDayPointer(plan);
    const nextTask = plan.tasks[pointer] || null;
    const currentWeek = nextTask ? nextTask.week : Math.ceil(plan.tasks.length / 4);
    const skipsUsed = plan.skipByWeek[currentWeek] || 0;
    const weekDone = plan.tasks.filter((t) => t.week === currentWeek && t.completed).length;

    if (weekDone === 4) {
      celebrationBanner.textContent = `🎉 You completed week ${currentWeek} tasks! Great consistency.`;
      celebrationBanner.classList.remove("hidden");
    }

    mainPanel.innerHTML = `
      ${menu}
      <h3>Main Dashboard</h3>
      <p class="countdown">FITNESS TEST DATE: ${plan.testDate} — ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining</p>
      <p class="muted">Program type: Couch to 5K | 4 training days/week</p>
      <h4>Today's Agenda</h4>
      ${
        nextTask
          ? `<div class="agenda-list"><div class="agenda-item"><div><strong>${nextTask.title}</strong><br /><span class="badge">Week ${nextTask.week} • ${nextTask.type}</span></div><div class="inline"><button id="completeTask">Mark Complete</button></div></div></div><p class="muted">Need a break? You may defer today up to <strong>3 times/week</strong>. <span class="warning">Used this week: ${skipsUsed}/3</span></p><button id="skipTask" class="button secondary">Use Break Day (defer task)</button>`
          : `<p class="success">All tasks completed. Stay fresh for test day.</p>`
      }
    `;
  }

  document.getElementById("openPlanCreator").addEventListener("click", () => {
    planCreatorPanel.innerHTML = `
      <h3>Create Training Plan</h3>
      <p class="muted">Fill in details to build a customized 4-day/week program that ramps up to your test day.</p>
      <form id="planForm">
        <label>Fitness test date <input type="date" name="testDate" min="${todayISO()}" required /></label>
        <label>Current continuous run time (minutes) <input type="number" min="5" max="45" name="currentRunMinutes" required /></label>
        <label>Target 5K finish time (minutes, optional) <input type="number" min="18" max="60" name="goalTime" /></label>
        <label>Notes or constraints<textarea name="notes" rows="3"></textarea></label>
        <div class="inline"><button type="submit">Generate Plan</button><button type="button" id="cancelPlanCreate" class="button secondary">Cancel</button></div>
      </form>`;
    planCreatorPanel.classList.remove("hidden");

    document.getElementById("cancelPlanCreate").addEventListener("click", () => planCreatorPanel.classList.add("hidden"));
    document.getElementById("planForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const testDate = String(fd.get("testDate") || "");
      if (daysBetween(todayISO(), testDate) < 1) {
        alert("Test date must be at least tomorrow.");
        return;
      }
      appState.activePlan = generatePlan({
        testDate,
        currentRunMinutes: fd.get("currentRunMinutes"),
        goalTime: Number(fd.get("goalTime")) || null,
        notes: String(fd.get("notes") || ""),
      });
      await persistPlan();
      planCreatorPanel.classList.add("hidden");
      renderDashboard();
    });
  });

  document.getElementById("toggleArchive").addEventListener("click", () => {
    const hidden = archivePanel.classList.contains("hidden");
    if (hidden) {
      renderArchive();
      archivePanel.classList.remove("hidden");
    } else {
      archivePanel.classList.add("hidden");
    }
  });

  const completeBtn = document.getElementById("completeTask");
  if (completeBtn) {
    completeBtn.addEventListener("click", async () => {
      const idx = getPlanDayPointer(appState.activePlan);
      if (appState.activePlan.tasks[idx]) appState.activePlan.tasks[idx].completed = true;
      archiveIfFinished();
      await persistPlan();
      renderDashboard();
    });
  }

  const skipBtn = document.getElementById("skipTask");
  if (skipBtn) {
    skipBtn.addEventListener("click", async () => {
      const idx = getPlanDayPointer(appState.activePlan);
      const week = appState.activePlan.tasks[idx]?.week;
      if (!week) return;

      appState.activePlan.skipByWeek[week] = (appState.activePlan.skipByWeek[week] || 0) + 1;
      if (appState.activePlan.skipByWeek[week] > appState.activePlan.skipAllowancePerWeek) {
        appState.activePlan.skipByWeek[week] = appState.activePlan.skipAllowancePerWeek;
        alert("You already used all 3 break days this week.");
        return;
      }
      const [task] = appState.activePlan.tasks.splice(idx, 1);
      appState.activePlan.tasks.splice(idx + 1, 0, task);
      await persistPlan();
      renderDashboard();
    });
  }
}

async function hydrateUserData() {
  const me = await api("/api/auth/me");
  appState.user = me.user;
  const plan = await api("/api/plan");
  appState.activePlan = plan.activePlan;
  const archives = await api("/api/archives");
  appState.archives = archives.archives || [];
}

function render() {
  if (!appState.user) {
    authSection.classList.remove("hidden");
    dashboard.classList.add("hidden");
    renderAuth();
    return;
  }

  authSection.classList.add("hidden");
  dashboard.classList.remove("hidden");
  renderDashboard();
}

logoutBtn.addEventListener("click", () => {
  appState.token = null;
  appState.user = null;
  appState.activePlan = null;
  appState.archives = [];
  localStorage.removeItem(TOKEN_KEY);
  render();
});

(async function boot() {
  if (appState.token) {
    try {
      await hydrateUserData();
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      appState.token = null;
    }
  }
  render();
})();

