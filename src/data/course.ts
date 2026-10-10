import type { CourseInfo } from './types'

// checked against the AY2026-27 Term 1 course outline (CDD v7.0); the outline wins over slides
export const course: CourseInfo = {
  "courseTitle": "IS602 Spreadsheets Modeling for Decision Making (CS602/IS602, SMU MITB, AY2026-27 Term 1)",
  "instructor": "Michelle Cheong, Aldy Gunawan (Main Instructors)",
  "textbooks": [
    "Leong and Cheong. Business Modeling with Spreadsheets: Problems, Principles, and Practice, 3rd edition, McGraw-Hill (class exercises downloadable from www.mheducation.asia/olc/leong - Student Edition > Exercises > Excel 2007_13 version)",
    "Walkenbach and Banfield (2007). Excel 2007 for Dummies, Wiley",
    "Walkenbach (2004). Excel VBA Programming for Dummies, Wiley"
  ],
  "assessments": [
    {
      "component": "Class Participation",
      "weight": "15%",
      "detail": "Attendance 5%: full marks for all 10 class sessions (Weeks 1-6 and 8-11), pro-rated if you miss any. Participation 10%: questions you ask and answer in class, in the online chat or on the discussion forum, marked at the instructor's discretion."
    },
    {
      "component": "Individual Assignments",
      "weight": "15%",
      "detail": "Two take-home assignments at 7.5% each, five questions apiece on the weeks already taught; you build a model per question and hand in the Excel workbook. A1 is released in Week 2 and due in Week 5; A2 is released in Week 5 and due in Week 9. Softcopy only, uploaded to the eLearn assignment box before class starts on the due day. Resubmission is allowed but only the last upload and its timestamp count; late work loses marks. Strictly individual work, and no generative AI tools."
    },
    {
      "component": "Online Quizzes",
      "weight": "10%",
      "detail": "Four eLearn quizzes at 2.5% each; every quiz draws 10 questions at random from a bank, so classmates may get different questions. Topics: Spreadsheet Engineering (Week 2), Lookup & Optimization Modeling (Week 3), Financial Functions & Modeling (Week 4), Macros & VBA (Week 9). Each quiz stays open for 7 days."
    },
    {
      "component": "Group Project",
      "weight": "30%",
      "detail": "Teams of 5-6, formed by the end of Week 2. Proposal 5% (Week 8; only the written proposal is graded, not the presentation; at most 5 pages with at least one influence diagram and black-box model, one trade-off analysis and one sensitivity analysis). Final presentation 5% (Week 11; slides plus a short workbook demo, order drawn by lot). Excel workbook 10% (Week 11; no password protection, no fancy GUI, macros only where needed). Final report 5% (Week 11; at most 10 pages, shorter preferred). Peer evaluation 5% (Week 11; rate each teammate from 1% to 5%, and anyone you leave unrated gets 5%). A project can be exploratory modelling, data analysis with decision optimisation, or a mix of both."
    },
    {
      "component": "Final Exam",
      "weight": "30%",
      "detail": "Open book, 2 hours, 2 questions set as business problems, held in the exam week after Week 11. You build the model, run the computations and enter the numbers or formulas in the template workbook provided; only that submitted template is marked. Printed material and files already on your laptop are allowed; live internet access is not."
    }
  ],
  "schedule": [
    {
      "week": "W1",
      "topic": "Introduction to Spreadsheet",
      "note": "Class exercises: Retail Gasoline, Community Water Tank (ESG) and Data Centre Assets, each backed by a recorded revision video."
    },
    {
      "week": "W2",
      "topic": "Spreadsheet Engineering",
      "note": "Model building: influence diagram, black-box view, spreadsheet model. Exercises: Invest in Education (ESG), Inkjet Printer (Goal Seek, Solver, trade-off and sensitivity analysis). Due: Online Quiz 1. Assignment 1 released; project teams set by the end of the session."
    },
    {
      "week": "W3",
      "topic": "Lookup & Optimization Modelling",
      "note": "Lookup functions, Data Table and optimisation with Solver. Exercises: Echo Office Supplies, Casino Hotel, Data Lookup; the revision videos add XLOOKUP and IFS. Due: Online Quiz 2."
    },
    {
      "week": "W4",
      "topic": "Financial Functions & Modeling",
      "note": "Financial functions and circular references. Exercises: Time Value, Charity Donation (ESG), Black Scholes (option pricing with a spin button). Due: Online Quiz 3."
    },
    {
      "week": "W5",
      "topic": "Monte Carlo Simulation",
      "note": "Simulation with RAND and RANDBETWEEN, distribution functions, Data Table for repeated runs. Exercises: Data Sim, Monty Hall, Village Water (ESG). Due: Assignment 1. Assignment 2 released."
    },
    {
      "week": "W6",
      "topic": "Queuing Model & VBA",
      "note": "Date and time handling, discrete time-based simulation, basic VBA for managing records. Exercises: Call Center, Record Management (VBA)."
    },
    {
      "week": "W7",
      "topic": "Break Week",
      "note": "No class."
    },
    {
      "week": "W8",
      "topic": "Project Proposal Presentation",
      "note": "Due: project proposal (5%). The written proposal is graded; the presentation is not."
    },
    {
      "week": "W9",
      "topic": "Macros & VBA",
      "note": "Macro recording, VBA programming, date and time. Exercises: Timer/Clicker and Intro to VBA. Assignment 2 and Online Quiz 4 are due this week."
    },
    {
      "week": "W10",
      "topic": "Decision Support",
      "note": "PivotTables, AutoFilters and Advanced Filters. Exercises: Grand Grocery (PivotTable), Offshore Development (Advanced Filter)."
    },
    {
      "week": "W11",
      "topic": "Project Presentation",
      "note": "Final presentations (order drawn by lot) and peer evaluation. Due, unzipped: the Excel workbook, final report, presentation slides and research forms."
    },
    {
      "week": "Exam",
      "topic": "Final Exam (exam week)",
      "note": "Open book, 2 hours, 2 questions; answers go into the Excel template provided. The outline lists no calendar dates, so check eLearn for the exam slot."
    }
  ],
  "notes": [
    "Course focus: building decision models in Excel and using them for business analysis, weighing trade-offs and testing how sensitive results are to uncertainty and risk, across IT, operations, finance and ESG decisions. The emphasis is on the craft of modelling rather than on memorising ready-made models.",
    "Prerequisites: basic Excel, statistics and mathematics are assumed; if you have never used Excel, work through Microsoft's free online material first. Course area: TECH [Core], 1 CU, graded.",
    "Course structure: 10 class sessions in all, made up of 8 hands-on lessons (Weeks 1-6, 9 and 10) covering 20 class exercises with recorded revision videos, plus 2 project sessions (proposal in Week 8, final presentations in Week 11). Week 7 is the break week and the exam comes after Week 11.",
    "Exam format (from the outline and the sample papers): OPEN BOOK, 2 hours, 2 questions. The 2017-18 Term 2 sample (Sample4, set for the related course IS102) had Q1 = 12 marks and Q2 = 13 marks, 25 in total. A laptop is allowed but every network connection must be switched off, and there are no enquiries during the paper, so state any assumptions you make. Questions are realistic business scenarios (for example, choosing a cost-effective cloud-storage policy for a video platform) where you fill tables of formulas at exact cell references in a template workbook; only the submitted template with your answers is marked.",
    "Sample exam papers available with solutions: AY2014-15 Term 1, AY2016-17 Term 2, and 2017-18 Term 2 (each with question docx/pdf plus solution Excel workbooks).",
    "Example past project topics: 'Changi Airport T5 Payback', 'Post-COVID Recovery for Singapore Airlines', 'Team Singapore in Olympics'.",
    "Ground rules: NO Generative AI tools (ChatGPT, Gemini, DeepSeek etc.) for assignments - marks deducted if detected; assignments are strictly individual work (no discussing or referring to others' work); multiple submissions allowed but only the last one counts and is time-stamped; late submissions penalized; submit softcopies only via eLearn.",
    "Project tips from the outline: workbook must be free of password protection; emphasis on modeling the problem and performing the analyses; no need for fanciful GUI - a neat, user-friendly model suffices; use macros only when necessary; no documentation needed inside the Excel workbook; final report max 10 pages (shorter preferred); proposal max 5 pages with influence diagram, black-box model, at least one trade-off and one sensitivity analysis.",
    "Assignment 1 (AY2026-27 T1) is worth 42 marks, due Week 5, submitted as <YourName>_A1.xlsx to eLearn Dropbox; questions are business modeling problems (e.g. product margin & profit analysis across regions using functions like SMALL and MINIFS).",
    "Instructors may conduct lessons online (Zoom/Teams) as part of Digital Readiness for Teaching and Learning; schedule mirrors the face-to-face timetable unless stated otherwise."
  ]
}
