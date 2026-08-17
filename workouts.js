// The 4 workout templates, transcribed from "Upper lower tracker.xlsx".
// `sets` is the default number of sets; you can add/remove sets per session in the app.
// `note` carries any stance/form cue from the original sheet.
window.WORKOUTS = {
  "Upper A": [
    { name: "Machine Chest Press", sets: 2 },
    { name: "Weighted Pull-Ups", sets: 2, note: "Log added weight (belt); 0 = bodyweight" },
    { name: "Machine Overhead Press", sets: 2 },
    { name: "Cable Seated Rows", sets: 2 },
    { name: "Pec Deck Flys", sets: 2 },
    // Alternating Arms to avoid fatigue:
    { name: "Cable Tricep Pushdowns", sets: 3, note: "Increased to 3 sets for hypertrophy" },
    { name: "Machine Preacher Curls", sets: 3, note: "Increased to 3 sets for hypertrophy" },
    { name: "Cross-Body Cable Tricep Extensions", sets: 3, note: "Focus on lateral head" },
    { name: "Incline Dumbbell Curls", sets: 3, note: "Bench at 45 degrees, deep stretch" },
    { name: "Dumbbell Wrist Curls", sets: 2, note: "Rest forearms on bench, focus on flexors" },
  ],
  "Lower A": [
    { name: "Leg Press", sets: 3, note: "Feet lower/closer for quads" },
    { name: "Seated Leg Curls", sets: 3 },
    { name: "Bulgarian Split Squats", sets: 3 },
    { name: "Leg Extensions", sets: 3 },
    { name: "Calf Raises", sets: 3 },
    { name: "Cable Crunches", sets: 3 },
    { name: "Hanging Leg Raises", sets: 3, note: "To failure" },
    { name: "Russian Twists", sets: 3, note: "Weighted, 10-15 per side" },
    { name: "Neck Extensions", sets: 3, note: "Use a neck harness or plate behind the head" },
  ],
  "Upper B": [
    { name: "Incline Smith Machine Press", sets: 2, note: "or Dumbbells" },
    { name: "Weighted Pull-Ups", sets: 2, note: "Log added weight (belt); 0 = bodyweight" },
    { name: "Cable Lateral Raises", sets: 2 },
    { name: "T-Bar Rows", sets: 2 },
    { name: "Reverse Pec Deck", sets: 2 },
    // Alternating Arms to avoid fatigue:
    { name: "Preacher Hammer Curls", sets: 3, note: "Increased to 3 sets for hypertrophy" },
    { name: "Overhead Cable Tricep Extensions", sets: 3, note: "Increased to 3 sets for hypertrophy" },
    { name: "Supinating Dumbbell Curls", sets: 3, note: "Twist wrists up at the top" },
    { name: "Reverse Dumbbell Wrist Curls", sets: 2, note: "Focus on extensors" },
  ],
  "Lower B": [
    { name: "Seated Leg Curls", sets: 3 },
    { name: "Leg Press", sets: 3, note: "Feet higher/wider for glutes/hams" },
    { name: "Leg Extensions", sets: 3 },
    { name: "Calf Raises", sets: 3 },
    { name: "Hanging Leg Raises", sets: 3, note: "To failure" },
    { name: "Cable Crunches", sets: 3 },
    { name: "Russian Twists", sets: 3, note: "Weighted, 10-15 per side" },
    { name: "Neck Curls", sets: 3, note: "Lie on bench, plate on forehead" },
  ],
  // Auto-regulated "sore/tired" days: manufacture sleep pressure, flush metabolic
  // waste from full-court basketball, and hold onto muscle without taxing the CNS.
  // Rules: zero spinal loading, fixed paths (machines/cables) only, RPE 7 max
  // (stop 3-4 reps short of failure), and alternate biceps/triceps.
  "Sore Upper": [
    { name: "Machine Chest Press", sets: 3, note: "10-12 @ RPE 7 — smooth tempo, no violent lockout" },
    { name: "Chest-Supported Machine Row", sets: 3, note: "10-12 @ RPE 7 — chest glued to the pad" },
    { name: "Cable Lateral Raises", sets: 3, note: "12-15 — light, pure side delt contraction" },
    // Alternating Arms to avoid fatigue:
    { name: "Cable Bicep Curls", sets: 2, note: "12-15 — first arm movement" },
    { name: "Cable Tricep Pushdowns", sets: 2, note: "12-15 — alternate to triceps" },
    { name: "Hammer Curls", sets: 2, note: "12-15 — dumbbell or cable, neutral grip to protect elbows" },
  ],
  "Sore Lower": [
    { name: "Seated Leg Curls", sets: 3, note: "12-15 — first, pump blood into the knees before pressing" },
    { name: "Leg Press", sets: 3, note: "10-12 @ RPE 7 — feet high, never let the sled crash down" },
    { name: "Leg Extensions", sets: 3, note: "12-15 — light, half-second pause at the top" },
    { name: "Seated Calf Raises", sets: 3, note: "12-15 — deep stretch at the bottom for ankle mobility" },
    { name: "Machine Crunches", sets: 2, note: "12-15 — light core, zero lower back strain" },
  ],
  "Posture Fix": [
    // Release
    { name: "Cat-Cow", sets: 1, note: "~10 slow reps, breathe through each phase" },
    { name: "Kneeling Hip Flexor Stretch", sets: 2, timed: true, note: "Per side — tuck pelvis + squeeze glute (30-45s)" },
    { name: "Doorway Chest Stretch", sets: 2, timed: true, note: "Per side — elbow at shoulder height (30s)" },
    // Activate
    { name: "Glute Bridges", sets: 3, note: "3s pause at top, posterior tilt, ribs down" },
    { name: "Dead Bugs", sets: 3, note: "Per side — low back pressed to floor" },
    { name: "Wall Angels", sets: 2, note: "Low back & wrists on wall, slow" },
    { name: "Band Pull-Aparts", sets: 3, note: "15-20 reps, squeeze 1s" },
  ],
};

window.WORKOUT_ORDER = ["Upper A", "Lower A", "Upper B", "Lower B", "Sore Upper", "Sore Lower", "Posture Fix"];
