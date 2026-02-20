const STORAGE_KEY = "noFailDataV1";

const appState = {
  users: [],
  sessionUsername: null,
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

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    appState.users = Array.isArray(parsed.users) ? parsed.users : [];
    appState.sessionUsername = parsed.sessionUsername || null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function daysBetween(startISO, endISO) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  const ms = end - start;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function getCurrentUser() {
  return appState.users.find((u) => u.username === appState.sessionUsername) || null;
}

function weeklyFocusTasks(weekIndex, baselineRunMinutes) {
  const build = Math.max(0, weekIndex - 1);
  const runA = baselineRunMinutes + build * 2;
  const runB = baselineRunMinutes + build * 3;
  const interval = baselineRunMinutes + build * 1;

  return [
    {
      title: `Run/Walk ${runA} min + mobility`,
      type: "Endurance",
    },
    {
      title: `Speed intervals ${Math.max(12, interval)} min total`,
      type: "Speed",
    },
    {
      title: `Steady run ${runB} min`,
      type: "Stamina",
    },
    {
      title: `Strength + optional easy jog`,
      type: "Strength",
    },
  ];
}

function generatePlan(planInput) {
  const startDate = todayISO();
  const totalDays = Math.max(1, daysBetween(startDate, planInput.testDate));
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const baseline = Number(planInput.currentRunMinutes);
  const tasks = [];

  for (let week = 1; week <= totalWeeks; week += 1) {
    const tasksThisWeek = weeklyFocusTasks(week, baseline);
    tasksThisWeek.forEach((template, idx) => {
      tasks.push({
        id: `${week}-${idx + 1}`,
        week,
        title: template.title,
        type: template.type,
        completed: false,
      });
    });
  }

  return {
    createdAt: new Date().toISOString(),
    startDate,
    testDate: planInput.testDate,
    goalTime: planInput.goalTime,
    currentRunMinutes: baseline,
    notes: planInput.notes,
    skipAllowancePerWeek: 3,
    skipByWeek: {},
    tasks,
    archiveAtEnd: false,
  };
}

function renderAuth() {
  const loginHTML = `
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

  authSection.innerHTML = loginHTML;

  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    const user = appState.users.find((u) => u.username === username && u.password === password);

    if (!user) {
      alert("Invalid login.");
      return;
    }

    appState.sessionUsername = user.username;
    saveState();
    render();
  });

  document.getElementById("signupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = String(formData.get("name") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");

    if (appState.users.some((u) => u.username === username)) {
      alert("Username is already taken.");
      return;
    }

    const user = {
      name,
      username,
      password,
      activePlan: null,
      archives: [],
    };

    appState.users.push(user);
    appState.sessionUsername = username;
    saveState();
    render();
  });
}

function planCreatorMarkup() {
  const minDate = todayISO();
  return `
    <h3>Create Training Plan</h3>
    <p class="muted">Fill in details to build a customized 4-day/week program that ramps up to your test day.</p>
    <form id="planForm">
      <label>Fitness test date <input type="date" name="testDate" min="${minDate}" required /></label>
      <label>Current continuous run time (minutes) <input type="number" min="5" max="45" name="currentRunMinutes" required /></label>
      <label>Target 5K finish time (minutes, optional) <input type="number" min="18" max="60" name="goalTime" /></label>
      <label>Notes or constraints
        <textarea name="notes" rows="3" placeholder="Example: knee sensitivity, preferred workout windows..."></textarea>
      </label>
      <div class="inline">
        <button type="submit">Generate Plan</button>
        <button type="button" id="cancelPlanCreate" class="button secondary">Cancel</button>
      </div>
    </form>
  `;
}

function getPlanDayPointer(plan) {
  const doneCount = plan.tasks.filter((t) => t.completed).length;
  return doneCount;
}

function weekFromTaskIndex(idx) {
  return Math.floor(idx / 4) + 1;
}

function archiveIfFinished(user) {
  const plan = user.activePlan;
  if (!plan) return;

  const isAllTasksDone = plan.tasks.every((t) => t.completed);
  const daysLeft = daysBetween(todayISO(), plan.testDate);

  if (!isAllTasksDone || daysLeft > 0) {
    return;
  }

  user.archives.unshift({
    finishedAt: new Date().toISOString(),
    summary: {
      startDate: plan.startDate,
      testDate: plan.testDate,
      totalTasks: plan.tasks.length,
      completedTasks: plan.tasks.filter((t) => t.completed).length,
      goalTime: plan.goalTime,
    },
  });

  user.activePlan = null;
}

function renderArchive(user) {
  if (!user.archives.length) {
    archiveList.innerHTML = '<p class="muted">No archived plans yet.</p>';
    return;
  }

  archiveList.innerHTML = user.archives
    .map(
      (a) => `
      <div class="agenda-item">
        <div>
          <strong>Completed:</strong> ${new Date(a.finishedAt).toLocaleDateString()}<br />
          <span class="muted">Window: ${a.summary.startDate} → ${a.summary.testDate}</span>
        </div>
        <span class="badge">${a.summary.completedTasks}/${a.summary.totalTasks} tasks</span>
      </div>
    `,
    )
    .join("");
}

function renderDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  welcomeMessage.textContent = `Welcome, ${user.name}`;
  celebrationBanner.classList.add("hidden");

  const menu = `
    <div class="menu">
      <button id="openPlanCreator">Create Plan</button>
      <button id="toggleArchive" class="button secondary">View Archives</button>
    </div>
  `;

  if (!user.activePlan) {
    mainPanel.innerHTML = `
      ${menu}
      <h3>Main Dashboard</h3>
      <p class="muted">You do not have an active plan yet. Start with <strong>Create Plan</strong>.</p>
    `;
  } else {
    const plan = user.activePlan;
    archiveIfFinished(user);

    if (!user.activePlan) {
      saveState();
      renderDashboard();
      return;
    }

    const daysLeft = Math.max(0, daysBetween(todayISO(), plan.testDate));
    const pointer = getPlanDayPointer(plan);
    const nextTask = plan.tasks[pointer] || null;
    const completedThisWeek = plan.tasks.filter((task, idx) => {
      return task.completed && weekFromTaskIndex(idx) === weekFromTaskIndex(pointer);
    }).length;

    const currentWeek = nextTask ? nextTask.week : Math.ceil(plan.tasks.length / 4);
    const skipsUsed = plan.skipByWeek[currentWeek] || 0;

    if (completedThisWeek === 4) {
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
          ? `<div class="agenda-list">
              <div class="agenda-item">
                <div>
                  <strong>${nextTask.title}</strong><br />
                  <span class="badge">Week ${nextTask.week} • ${nextTask.type}</span>
                </div>
                <div class="inline">
                  <button id="completeTask">Mark Complete</button>
                </div>
              </div>
            </div>
            <p class="muted">Need a break? You may defer today up to <strong>3 times/week</strong>.
              <span class="warning">Used this week: ${skipsUsed}/3</span>
            </p>
            <button id="skipTask" class="button secondary">Use Break Day (defer task)</button>`
          : `<p class="success">All tasks completed. Stay fresh for test day.</p>`
      }
    `;
  }

  document.getElementById("openPlanCreator").addEventListener("click", () => {
    planCreatorPanel.innerHTML = planCreatorMarkup();
    planCreatorPanel.classList.remove("hidden");

    document.getElementById("cancelPlanCreate").addEventListener("click", () => {
      planCreatorPanel.classList.add("hidden");
    });

    document.getElementById("planForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const planData = new FormData(event.target);
      const testDate = String(planData.get("testDate") || "");

      if (daysBetween(todayISO(), testDate) < 1) {
        alert("Test date must be at least tomorrow.");
        return;
      }

      user.activePlan = generatePlan({
        testDate,
        currentRunMinutes: planData.get("currentRunMinutes"),
        goalTime: Number(planData.get("goalTime")) || null,
        notes: String(planData.get("notes") || ""),
      });

      planCreatorPanel.classList.add("hidden");
      saveState();
      renderDashboard();
    });
  });

  document.getElementById("toggleArchive").addEventListener("click", () => {
    const hidden = archivePanel.classList.contains("hidden");
    if (hidden) {
      renderArchive(user);
      archivePanel.classList.remove("hidden");
    } else {
      archivePanel.classList.add("hidden");
    }
  });

  const completeTaskButton = document.getElementById("completeTask");
  if (completeTaskButton) {
    completeTaskButton.addEventListener("click", () => {
      const active = user.activePlan;
      const idx = getPlanDayPointer(active);
      if (active.tasks[idx]) {
        active.tasks[idx].completed = true;
      }
      archiveIfFinished(user);
      saveState();
      renderDashboard();
    });
  }

  const skipTaskButton = document.getElementById("skipTask");
  if (skipTaskButton) {
    skipTaskButton.addEventListener("click", () => {
      const active = user.activePlan;
      const idx = getPlanDayPointer(active);
      const week = active.tasks[idx]?.week;

      if (!week) return;

      active.skipByWeek[week] = (active.skipByWeek[week] || 0) + 1;
      if (active.skipByWeek[week] > active.skipAllowancePerWeek) {
        active.skipByWeek[week] = active.skipAllowancePerWeek;
        alert("You already used all 3 break days this week.");
        return;
      }

      const [task] = active.tasks.splice(idx, 1);
      active.tasks.splice(idx + 1, 0, task);
      saveState();
      renderDashboard();
    });
  }
}

function render() {
  const user = getCurrentUser();
  if (!user) {
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
  appState.sessionUsername = null;
  saveState();
  render();
});

loadState();
render();
