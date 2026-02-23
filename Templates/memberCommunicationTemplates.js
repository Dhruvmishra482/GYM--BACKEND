const formatDate = (date) => {
  if (!date) return "N/A";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (amount) => {
  const value = Number(amount || 0);
  return `INR ${value.toLocaleString("en-IN")}`;
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const textOrNA = (value) =>
  value === null || value === undefined || value === "" ? "N/A" : escapeHtml(value);

const listFromItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p style="margin:8px 0 0;color:#64748b;font-size:13px;">Not specified.</p>`;
  }

  const rows = items
    .filter(Boolean)
    .map(
      (item) =>
        `<li style="margin:0 0 6px;line-height:1.5;color:#0f172a;">${escapeHtml(item)}</li>`
    )
    .join("");

  return `<ul style="margin:8px 0 0 18px;padding:0;">${rows}</ul>`;
};

const renderPlanMetaRow = (label, value) => {
  return `<tr><td style="padding:6px 0;color:#475569;">${escapeHtml(
    label
  )}</td><td style="padding:6px 0;"><strong>${textOrNA(value)}</strong></td></tr>`;
};

const getPriorityTheme = (priority = "") => {
  const level = String(priority).toLowerCase();
  if (level === "high") {
    return {
      chipBg: "#fee2e2",
      chipText: "#991b1b",
      boxBg: "#fff1f2",
      boxBorder: "#fecaca",
    };
  }
  if (level === "medium") {
    return {
      chipBg: "#fef3c7",
      chipText: "#92400e",
      boxBg: "#fffbeb",
      boxBorder: "#fde68a",
    };
  }
  return {
    chipBg: "#dcfce7",
    chipText: "#166534",
    boxBg: "#f0fdf4",
    boxBorder: "#bbf7d0",
  };
};

const buildLayout = ({ heading, subheading, bodyHtml, gymName, ownerName }) => {
  return `
  <div style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="padding:24px 28px;background:linear-gradient(120deg,#0f172a,#1d4ed8);color:#ffffff;">
        <div style="font-size:12px;opacity:0.9;letter-spacing:1.1px;text-transform:uppercase;">${escapeHtml(
          gymName
        )}</div>
        <h1 style="margin:8px 0 4px;font-size:24px;line-height:1.3;">${escapeHtml(
          heading
        )}</h1>
        <p style="margin:0;font-size:14px;opacity:0.9;">${escapeHtml(subheading)}</p>
      </div>
      <div style="padding:24px 28px;">
        ${bodyHtml}
      </div>
      <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:13px;color:#475569;">
        Regards,<br/>
        <strong>${escapeHtml(ownerName)}</strong><br/>
        ${escapeHtml(gymName)}
      </div>
    </div>
  </div>
  `;
};

const getAnnouncementEmail = ({
  memberName,
  gymName,
  ownerName,
  title,
  message,
  priority,
  announcementType,
}) => {
  const theme = getPriorityTheme(priority);
  const cleanMessage = escapeHtml(message || "").replace(/\n/g, "<br/>");
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi <strong>${escapeHtml(memberName)}</strong>,</p>
    <p style="margin:0 0 14px;">A new announcement has been shared by your trainer. Complete details are below.</p>

    <div style="padding:14px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;margin-bottom:12px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${renderPlanMetaRow("Category", announcementType)}
        ${renderPlanMetaRow("Priority", priority)}
      </table>
    </div>

    <div style="padding:16px;border:1px solid ${theme.boxBorder};background:${theme.boxBg};border-radius:10px;margin-bottom:12px;">
      <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:${theme.chipBg};color:${theme.chipText};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">
        ${escapeHtml(priority || "General")} Priority
      </div>
      <h2 style="margin:10px 0 10px;font-size:21px;color:#0f172a;line-height:1.35;">${escapeHtml(title)}</h2>
      <div style="margin:0;line-height:1.7;color:#0f172a;font-size:15px;">${cleanMessage || "No additional message provided."}</div>
    </div>

    <div style="padding:12px;border:1px dashed #cbd5e1;border-radius:10px;background:#ffffff;">
      <p style="margin:0;color:#334155;line-height:1.6;">
        For any clarification, please contact your trainer or gym front desk.
      </p>
    </div>
  `;

  return buildLayout({
    heading: "Important Gym Announcement",
    subheading: "Please review the update below.",
    bodyHtml,
    gymName,
    ownerName,
  });
};

const getWorkoutPlanEmail = ({ memberName, gymName, ownerName, plan }) => {
  const safePlan = plan || {};
  const goals =
    safePlan?.targetGoals?.description || safePlan?.targetGoals?.primaryGoal || "General Fitness";
  const sessionTime = safePlan?.targetGoals?.estimatedTimePerSession || "As advised by trainer";
  const days = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  const weeklyScheduleHtml = days
    .map(({ key, label }) => {
      const day = safePlan?.weeklySchedule?.[key];
      if (!day) {
        return "";
      }

      if (day.restDay) {
        return `
          <div style="padding:14px;border:1px solid #e2e8f0;border-radius:10px;margin-top:10px;">
            <h4 style="margin:0 0 8px;font-size:16px;color:#0f172a;">${escapeHtml(label)}</h4>
            <p style="margin:0;color:#334155;"><strong>Rest Day</strong>${
              day.focus ? ` - ${escapeHtml(day.focus)}` : ""
            }</p>
          </div>
        `;
      }

      const exercisesHtml =
        Array.isArray(day.exercises) && day.exercises.length > 0
          ? `
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;border:1px solid #e2e8f0;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;">#</th>
                <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;">Exercise</th>
                <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;">Sets</th>
                <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;">Reps</th>
                <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;">Rest</th>
                <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${day.exercises
                .map(
                  (exercise, index) => `
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${index + 1}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${textOrNA(
                    exercise?.name
                  )}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${textOrNA(
                    exercise?.sets
                  )}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${textOrNA(
                    exercise?.reps
                  )}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${textOrNA(
                    exercise?.rest
                  )}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${textOrNA(
                    exercise?.notes
                  )}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `
          : `<p style="margin:8px 0 0;color:#64748b;font-size:13px;">No exercises specified for this day.</p>`;

      return `
        <div style="padding:14px;border:1px solid #e2e8f0;border-radius:10px;margin-top:10px;">
          <h4 style="margin:0 0 8px;font-size:16px;color:#0f172a;">${escapeHtml(label)}</h4>
          <p style="margin:0 0 4px;color:#334155;"><strong>Focus:</strong> ${textOrNA(day.focus)}</p>
          <p style="margin:0 0 4px;color:#334155;"><strong>Warm-up:</strong> ${textOrNA(day.warmup)}</p>
          <p style="margin:0 0 4px;color:#334155;"><strong>Cardio:</strong> ${textOrNA(day.cardio)}</p>
          <p style="margin:0;color:#334155;"><strong>Cooldown:</strong> ${textOrNA(day.cooldown)}</p>
          ${exercisesHtml}
        </div>
      `;
    })
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi <strong>${escapeHtml(memberName)}</strong>,</p>
    <p style="margin:0 0 14px;">Your trainer has shared a complete AI workout plan for you. All details are included below in this email.</p>
    <div style="padding:14px;border:1px solid #c7d2fe;background:#eef2ff;border-radius:10px;">
      <h2 style="margin:0 0 10px;font-size:19px;">${textOrNA(safePlan.planTitle)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${renderPlanMetaRow("Plan Type", safePlan.planType)}
        ${renderPlanMetaRow("Level", safePlan.difficultyLevel)}
        ${renderPlanMetaRow("Duration", safePlan.planDuration)}
        ${renderPlanMetaRow(
          "Frequency",
          safePlan.workoutsPerWeek ? `${safePlan.workoutsPerWeek} days/week` : null
        )}
        ${renderPlanMetaRow("Target Audience", safePlan.targetAudience)}
        ${renderPlanMetaRow("Goal", goals)}
        ${renderPlanMetaRow("Session Time", sessionTime)}
      </table>
    </div>
    <div style="margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">
      <h3 style="margin:0 0 8px;font-size:17px;color:#0f172a;">Weekly Workout Schedule</h3>
      ${weeklyScheduleHtml || '<p style="margin:0;color:#64748b;">Weekly schedule is not available.</p>'}
    </div>

    <div style="margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">
      <h3 style="margin:0 0 6px;font-size:17px;color:#0f172a;">Important Tips</h3>
      ${listFromItems(safePlan.importantTips)}
      <h3 style="margin:14px 0 6px;font-size:17px;color:#0f172a;">Safety Guidelines</h3>
      ${listFromItems(safePlan.safetyGuidelines)}
      <h3 style="margin:14px 0 6px;font-size:17px;color:#0f172a;">Recovery Tips</h3>
      ${listFromItems(safePlan.recoveryTips)}
    </div>

    <div style="margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">
      <h3 style="margin:0 0 6px;font-size:17px;color:#0f172a;">Trainer Notes</h3>
      <p style="margin:0 0 10px;line-height:1.6;color:#334155;white-space:pre-wrap;">${textOrNA(
        safePlan.generalInstructions
      )}</p>
      <h3 style="margin:0 0 6px;font-size:17px;color:#0f172a;">Progression Plan</h3>
      <p style="margin:0;line-height:1.6;color:#334155;white-space:pre-wrap;">${textOrNA(
        safePlan.progressionNotes
      )}</p>
    </div>
  `;

  return buildLayout({
    heading: "Your AI Workout Plan",
    subheading: "Train consistently and stay disciplined.",
    bodyHtml,
    gymName,
    ownerName,
  });
};

const getDietPlanEmail = ({ memberName, gymName, ownerName, plan }) => {
  const safePlan = plan || {};
  const calories =
    safePlan?.targetGoals?.dailyCaloriesRange?.min && safePlan?.targetGoals?.dailyCaloriesRange?.max
      ? `${safePlan.targetGoals.dailyCaloriesRange.min}-${safePlan.targetGoals.dailyCaloriesRange.max} kcal`
      : "As advised by trainer";
  const meals = [
    { key: "earlyMorning", label: "Early Morning" },
    { key: "breakfast", label: "Breakfast" },
    { key: "midMorning", label: "Mid Morning" },
    { key: "lunch", label: "Lunch" },
    { key: "eveningSnack", label: "Evening Snack" },
    { key: "dinner", label: "Dinner" },
    { key: "beforeBed", label: "Before Bed" },
  ];

  const mealPlanHtml = meals
    .map(({ key, label }) => {
      const meal = safePlan?.mealPlan?.[key];
      if (!meal) return "";
      const items = Array.isArray(meal.items) ? meal.items.filter(Boolean) : [];
      if (!meal.time && items.length === 0 && !meal.notes) return "";

      return `
        <div style="padding:12px;border:1px solid #e2e8f0;border-radius:10px;margin-top:10px;">
          <h4 style="margin:0 0 6px;font-size:16px;color:#0f172a;">${escapeHtml(label)}</h4>
          <p style="margin:0 0 6px;color:#334155;"><strong>Time:</strong> ${textOrNA(meal.time || "Flexible")}</p>
          <div style="color:#334155;">
            <strong>Items:</strong>
            ${listFromItems(items)}
          </div>
          ${
            meal.notes
              ? `<p style="margin:8px 0 0;color:#334155;line-height:1.5;"><strong>Notes:</strong> ${escapeHtml(
                  meal.notes
                )}</p>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  const supplementsHtml =
    Array.isArray(safePlan.supplements) && safePlan.supplements.length > 0
      ? `
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;margin-top:8px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;">Supplement</th>
            <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;">Timing</th>
            <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;">Dosage</th>
          </tr>
        </thead>
        <tbody>
          ${safePlan.supplements
            .map(
              (supplement) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${textOrNA(supplement?.name)}</td>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${textOrNA(supplement?.timing)}</td>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${textOrNA(supplement?.dosage)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `
      : `<p style="margin:8px 0 0;color:#64748b;font-size:13px;">No supplements specified.</p>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi <strong>${escapeHtml(memberName)}</strong>,</p>
    <p style="margin:0 0 14px;">Your trainer has shared a complete AI diet plan for you. All details are included below in this email.</p>
    <div style="padding:14px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;">
      <h2 style="margin:0 0 10px;font-size:19px;">${textOrNA(safePlan.planTitle)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${renderPlanMetaRow("Plan Type", safePlan.planType)}
        ${renderPlanMetaRow("Duration", safePlan.planDuration)}
        ${renderPlanMetaRow("Target Audience", safePlan.targetAudience)}
        ${renderPlanMetaRow("Water Intake", safePlan.waterIntake || "As advised")}
        ${renderPlanMetaRow("Calories", calories)}
        ${renderPlanMetaRow("Primary Goal", safePlan?.targetGoals?.description)}
      </table>
    </div>
    <div style="margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">
      <h3 style="margin:0 0 8px;font-size:17px;color:#0f172a;">Daily Meal Plan</h3>
      ${mealPlanHtml || '<p style="margin:0;color:#64748b;">Meal details are not available.</p>'}
    </div>

    <div style="margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">
      <h3 style="margin:0 0 6px;font-size:17px;color:#0f172a;">Supplements</h3>
      ${supplementsHtml}
      <h3 style="margin:14px 0 6px;font-size:17px;color:#0f172a;">Do's</h3>
      ${listFromItems(safePlan.dosList)}
      <h3 style="margin:14px 0 6px;font-size:17px;color:#0f172a;">Don'ts</h3>
      ${listFromItems(safePlan.dontsList)}
    </div>

    <div style="margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">
      <h3 style="margin:0 0 6px;font-size:17px;color:#0f172a;">Trainer Notes</h3>
      <p style="margin:0 0 10px;line-height:1.6;color:#334155;white-space:pre-wrap;">${textOrNA(
        safePlan.generalInstructions
      )}</p>
      <h3 style="margin:0 0 6px;font-size:17px;color:#0f172a;">General Guidance</h3>
      <p style="margin:0;line-height:1.6;color:#334155;white-space:pre-wrap;">${textOrNA(
        safePlan?.targetGoals?.generalNotes
      )}</p>
    </div>
  `;

  return buildLayout({
    heading: "Your AI Diet Plan",
    subheading: "Nutrition discipline drives fitness results.",
    bodyHtml,
    gymName,
    ownerName,
  });
};

const getFeeReminderEmail = ({
  memberName,
  gymName,
  ownerName,
  amount,
  dueDate,
  overdueDays,
}) => {
  const isOverdue = Number(overdueDays || 0) > 0;
  const reminderLine = isOverdue
    ? `Your gym fee is overdue by <strong>${overdueDays} day(s)</strong>.`
    : `Your gym fee is due <strong>today</strong>.`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi <strong>${escapeHtml(memberName)}</strong>,</p>
    <p style="margin:0 0 12px;">${reminderLine}</p>
    <div style="padding:14px;border:1px solid #fecaca;background:#fff1f2;border-radius:10px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#475569;">Amount Due</td><td style="padding:6px 0;"><strong>${formatCurrency(amount)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#475569;">Due Date</td><td style="padding:6px 0;"><strong>${formatDate(dueDate)}</strong></td></tr>
      </table>
    </div>
    <p style="margin:14px 0 0;color:#334155;">Please make the payment at the earliest to avoid interruptions in your membership.</p>
  `;

  return buildLayout({
    heading: "Gym Fee Reminder",
    subheading: "A quick payment reminder from your gym.",
    bodyHtml,
    gymName,
    ownerName,
  });
};

module.exports = {
  formatDate,
  formatCurrency,
  getAnnouncementEmail,
  getWorkoutPlanEmail,
  getDietPlanEmail,
  getFeeReminderEmail,
};
