export interface VocabItem {
  id: string;
  word: string;
  correctAnswer: string;
  options: string[];
  category: string;
  exampleSentence?: string;
}

export type Difficulty = "easy" | "medium" | "hard";

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const CATEGORY_EMOJI: Record<string, string> = {
  "Office Items": "🖇️",
  "Food and Beverage": "🍽️",
  "Vehicle": "🚗",
  "Clothes and Fashion": "👗",
  "Work and Employment": "💼",
  "Business and Finance": "💰",
  "Travel and Tourism": "✈️",
  "Health and Well-being": "🏥",
  "Technology and Communication": "💻",
  "Education and Training": "🎓",
  "Environment": "🌍",
  "Household Items": "🏠",
  "Weather": "⛅",
  "Feelings and Emotions": "💭",
  "Crime and Law": "⚖️",
  "Sports": "⚽",
  "Shopping and Stores": "🛒",
  "Nature and Animals": "🦁",
  "Construction": "🏗️",
  "Family and Friends": "👨‍👩‍👧‍👦",
  "Advanced Vocabulary": "🧠",
  "Actions and Verbs": "🏃",
  "Personality and Attitude": "🎭",
  "Feelings and States": "💫",
  "Describing Things": "🔍",
  "Basic Verbs": "📗",
  "Intermediate Verbs": "📘",
  "Upper Intermediate Verbs": "📙",
  "Advanced Verbs": "📕",
  "Advanced Adjectives": "🏷️",
  "Linking Words": "🔗",
  "Phrasal Verbs": "🔀",
  "Expressions and Phrases": "💬",
  "Common Words": "📝",
  "General Linking Words": "🔗",
  "Concession and Contrast": "⚖️",
  "Negative Prefixes": "🚫",
  "Time Prefixes": "⏳",
  "Number Prefixes": "🔢",
  "Space and Direction Prefixes": "🧭",
};

export const CATEGORY_HEBREW: Record<string, string> = {
  "Office Items": "ציוד משרדי",
  "Food and Beverage": "אוכל ושתייה",
  "Vehicle": "כלי רכב",
  "Clothes and Fashion": "ביגוד ואופנה",
  "Work and Employment": "עבודה ותעסוקה",
  "Business and Finance": "עסקים וכלכלה",
  "Travel and Tourism": "נסיעות ותיירות",
  "Health and Well-being": "בריאות ורווחה",
  "Technology and Communication": "טכנולוגיה ותקשורת",
  "Education and Training": "חינוך והכשרה",
  "Environment": "סביבה",
  "Household Items": "פריטי בית",
  "Weather": "מזג אוויר",
  "Feelings and Emotions": "רגשות ותחושות",
  "Crime and Law": "פשע וחוק",
  "Sports": "ספורט",
  "Shopping and Stores": "קניות וחנויות",
  "Nature and Animals": "טבע ובעלי חיים",
  "Construction": "בנייה",
  "Family and Friends": "משפחה וחברים",
  "Advanced Vocabulary": "אוצר מילים מתקדם",
  "Actions and Verbs": "פעולות ופעלים",
  "Personality and Attitude": "אישיות וגישה",
  "Feelings and States": "רגשות ומצבים",
  "Describing Things": "תיאור דברים",
  "Basic Verbs": "פעלים בסיסיים",
  "Intermediate Verbs": "פעלים ברמה בינונית",
  "Upper Intermediate Verbs": "פעלים ברמה בינונית-גבוהה",
  "Advanced Verbs": "פעלים מתקדמים",
  "Advanced Adjectives": "שמות תואר מתקדמים",
  "Linking Words": "מילות קישור",
  "Phrasal Verbs": "פעלים צירופיים",
  "Expressions and Phrases": "ביטויים וצירופים",
  "Common Words": "מילים נפוצות",
  "General Linking Words": "מילות קישור - כללי",
  "Concession and Contrast": "מילות ויתור וניגוד",
  "Negative Prefixes": "תחיליות שלילה והיפוך משמעות",
  "Time Prefixes": "תחיליות זמן",
  "Number Prefixes": "תחיליות בנושא מספרים",
  "Space and Direction Prefixes": "תחיליות של מרחב, מקום וכיוון",
};

