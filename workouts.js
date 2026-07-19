// The 4 workout templates, transcribed from "Upper lower tracker.xlsx".
// `sets` is the default number of sets; you can add/remove sets per session in the app.
// `note` carries any stance/form cue from the original sheet.
window.WORKOUTS = {
  "Upper A": [
    { name: "Machine Chest Press", sets: 2 },
    { name: "Lat Pulldowns", sets: 2 },
    { name: "Machine Overhead Press", sets: 2 },
    { name: "Cable Seated Rows", sets: 2 },
    { name: "Pec Deck Flys", sets: 2 },
    { name: "Cable Tricep Pushdowns", sets: 2 },
    { name: "Machine Preacher Curls", sets: 2 },
    { name: "Dumbbell Wrist Curls", sets: 2, note: "Rest forearms on bench, focus on flexors" },
  ],
  "Lower A": [
    { name: "Leg Press", sets: 3, note: "Feet lower/closer for quads" },
    { name: "Seated Leg Curls", sets: 3 },
    { name: "Bulgarian Split Squats", sets: 3 },
    { name: "Leg Extensions", sets: 3 },
    { name: "Machine Calf Raises", sets: 3 },
    { name: "Heavy Cable Crunches", sets: 3 },
    { name: "Hanging Leg Raises", sets: 3, note: "To failure" },
    { name: "Cable Woodchoppers", sets: 3, note: "8-12 reps per side" },
    { name: "Neck Extensions", sets: 3, note: "Use a neck harness or plate behind the head" },
  ],
  "Upper B": [
    { name: "Incline Smith Machine Press", sets: 2, note: "or Dumbbells" },
    { name: "Chest-Supported Machine Rows", sets: 2 },
    { name: "Cable Lateral Raises", sets: 2 },
    { name: "V-Bar Pulldowns", sets: 2, note: "Seated row grip" },
    { name: "Reverse Pec Deck", sets: 2 },
    { name: "Overhead Cable Tricep Extensions", sets: 2 },
    { name: "Hammer Curls", sets: 2 },
    { name: "Reverse Dumbbell Wrist Curls", sets: 2, note: "Focus on extensors" },
  ],
  "Lower B": [
    { name: "Seated Leg Curls", sets: 3 },
    { name: "Leg Press", sets: 3, note: "Feet higher/wider for glutes/hams" },
    { name: "Leg Extensions", sets: 3 },
    { name: "Leg Press Calf Raises", sets: 3 },
    { name: "Hanging Leg Raises", sets: 3, note: "To failure" },
    { name: "Cable Crunches", sets: 3 },
    { name: "Cable Woodchoppers", sets: 3, note: "8-12 reps per side" },
    { name: "Neck Curls", sets: 3, note: "Lie on bench, plate on forehead" },
  ],
};

window.WORKOUT_ORDER = ["Upper A", "Lower A", "Upper B", "Lower B"];
