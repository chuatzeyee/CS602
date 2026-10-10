export type TopicSection = {
  heading: string
  points: readonly string[]
}

export type Topic = {
  id: string
  title: string
  sections: readonly TopicSection[]
}

export type Session = {
  id: string
  title: string
  subtitle?: string
  topics: readonly Topic[]
}

export type Definition = {
  term: string
  definition: string
  example?: string
  source: string
}

export type QuizQuestion = {
  id: string
  topic: string
  question: string
  options: readonly string[]
  answerIndex: number
  explanation: string
}

export type LabStep = {
  title: string
  explanation: string
  code?: string
}

export type Lab = {
  id: string
  week: string
  title: string
  overview: string
  steps: readonly LabStep[]
  takeaways: readonly string[]
}

export type Assessment = {
  component: string
  weight: string
  detail?: string
}

export type ScheduleItem = {
  week: string
  topic: string
  note?: string
}

export type CourseInfo = {
  courseTitle: string
  instructor?: string
  assessments: readonly Assessment[]
  schedule: readonly ScheduleItem[]
  textbooks?: readonly string[]
  notes: readonly string[]
}