export const CATEGORY_DIFFICULTY: Record<string, Difficulty> = {
  "Basic Verbs": "easy",
  "Office Items": "easy",
  "Food and Beverage": "easy",
  "Vehicle": "easy",
  "Clothes and Fashion": "easy",
  "Household Items": "easy",
  "Weather": "easy",
  "Family and Friends": "easy",
  "Sports": "easy",
  "Common Words": "easy",

  "Intermediate Verbs": "medium",
  "Work and Employment": "medium",
  "Business and Finance": "medium",
  "Travel and Tourism": "medium",
  "Health and Well-being": "medium",
  "Technology and Communication": "medium",
  "Education and Training": "medium",
  "Environment": "medium",
  "Shopping and Stores": "medium",
  "Nature and Animals": "medium",
  "Construction": "medium",
  "Crime and Law": "medium",
  "Feelings and Emotions": "medium",
  "Phrasal Verbs": "medium",
  "Linking Words": "medium",
  "General Linking Words": "medium",
  "Concession and Contrast": "medium",
  "Negative Prefixes": "medium",
  "Time Prefixes": "medium",
  "Number Prefixes": "hard",
  "Space and Direction Prefixes": "hard",

  "Upper Intermediate Verbs": "hard",
  "Advanced Verbs": "hard",
  "Advanced Vocabulary": "hard",
  "Advanced Adjectives": "hard",
  "Actions and Verbs": "hard",
  "Personality and Attitude": "hard",
  "Feelings and States": "hard",
  "Describing Things": "hard",
  "Expressions and Phrases": "hard",
};

export function getDifficulty(category: string): Difficulty {
  return CATEGORY_DIFFICULTY[category] || "medium";
}

type UserLevel = "beginner" | "intermediate" | "advanced";

const LEVEL_DIFFICULTY_ORDER: Record<UserLevel, Difficulty[]> = {
  beginner: ["easy", "medium", "hard"],
  intermediate: ["medium", "easy", "hard"],
  advanced: ["hard", "medium", "easy"],
};

const DAILY_WORD_COUNT: Record<number, number> = { 5: 10, 15: 25, 30: 50 };

export interface SmartSessionConfig {
  level: UserLevel;
  dailyMinutes: number;
  allItems: VocabItem[];
  knownWords: Set<string>;
  needsPracticeWords: Set<string>;
}

export function buildSmartSession(config: SmartSessionConfig): VocabItem[] {
  const { level, dailyMinutes, allItems, knownWords, needsPracticeWords } = config;
  const sessionSize = DAILY_WORD_COUNT[dailyMinutes] || 25;
  const diffOrder = LEVEL_DIFFICULTY_ORDER[level];
  const result: VocabItem[] = [];

  const practiceItems = allItems.filter((i) => needsPracticeWords.has(i.id));
  result.push(...shuffleArray(practiceItems));

  if (result.length < sessionSize) {
    const unseen = allItems.filter((i) => !knownWords.has(i.id) && !needsPracticeWords.has(i.id));
    for (const diff of diffOrder) {
      if (result.length >= sessionSize) break;
      const pool = unseen.filter((i) => getDifficulty(i.category) === diff);
      const needed = sessionSize - result.length;
      result.push(...shuffleArray(pool).slice(0, needed));
    }
  }

  return result.slice(0, sessionSize);
}

export function sortCategoriesByLevel(
  categories: string[],
  level: UserLevel,
): string[] {
  const diffOrder = LEVEL_DIFFICULTY_ORDER[level];
  return [...categories].sort((a, b) => {
    const da = diffOrder.indexOf(getDifficulty(a));
    const db = diffOrder.indexOf(getDifficulty(b));
    return da - db;
  });
}

export function getRecommendedCategories(
  categories: string[],
  level: UserLevel,
): Set<string> {
  const primary = LEVEL_DIFFICULTY_ORDER[level][0];
  const matching = categories.filter((c) => getDifficulty(c) === primary);
  return new Set(matching.slice(0, 3));
}

export function getRecommendedAmiramLevel(level: UserLevel): number[] {
  if (level === "beginner") return [1, 2];
  if (level === "intermediate") return [3];
  return [4, 5];
}

export type GameMode = "quiz" | "flashcard" | "match";

export function suggestGameMode(sessionNumber: number): GameMode {
  const modes: GameMode[] = ["quiz", "flashcard", "match"];
  return modes[sessionNumber % modes.length];
}

export function getGameModeLabel(mode: GameMode): string {
  if (mode === "quiz") return "בחר תרגום נכון";
  if (mode === "flashcard") return "כרטיסיות";
  return "משחק התאמה";
}

export function getGameModeIcon(mode: GameMode): string {
  if (mode === "quiz") return "translate";
  if (mode === "flashcard") return "style";
  return "link";
}

export function getGameModeRoute(mode: GameMode): string {
  if (mode === "quiz") return "/practice/vocab";
  if (mode === "flashcard") return "/practice/vocab/flashcard?cat=all";
  return "/practice/vocab/match?cat=all";
}
