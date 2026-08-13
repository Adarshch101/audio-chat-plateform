/**
 * Rule-based library of targeted, concern-specific follow-up questions.
 *
 * The LLM decides the conversation, but we never want the intake to fall back
 * to generic "anything else?" probing. As soon as a main concern is collected,
 * the server matches it against this library and injects "suggestedFollowUps"
 * into the LLM context, so the assistant reliably asks scenario-relevant
 * questions (headache -> location/type/triggers, chest pain -> exertion/spread,
 * etc.) instead of repeating the same stock questions every session.
 */

interface IntakeScenario {
  /** Case-insensitive substrings matched against the user's stated concern. */
  keywords: string[];
  /** Targeted follow-up questions (English source; the LLM translates). */
  questions: string[];
}

// Order matters: more specific / multi-word keywords come first so "chest pain"
// wins over a generic "pain" match. Every scenario carries Hindi keyword aliases
// so Devanagari/Hinglish concerns (e.g. सिरदर्द, बुखार, खांसी) still match.
const SCENARIOS: IntakeScenario[] = [
  {
    keywords: ["chest pain", "chest", "सीने में दर्द", "heart"],
    questions: [
      "Does the pain happen during activity or at rest?",
      "Does it spread to your arm, neck, or jaw?",
      "Have you felt short of breath or been sweating with it?"
    ]
  },
  {
    keywords: ["headache", "head", "सिरदर्द", "सिर में दर्द", "माथे"],
    questions: [
      "Where exactly is the pain located?",
      "Is it throbbing or more of a dull ache?",
      "How often does it happen, and does light or noise make it worse?",
      "Is it worse with movement?"
    ]
  },
  {
    keywords: ["abdominal", "stomach", "belly", "tummy", "पेट दर्द", "पेट में दर्द", "पेट"],
    questions: [
      "Where exactly in your stomach is the pain?",
      "Is it cramping, burning, or sharp?",
      "Do meals make it better or worse?"
    ]
  },
  {
    keywords: ["back pain", "back", "कमर दर्द", "पीठ दर्द", "कमर", "पीठ"],
    questions: [
      "Is the pain in your upper or lower back?",
      "Does it shoot down into your leg?",
      "Is it worse when you bend or lift things?"
    ]
  },
  {
    keywords: ["fever", "temperature", "बुखार", "तापमान"],
    questions: [
      "Do you have chills or body aches with it?",
      "Have you taken a temperature reading?",
      "Is the fever constant, or does it come and go?"
    ]
  },
  {
    keywords: ["cough", "खांसी", "खाँसी"],
    questions: [
      "Is your cough dry, or are you bringing anything up?",
      "Does it get worse at night or when you lie down?",
      "Have you coughed up anything unusual?"
    ]
  },
  {
    keywords: ["sore throat", "throat", "गला", "गले में दर्द", "गले"],
    questions: [
      "Is it painful to swallow?",
      "Do you have any difficulty breathing?",
      "Do you have a fever or swollen glands?"
    ]
  },
  {
    keywords: ["skin", "rash", "itch", "त्वचा", "दाने", "खुजली"],
    questions: [
      "Where on your body is it?",
      "Is it itchy, painful, or oozing?",
      "How did it first start?"
    ]
  },
  {
    keywords: ["breath", "breathing", "breathlessness", "सांस", "साँस", "सांस लेने"],
    questions: [
      "When does it happen — during activity or at rest?",
      "Is it worse when you lie flat?",
      "Have you noticed any wheezing?"
    ]
  },
  {
    keywords: ["nausea", "vomit", "मतली", "उल्टी", "जी मिचलाना"],
    questions: [
      "How often are you feeling nauseous?",
      "Is it worse after eating?",
      "Have you been able to keep food and water down?"
    ]
  },
  {
    keywords: ["dizzy", "dizziness", "vertigo", "चक्कर", "चक्कर आना"],
    questions: [
      "When does the dizziness happen?",
      "Is it a spinning feeling or more like light-headedness?",
      "Does it come on when you change position?"
    ]
  },
  {
    keywords: ["palpitation", "heartbeat", "racing heart", "दिल की धड़कन", "धड़कन"],
    questions: [
      "When do you feel the heart racing?",
      "Is it accompanied by chest pain or shortness of breath?",
      "How long does each episode last?"
    ]
  },
  {
    keywords: ["joint", "knee", "जोड़ों", "घुटने", "जोड़ों का दर्द"],
    questions: [
      "Which joints are affected?",
      "Are they stiff in the morning or swollen?",
      "Does activity make them better or worse?"
    ]
  },
  {
    keywords: ["fatigue", "tired", "exhaustion", "थकान", "कमज़ोरी"],
    questions: [
      "How long have you been feeling this tired?",
      "Is it affecting your daily routine or sleep?",
      "Do you feel weak even after resting?"
    ]
  },
  {
    keywords: ["sleep", "insomnia", "नींद", "अनिद्रा"],
    questions: [
      "Is it hard to fall asleep or to stay asleep?",
      "How many nights per week does this happen?",
      "Do you wake up feeling rested?"
    ]
  },
  {
    keywords: ["blood pressure", "bp", "बीपी", "रक्तचाप"],
    questions: [
      "What were your most recent readings?",
      "Are you taking anything for blood pressure?",
      "Do you get dizzy or headaches with it?"
    ]
  },
  {
    keywords: ["sugar", "diabetes", "diabetic", "मधुमेह", "शुगर"],
    questions: [
      "What were your most recent sugar readings?",
      "Are you on any medication for diabetes?",
      "Have you noticed any symptoms like thirst, frequent urination, or weight change?"
    ]
  },
  {
    keywords: ["cold", "flu", "runny nose", "ज़ुकाम", "नाक बहना", "सर्दी"],
    questions: [
      "Do you have a fever or body aches with it?",
      "Is your nose congested or running?",
      "How long have you had these symptoms?"
    ]
  }
];

/**
 * Matches a user's stated main concern against the library and returns the
 * targeted follow-up questions, or null when no scenario matches.
 */
export function suggestScenarioQuestions(mainConcern: string | null | undefined): string[] | null {
  const text = (mainConcern ?? "").toLowerCase().trim();
  if (!text) return null;

  for (const scenario of SCENARIOS) {
    if (scenario.keywords.some((keyword) => text.includes(keyword))) {
      return scenario.questions;
    }
  }
  return null;
}