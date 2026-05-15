/**
 * SampleVaultService - Creates a sample vault on the device for testing
 * Writes all sample markdown files to device storage and sets the vault
 */

import RNFS from 'react-native-fs';
import {VaultService} from './VaultService';
import {VaultIndexService} from './VaultIndexService';
import {Logger} from '../utils/Logger';

const SAMPLE_VAULT_DIR = `${RNFS.DocumentDirectoryPath}/sample-vault`;

// Map of relative path -> file content
const SAMPLE_FILES: Record<string, string> = {
  'Personal/Journal/2024/2024-01-15 Morning Reflection.md': `---
date: 2024-01-15
tags: [journal, morning, reflection, goals]
mood: optimistic
---

# Morning Reflection - January 15, 2024

Started the day with a 20-minute meditation session. Feeling clear-headed and ready to tackle the week.

## Today's Intentions
- Focus on the LocalOS project - need to implement the memory search feature
- Gym at 6 PM (leg day!)
- Read 30 pages of "Atomic Habits"

## Gratitude
- Grateful for the sunny weather after a week of rain
- My team's support on the recent sprint
- Coffee. Always coffee.

## Random Thought
Why do we call it "pair programming" when we're usually staring at one screen? Should be "dual debugging" or something.

---
*"The secret of getting ahead is getting started." - Mark Twain*
`,

  'Personal/Journal/2024/2024-03-22 Career Thoughts.md': `---
date: 2024-03-22
tags: [journal, career, goals, tech]
mood: contemplative
---

# Career Thoughts - March 22, 2024

Had a really interesting conversation with Sarah today about career progression. She made some great points about specialization vs. generalization in tech.

## Current State
- Been at TechCorp for 2 years now
- Mostly working on React Native mobile development
- Getting comfortable, maybe too comfortable?

## Thoughts on Next Steps
1. **Deep Dive into AI/ML** - Everyone's talking about it, but I want to actually understand it, not just use APIs
2. **Open Source Contributions** - LocalOS is going well, but I should contribute to established projects too
3. **Speaking/Teaching** - Maybe submit a talk to React Native EU?

## Skills to Develop
- System design (for senior engineer interviews)
- AI/ML fundamentals
- Better at TypeScript advanced patterns
- DevOps/Infrastructure (my weak spot)

## Action Items
- [ ] Enroll in Andrew Ng's ML course
- [ ] Set up a personal blog
- [ ] Attend at least 2 meetups per month
- [ ] Read "Designing Data-Intensive Applications"

The imposter syndrome is real today, but I know I'm making progress. Just need to trust the process.
`,

  'Personal/Journal/2024/2024-10-10 Travel Dreams.md': `---
date: 2024-10-10
tags: [journal, travel, dreams, planning]
mood: excited
---

# Travel Dreams - October 10, 2024

Can't stop thinking about my next trip. The Japan visit last year was life-changing, and now I'm itching to explore more of Asia.

## Trip Ideas for 2025
1. **Vietnam** - Ha Long Bay looks absolutely stunning in photos
   - Duration: 2 weeks
   - Budget: ~$2000
   - Best time: March-April

2. **Thailand** - Bangkok street food tour + island hopping
   - Already have connections there through work
   - Could work remotely for a week

3. **South Korea** - Seoul's tech scene + traditional culture
   - Tech meetups would be amazing
   - Cherry blossom season!

## Travel Fund Status
- Current savings: $3,500
- Monthly contribution: $300
- Target for Vietnam trip: $5,000
- Timeline: March 2025 ✈️

## Must Do Before Traveling
- [ ] Renew passport (expires in 8 months!)
- [ ] Get travel insurance
- [ ] Learn basic Vietnamese phrases
- [ ] Research coworking spaces in Hanoi

Feeling grateful that I have a job that allows remote work. The digital nomad lifestyle is calling...
`,

  'Personal/Health/Fitness Goals.md': `---
tags: [health, fitness, goals, workout]
created: 2024-01-01
updated: 2024-10-15
---

# Fitness Goals 2024

## Current Stats (Oct 2024)
- Weight: 165 lbs (down from 175!)
- Gym frequency: 4x per week
- Running: 5K in 26 minutes

## 2024 Goals
- [x] Lose 10 lbs ✅ (achieved in July!)
- [x] Run 5K under 27 minutes ✅
- [ ] Bench press 185 lbs (currently at 165)
- [ ] 10 pull-ups in a row (at 7 now)
- [ ] Run a 10K race

## Weekly Routine
**Monday** - Chest & Triceps
- Bench press: 4x8
- Incline dumbbell press: 3x10
- Cable flyes: 3x12
- Tricep dips: 3x12

**Wednesday** - Back & Biceps
- Pull-ups: 4xMax
- Barbell rows: 4x8
- Lat pulldowns: 3x10
- Hammer curls: 3x12

**Friday** - Legs & Shoulders
- Squats: 4x8
- Romanian deadlifts: 3x10
- Overhead press: 4x8
- Lateral raises: 3x12

**Sunday** - Running/Cardio
- 5K run or HIIT

## Notes
- Consistency is key - missed only 3 workouts this quarter
- Pre-workout meal matters - banana + coffee = 💪
- Need to focus more on stretching and mobility work
- Should track macros better

## Resources
- [[Meditation Practice]] - helps with recovery
- Training app: Strong
- Running app: Strava
`,

  'Personal/Health/Meditation Practice.md': `---
tags: [health, meditation, mindfulness, mental-health]
created: 2023-06-15
---

# Meditation Practice

## Why I Started
Started meditating in June 2023 after reading "The Miracle of Mindfulness". Was dealing with work stress and needed a way to reset.

## Current Practice
- **Morning**: 15-20 minutes, right after waking up
- **Technique**: Mostly breath-focused meditation
- **App**: Headspace (occasionally use Insight Timer)
- **Streak**: 127 days! 🎉

## Benefits I've Noticed
1. Better focus during coding sessions
2. Less reactive to stressful situations
3. Improved sleep quality
4. More aware of thought patterns
5. Actually can sit still for more than 5 minutes now

## Techniques I Use
- **Breath Counting** - Count 1-10, repeat
- **Body Scan** - Progressive relaxation
- **Loving-Kindness** - When feeling irritable
- **Walking Meditation** - During lunch breaks

## Challenges
- Hardest in the beginning (first 2 weeks were rough)
- Easy to skip when traveling
- Still get distracted by thoughts about code/work

## Resources
- Book: "The Miracle of Mindfulness" by Thich Nhat Hanh
- Book: "10% Happier" by Dan Harris
- Headspace app

## Notes
- It's called a "practice" for a reason - it's okay to not be perfect
- Even 5 minutes is better than nothing
- Works best when paired with [[Fitness Goals|regular exercise]]
`,

  'Personal/Hobbies/Photography/Camera Gear.md': `---
tags: [photography, gear, equipment, camera]
updated: 2024-09-20
---

# Camera Gear

## Current Setup

### Body
**Sony A7 III** (purchased Dec 2022)
- Full-frame mirrorless
- Great for travel and street photography
- Battery life could be better, carry 3 batteries

### Lenses
1. **Sony 24-70mm f/2.8 GM** - My workhorse lens
   - Perfect for travel and everyday shooting

2. **Sony 85mm f/1.8** - Portrait lens
   - Amazing bokeh
   - Surprisingly affordable

3. **Tamron 28-200mm f/2.8-5.6** - Travel zoom
   - Ultra versatile
   - Used extensively in Japan

### Accessories
- Peak Design Everyday Backpack
- Peak Design Capture Clip
- Manfrotto carbon fiber tripod
- ND filters (for long exposures)

## Wishlist
- [ ] Sony 16-35mm f/2.8 GM (for landscapes)
- [ ] DJI Mini 4 Pro (drone photography!)

## Film Photography
Recently got into film! Picked up a vintage **Canon AE-1** from eBay.
- Using Kodak Portra 400
- So much more intentional than digital

## Photography Goals
- Take at least one photo every day (current streak: 45 days)
- Print and frame my favorite shots
- Take a proper photography course (composition theory)
`,

  'Personal/Hobbies/Cooking/Recipe Collection.md': `---
tags: [cooking, recipes, food]
---

# Recipe Collection

## Go-To Recipes

### Breakfast
**Perfect Scrambled Eggs**
- Low heat, butter, constant stirring
- Add cream cheese at the end
- Salt AFTER cooking

**Overnight Oats**
- Oats + milk + chia seeds
- Top with banana, berries, honey
- Meal prep Sunday nights

### Dinner

**Garlic Butter Salmon**
\`\`\`
Ingredients:
- 2 salmon fillets
- 4 cloves garlic, minced
- 3 tbsp butter
- Lemon juice
- Salt, pepper, paprika

Method:
1. Season salmon
2. Sear skin-side down 4 min
3. Flip, add garlic butter, 3 min
4. Squeeze lemon, serve
\`\`\`

**Simple Pasta Aglio e Olio**
- Garlic, olive oil, red pepper flakes, parsley
- Ready in 15 minutes
- Learned this in [[Europe/Italy/Rome|Rome]]!

**Thai Basil Chicken (Pad Krapow)**
- Discovered in [[Travel/Asia/Thailand/Bangkok Food Guide|Bangkok]]
- Holy basil is KEY (different from regular basil!)
- Serve over rice with fried egg

## Cooking Goals
- [ ] Master sourdough bread
- [ ] Learn proper knife skills
- [ ] Host a dinner party

## Resources
- Joshua Weissman (YouTube)
- Serious Eats website
- "Salt, Fat, Acid, Heat" by Samin Nosrat
`,

  'Personal/Contacts/Professional Network.md': `---
tags: [contacts, networking, professional, career]
---

# Professional Network

## Tech Community

### Sarah Chen - Senior Engineer @ Meta
- **Met**: React Native EU 2022
- **Expertise**: React Native, iOS performance
- **Notes**: Great mentor, helped with LocalOS architecture decisions
- **Last contact**: Oct 2024 - coffee chat about career progression

### Marcus Rodriguez - CTO @ StartupXYZ
- **Met**: Previous job, worked together 2020-2022
- **Expertise**: System design, scaling
- **Notes**: Would be great reference for senior positions

### Priya Patel - ML Engineer @ Google
- **Met**: AI/ML meetup group
- **Expertise**: LLMs, embeddings, vector search
- **Notes**: Consulting on LocalOS memory features

### James Kim - Product Manager @ TechCorp
- **Relationship**: Current colleague
- **Expertise**: Product strategy, user research
- **Meeting**: Weekly 1-on-1s

## Networking Goals
- [ ] Attend at least 1 conference per year
- [ ] Write recommendation for Sarah (she asked last month)
- [ ] Organize a local React Native workshop

## Notes
- Always follow up within 48 hours after meeting someone
- Provide value first before asking for help
`,

  'Personal/Preferences.md': `---
title: Personal Preferences
tags: [personal, preferences]
private: true
created: 2024-12-26T08:00:00Z
updated: 2025-01-21T10:15:00Z
---

# My Preferences

## Development

- **Mobile Framework:** Prefer React Native over Flutter
- **Language:** TypeScript > JavaScript always
- **Style:** Functional programming over OOP
- **Testing:** TDD when possible, at least unit tests

## Tools & Setup

### Editor
- **Primary:** VS Code
- **Extensions:** ESLint, Prettier, GitLens
- **Theme:** Dark+ (default dark)
- **Font:** Fira Code with ligatures

### Notes
- **Obsidian** for knowledge management
- Daily notes for journaling
- Zettelkasten method
- Weekly reviews

## Work Preferences

- **Time:** Early morning (6am-10am) for deep work
- **Music:** Instrumental (lo-fi, classical) or silence
- **Async first:** Written communication preferred

## Goals

### Short-term (2025 Q1)
- [ ] Complete LocalOS memory system
- [ ] Launch beta version
- [ ] Write 3 technical blog posts

#personal #preferences #productivity
`,

  'Personal/Reading List.md': `---
tags: [books, learning, reading]
---

# Reading List

## Currently Reading
- "Designing Data-Intensive Applications" by Martin Kleppmann
- "The Pragmatic Programmer" (re-reading)

## Want to Read
- [ ] "Building Mobile Apps at Scale"
- [ ] "Staff Engineer" by Will Larson
- [ ] "A Philosophy of Software Design"
- [ ] "System Design Interview" by Alex Xu
- [ ] "An Elegant Puzzle" by Will Larson

## Completed
- ✅ "Clean Code" by Robert Martin
- ✅ "React Native in Action"
- ✅ "Hands-On Machine Learning"
- ✅ "Atomic Habits" by James Clear - see [[Media/Books/Book-Notes/Atomic Habits|notes]]
- ✅ "Deep Work" by Cal Newport
- ✅ "The Pragmatic Programmer"

## Notes
- Track via Goodreads
- Take notes in Obsidian for non-fiction
- Monthly reading goal: 2 books

See also: [[Media/Books/Favorites|Favorite Books]]
`,

  'Work/Career/Career Goals 2024.md': `---
tags: [career, goals, planning, growth]
created: 2024-01-01
updated: 2024-10-20
---

# Career Goals 2024

## Big Picture Vision
Become a senior engineer with expertise in mobile development and AI/ML integration. Want to work on products that have real impact on people's daily lives.

## 2024 Objectives

### Technical Skills
- [x] Master React Native advanced patterns ✅
- [x] Ship LocalOS v1.0 ✅ (September!)
- [ ] Complete Andrew Ng's ML Specialization (60% done)
- [ ] Contribute to 3 major open source projects (1/3 complete)
- [ ] Learn system design patterns (reading DDIA now)

### Leadership & Communication
- [ ] Give a tech talk at a meetup (drafted: "On-Device AI in React Native")
- [ ] Mentor a junior engineer
- [ ] Write 12 technical blog posts (currently at 5)

### Career Progression
- [ ] Promotion to Senior Engineer (Q4 target)
- [ ] Build professional brand (LinkedIn, Twitter, GitHub)
- [ ] Expand network (attend 2 conferences this year)

## Reflection
The biggest growth this year has been in ownership and initiative. I'm no longer waiting for tasks to be assigned - I'm identifying problems and solving them. That's the senior engineer mindset.
`,

  'Work/Jobs/Current-TechCorp/Projects.md': `---
tags: [work, techcorp, projects, mobile]
---

# Current Projects @ TechCorp

## Mobile App Redesign (Primary Project)

### Overview
Migrating existing native iOS/Android apps to React Native
- **Timeline**: Jan 2024 - Dec 2024 (Phase 2 of 3)
- **Team**: 4 engineers (I'm tech lead)
- **Users**: 2M+ monthly active users

### Current Status (Oct 2024)
- Phase 1: Home feed & navigation ✅ (shipped July)
- Phase 2: User profiles & settings (in progress, 70% complete)
- Phase 3: Messaging & real-time features (starting Nov)

### Wins
- 30% reduction in crash rate
- Feature parity with native apps
- Positive user feedback on new UI

### Learnings
- Importance of incremental migration (big bang would have failed)
- Performance testing from day 1
- Communication is 50% of the job as tech lead
`,

  'Work/Jobs/Past/Asia-Remote-2021/Experience.md': `---
tags: [work, remote, asia, travel, digital-nomad]
dates: 2021-03-01 to 2021-08-31
---

# Digital Nomad Experience - Asia 2021

## Overview
6-month remote work stint across Asia while working for StartupXYZ
- **Role**: Full-stack Engineer
- **Countries**: Thailand, Vietnam, Japan

## The Journey

### Thailand (March - April 2021)
- Stayed in Bangkok (Sukhumvit area)
- Coworking: HUBBA Thailand
- Cost: ~$1500/month all-in
- See: [[Travel/Asia/Thailand/Bangkok Food Guide|Bangkok Food Guide]]

### Vietnam (May - June 2021)
- Hanoi Old Quarter, then Ho Chi Minh City
- Coffee culture is next level
- Motorbike chaos is real

### Japan (July - August 2021)
- Tokyo, Shibuya - 6 weeks
- Most expensive stop but worth it
- See: [[Travel/Asia/Japan/Tokyo 2023|Tokyo Notes]]

## Impact on Career
- Learned async communication (crucial skill)
- Became more independent and self-directed
- Built global network of other nomads
- Led to current remote flexibility at TechCorp

This experience shaped my preference for remote-friendly companies. The freedom was life-changing.
`,

  'Work/Projects/LocalOS/Feature Ideas.md': `---
tags: [localos, features, ideas, roadmap]
---

# LocalOS Feature Ideas

## MVP (v1.0) - SHIPPED ✅
- [x] Basic chat interface
- [x] Local LLM integration (llama.cpp)
- [x] Tool calling support
- [x] Memory system (core + archival)
- [x] Model management

## v1.1 - In Progress
- [ ] Vector embeddings for semantic search
- [ ] Improved memory search
- [ ] Better model download UX
- [ ] Vault integration for notes

## Future Features

### Memory & Knowledge
- [ ] Auto-summarization
- [ ] Smart tagging
- [ ] Memory clustering
- [ ] Conversation search

### Tools & Integrations
- [ ] Calendar integration
- [ ] Email tools
- [ ] Task management
- [ ] Web browsing
- [ ] Document analysis

### UX Improvements
- [ ] Dark mode
- [ ] Conversation threads
- [ ] Markdown rendering
- [ ] Share extension

## Inspiration From
- **Letta** - Memory architecture (core + archival)
- **Obsidian** - Local-first, markdown notes
- **Perplexity** - Search integration

## Notes
- Focus on privacy-first approach (key differentiator)
- Mobile-first (most apps are desktop-focused)
- Open source everything (build community)
`,

  'Travel/Asia/Japan/Tokyo 2023.md': `---
tags: [travel, japan, tokyo, asia]
dates: 2023-05-10 to 2023-05-24
rating: 10/10
---

# Tokyo Trip - May 2023

## Trip Overview
2 weeks in Tokyo - my first time in Japan. Life-changing experience.

**Duration**: May 10-24, 2023
**Budget**: $3,500 (flights, hotel, food, activities)

## Highlights

### Must-See Places
1. **Senso-ji Temple** (Asakusa) - Early morning visit to avoid crowds
2. **Shibuya Crossing** - Never got old
3. **Meiji Shrine** - Peaceful oasis, saw a traditional wedding!
4. **TeamLab Borderless** - Mind-blowing digital art museum

### Food Experiences
- **Best ramen**: Ichiran (solo dining booths!)
- **Best sushi**: Sushi Dai at Toyosu Market (2-hour wait worth it)
- **Best coffee**: Bear Pond Espresso in Shimokitazawa

### Neighborhoods Explored
- **Shibuya**: Modern, young, chaotic energy
- **Shinjuku**: Neon lights, Golden Gai bars
- **Shimokitazawa**: Hip cafes, vintage shops (my favorite!)

## Practical Tips
- Suica card is essential
- Cash is still king in many places
- Trains stop at midnight (plan accordingly!)
- Tipping is NOT done

## Cost Breakdown
- Flights: $800 | Accommodation: $900 | Food: $700
- Activities: $400 | Transport: $200 | Shopping: $500
- **Total**: ~$3,500

## Next Japan Trip Ideas
- [ ] Kyoto (temples, traditional culture)
- [ ] Osaka (food scene!)
- [ ] Mount Fuji climb

**Would I go back?** Already planning my return for 2025!
`,

  'Travel/Asia/Thailand/Bangkok Food Guide.md': `---
tags: [travel, thailand, bangkok, food, street-food]
---

# Bangkok Food Guide

My ultimate guide to eating in Bangkok after 6 weeks there in 2021.

## Must-Try Dishes

**Pad Thai** - Best: Thip Samai (near Khao San), 50-100 baht

**Som Tam (Papaya Salad)** - Spicy, sweet, sour, salty all at once

**Khao Soi** - Creamy coconut curry with crispy noodles on top

**Mango Sticky Rice** - Only in mango season (March-June), Mae Varee is best

## Best Areas for Street Food

**Chinatown (Yaowarat Road)** - My favorite, opens evenings

**Or Tor Kor Market** - Cleanest, higher quality

**Chatuchak Weekend Market** - Huge, get there early (8am)

## Restaurants

**Jay Fai** (Michelin-starred) - Famous crab omelette, expect 2-hour wait

**Err Urban Rustic Thai** - Creative takes on classics, 300-400 baht/person

## Food Tips

1. Street food is safe - look for busy stalls
2. Eat where locals eat
3. Cash only for most vendors
4. "Pet nit noi" = a little spicy

## Warning
You WILL gain weight. The food is too good. Worth it.

Related: [[Personal/Hobbies/Cooking/Recipe Collection|My attempts to recreate Thai food at home]]
`,

  'Travel/Bucket List.md': `---
tags: [travel, bucket-list, planning, dreams]
---

# Travel Bucket List

## Asia 🌏

### Completed ✅
- [x] Japan - Tokyo (2023)
- [x] Thailand - Bangkok, Chiang Mai (2021)
- [x] Vietnam - Hanoi, HCMC (2021)

### Planned
- [ ] **Vietnam** - Ha Long Bay (2025 goal!)
- [ ] **South Korea** - Seoul, Busan
- [ ] **Indonesia** - Bali, Java
- [ ] **Nepal** - Everest Base Camp trek

## Europe 🇪🇺

### Completed ✅
- [x] France - Paris (2022)
- [x] Italy - Rome, Florence (2019)

### Planned
- [ ] **Spain** - Barcelona, San Sebastian
- [ ] **Portugal** - Lisbon, Porto
- [ ] **Iceland** - Northern lights, nature
- [ ] **Norway** - Fjords

## Americas 🌎
- [ ] National Parks road trip (Yellowstone, Yosemite, Grand Canyon)
- [ ] **Peru** - Machu Picchu
- [ ] **Colombia** - Cartagena, Medellin

## Travel Goals

### By 2025
- Visit 5 more countries
- Complete Vietnam trip

### By 2030
- Visit 30+ countries total (currently at 12)
- All continents except Antarctica

## Travel Fund
Current: $3,500 | Monthly: $300 | 2025 Vietnam goal: $5,000

See: [[Personal/Journal/2024/2024-10-10 Travel Dreams|Travel Dreams Journal]]
`,

  'Media/Books/Favorites.md': `---
tags: [books, reading, favorites]
---

# Favorite Books

## All-Time Top 10

1. **Project Hail Mary** - Andy Weir ⭐⭐⭐⭐⭐ (read in 2 days!)
2. **Atomic Habits** - James Clear ⭐⭐⭐⭐⭐ — [[Book-Notes/Atomic Habits|notes]]
3. **The Phoenix Project** - Gene Kim ⭐⭐⭐⭐⭐ (DevOps as thriller)
4. **Deep Work** - Cal Newport ⭐⭐⭐⭐⭐
5. **The Martian** - Andy Weir ⭐⭐⭐⭐⭐
6. **Sapiens** - Yuval Noah Harari ⭐⭐⭐⭐⭐
7. **Shoe Dog** - Phil Knight ⭐⭐⭐⭐⭐
8. **The Three-Body Problem** - Cixin Liu ⭐⭐⭐⭐⭐
9. **Educated** - Tara Westover ⭐⭐⭐⭐⭐
10. **Accelerate** - Nicole Forsgren ⭐⭐⭐⭐⭐

## Books That Changed My Life

**Atomic Habits** → Built consistent workout routine
**Deep Work** → Shaped how I structure my work day
**The Phoenix Project** → Changed my approach to systems and teamwork
**The Pragmatic Programmer** → Made me a better engineer

## Reading Goals 2024
- [ ] Read 24 books (2 per month) — progress: 18/24
- [x] Join a book club ✅ (tech book club at work)
`,

  'Media/Books/Book-Notes/Atomic Habits.md': `---
title: Atomic Habits
author: James Clear
tags: [books, notes, habits, self-improvement]
rating: 5/5
completed: 2023-02-15
---

# Atomic Habits - James Clear

## Summary
Small changes compound over time. Focus on systems, not goals.

## Key Concepts

### The Habit Loop
1. **Cue** - Trigger that initiates behavior
2. **Craving** - Motivational force
3. **Response** - Actual habit you perform
4. **Reward** - End goal of every habit

### The Four Laws of Behavior Change

**Make it Obvious** — implementation intentions, habit stacking, environment design

**Make it Attractive** — pair things you want to do with things you need to do

**Make it Easy** — reduce friction, Two-Minute Rule

**Make it Satisfying** — immediate rewards, habit tracker, never miss twice

## Favorite Quotes

> "You do not rise to the level of your goals. You fall to the level of your systems."

> "Every action you take is a vote for the type of person you wish to become."

> "You don't need to be perfect, you just need to be consistent."

## My Applications

**Morning Routine** (Habit Stacking)
Wake up → Make bed → Meditate → Workout → Shower → Coffee

**Fitness** (2-Minute Rule)
"Just put on gym clothes" → Usually leads to full workout
Result: Went from 1x/week to 4x/week

**Coding** (Implementation Intentions)
"After morning coffee, I will code for 30 minutes on LocalOS"
Built LocalOS v1.0 with this approach

## Rating: ⭐⭐⭐⭐⭐
One of the few self-help books that's actually practical.
`,

  'Media/Movies/All-Time Favorites.md': `---
tags: [movies, favorites, film, entertainment]
---

# All-Time Favorite Movies

## Top 10

1. **Inception** (2010) - Nolan ⭐⭐⭐⭐⭐ — rewatched 5+ times
2. **The Shawshank Redemption** (1994) ⭐⭐⭐⭐⭐
3. **The Matrix** (1999) ⭐⭐⭐⭐⭐ — revolutionary
4. **Interstellar** (2014) - Nolan ⭐⭐⭐⭐⭐ — cried in theater
5. **Parasite** (2019) - Bong Joon-ho ⭐⭐⭐⭐⭐
6. **The Social Network** (2010) ⭐⭐⭐⭐⭐ — hits different as a developer
7. **Mad Max: Fury Road** (2015) ⭐⭐⭐⭐⭐ — best pure action film
8. **Arrival** (2016) - Villeneuve ⭐⭐⭐⭐⭐
9. **Everything Everywhere All at Once** (2022) ⭐⭐⭐⭐⭐
10. **Spider-Man: Into the Spider-Verse** ⭐⭐⭐⭐⭐

## Favorite Directors
- **Christopher Nolan** - Inception, Interstellar, The Dark Knight
- **Denis Villeneuve** - Arrival, Blade Runner 2049, Dune
- **David Fincher** - The Social Network, Gone Girl, Se7en
- **Bong Joon-ho** - Parasite, Memories of Murder

## Notes
- Goal: Watch 52 movies/year — current 2024: 38/52
- Letterboxd for tracking
`,

  'Knowledge/Quotes.md': `---
tags: [quotes, wisdom, inspiration]
---

# Favorite Quotes

## Life & Philosophy

> "The secret of getting ahead is getting started." — Mark Twain

> "We are what we repeatedly do. Excellence, then, is not an act, but a habit." — Aristotle

> "The best time to plant a tree was 20 years ago. The second best time is now." — Chinese Proverb

## Work & Productivity

> "You do not rise to the level of your goals. You fall to the level of your systems." — James Clear

> "Focus is a matter of deciding what things you're not going to do." — John Carmack

> "Make it work, make it right, make it fast." — Kent Beck

## Technology & Engineering

> "Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke

> "The best code is no code at all." — Jeff Atwood

> "Premature optimization is the root of all evil." — Donald Knuth

> "First, solve the problem. Then, write the code." — John Johnson

## Learning & Growth

> "I have not failed. I've just found 10,000 ways that won't work." — Thomas Edison

> "The more I learn, the more I realize how much I don't know." — Albert Einstein

## Minimalism & Focus

> "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away." — Saint-Exupéry

> "You can do anything, but not everything." — David Allen

## Tech Industry

> "Stay hungry, stay foolish." — Steve Jobs

> "Ideas are easy. Implementation is hard." — Guy Kawasaki

> "The best way to predict the future is to invent it." — Alan Kay

## Notes
- Personal mantra: "Systems over goals"
- Quotes I revisit when feeling stuck
`,

  'Projects/LocalOS.md': `---
title: LocalOS Project
tags: [project, ai, react-native, localos]
status: in-progress
priority: high
created: 2025-01-01T10:00:00Z
updated: 2025-01-24T14:30:00Z
---

# LocalOS Project

Building a privacy-first AI chat app that runs entirely on-device.

## Overview

LocalOS is a React Native mobile app that provides an AI assistant powered by local LLM inference. No data leaves your device.

## Current Features

- ✅ Local LLM inference using llama.rn
- ✅ Function calling with tools (datetime, web search)
- ✅ Streaming responses
- ✅ Model management
- ✅ Chat history

## Planned Features

- [ ] Memory system with vector search
- [ ] Obsidian integration for knowledge base
- [ ] Multi-modal support (images, audio)
- [ ] Graph view of linked memories
- [ ] Conversation summarization

## Technical Stack

**Frontend:** React Native 0.82, TypeScript, React Hooks

**AI/ML:** llama.rn for inference, SQLite for vector storage

**Storage:** @op-engineering/op-sqlite, react-native-fs, AsyncStorage

## Related Notes

- [[React Native Best Practices]]
- [[Vector Search Overview]]
- [[AI Model Selection Guide]]

#project #ai #react-native #mobile
`,

  'Development/React Native Best Practices.md': `---
title: React Native Best Practices
tags: [react-native, development, best-practices]
category: Development
importance: high
created: 2025-01-08T09:00:00Z
updated: 2025-01-23T11:20:00Z
---

# React Native Best Practices

Key principles to follow when building React Native apps.

## Performance Optimization

### Lists and ScrollViews
- Use \`FlatList\` for long lists instead of \`ScrollView\`
- Implement \`getItemLayout\` for fixed-height items
- Enable \`removeClippedSubviews\` on Android

### Avoid Inline Functions

Bad: \`<Button onPress={() => handlePress(item.id)} />\`

Good:
\`\`\`typescript
const handlePress = useCallback(() => {
  doSomething(item.id);
}, [item.id]);
\`\`\`

### Memoization
- Use \`useMemo\` for expensive calculations
- Use \`useCallback\` for function references
- Use \`React.memo\` for component optimization

## State Management

- Keep component state minimal and focused
- Context API for simple global state
- Redux for complex state logic or time-travel debugging

## Code Organization

\`\`\`
src/
├── components/     # Reusable UI components
├── screens/        # Screen components
├── services/       # Business logic
├── types/          # TypeScript types
├── utils/          # Helper functions
└── navigation/     # Navigation config
\`\`\`

## Error Handling
- Use Error Boundaries for component errors
- Try-catch for all async operations
- Log errors with context for debugging

## Related Notes
- [[TypeScript Tips]]
- [[LocalOS Project]]

#development #react-native #best-practices
`,

  'Development/TypeScript Tips.md': `---
tags: [typescript, development, programming]
---

# TypeScript Tips

Useful TypeScript patterns and tricks.

## Type Guards

\`\`\`typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
\`\`\`

## Utility Types

- \`Partial<T>\`: Make all properties optional
- \`Required<T>\`: Make all properties required
- \`Pick<T, K>\`: Select specific properties
- \`Omit<T, K>\`: Exclude specific properties
- \`Record<K, V>\`: Create object type with key/value types
- \`ReturnType<T>\`: Extract function return type

## Generic Constraints

\`\`\`typescript
function getValue<T extends { id: string }>(obj: T): string {
  return obj.id;
}
\`\`\`

## Discriminated Unions

\`\`\`typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
\`\`\`

## Const Assertions

\`\`\`typescript
const config = {
  endpoint: '/api/v1',
  timeout: 3000,
} as const;
\`\`\`

## Exhaustive Switch
\`\`\`typescript
function assertNever(x: never): never {
  throw new Error('Unexpected value: ' + x);
}
\`\`\`

## Related Notes
- [[React Native Best Practices]]
- [[LocalOS Project]]

#typescript #development #programming
`,

  'Development/SQLite Mobile.md': `---
tags: [sqlite, react-native, database, development]
---

# Using SQLite in React Native

## Libraries
- **@op-engineering/op-sqlite**: Fastest, JSI-based
- **react-native-sqlite-storage**: Older, stable
- **expo-sqlite**: For Expo apps

## Best Practices
1. Use transactions for multiple writes
2. Create indexes on frequently queried columns
3. Avoid storing large blobs
4. Use prepared statements

## Schema Migration
Always version your schema and handle migrations gracefully:

\`\`\`typescript
const SCHEMA_VERSION = 2;

async function migrate(db, currentVersion) {
  if (currentVersion < 2) {
    await db.execute('ALTER TABLE...');
  }
}
\`\`\`

## FTS5 Full-Text Search

\`\`\`sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
  content,
  title,
  content='notes',
  content_rowid='id'
);
\`\`\`

## Vector Storage
Store embeddings as JSON arrays:
\`\`\`sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  content TEXT,
  embedding TEXT  -- JSON array
);
\`\`\`

## Related Notes
- [[LocalOS Project]]
- [[React Native Best Practices]]
`,

  'Learning/Vector Search.md': `---
title: Vector Search Overview
tags: [ai, embeddings, search, learning]
source: research
created: 2025-01-05T14:00:00Z
updated: 2025-01-20T16:45:00Z
---

# Vector Search

Vector search (also called semantic search) finds similar items based on **meaning** rather than exact keyword matches.

## How It Works

1. **Convert text to embeddings** (dense vectors)
   - Use a pre-trained model (e.g., sentence-transformers)
   - Similar texts have similar vectors

2. **Store vectors in a database**
   - SQLite, Pinecone, Weaviate, Qdrant

3. **Compare query vector to stored vectors**
   - Calculate similarity metrics, rank results

4. **Return most similar results** (top-k nearest neighbors)

## Similarity Metrics

### Cosine Similarity (Most Common)
\`similarity = (A · B) / (||A|| * ||B||)\`
Use for: Text search, document similarity

### Euclidean Distance
Use for: Image embeddings, spatial queries

## Embedding Models

| Model | Dimensions | Size | Use Case |
|-------|-----------|------|----------|
| all-MiniLM-L6-v2 | 384 | 23MB | General purpose |
| all-mpnet-base-v2 | 768 | 420MB | High quality |
| multilingual-e5-base | 768 | 560MB | Multi-language |

### For Mobile (LocalOS)
We use \`all-MiniLM-L6-v2\`: small (23MB), fast (~100-200ms), runs offline.

## Use Cases
- Semantic search in documents
- Recommendation systems
- RAG (Retrieval-Augmented Generation) for chatbots
- Duplicate detection

## Implementation in LocalOS
Using SQLite + cosine similarity. See [[Projects/LocalOS]] for details.

#ai #embeddings #search #vector-database
`,

  'Learning/AI Models.md': `---
tags: [ai, llm, models, learning]
importance: high
---

# Choosing the Right AI Model

## For Mobile Devices
- **1B-3B parameters**: Best for on-device inference
- **Quantization**: Q4_K_M offers good balance of size vs quality
- **Context length**: 2048-4096 tokens typical

## Popular Models for LocalOS

1. **Llama 3.2 1B** - Fast, good for chat
2. **Qwen 2.5 1B** - Excellent reasoning for size
3. **Phi-3 Mini** - Microsoft's efficient model
4. **Llama 3.2 3B** - Better quality, still fits in RAM
5. **Qwen 2.5 7B** - High quality, needs more RAM

## Considerations
- Model size vs available device RAM
- Inference speed requirements
- Task specialization (chat, coding, function calling)
- Context window size

## Quantization Formats

| Format | Size | Quality | Use When |
|--------|------|---------|----------|
| Q4_K_M | ~2GB (7B) | Good | General use |
| Q5_K_M | ~2.5GB | Better | More RAM available |
| Q8_0 | ~4GB | Best | Maximum quality |
| IQ2_XXS | ~1GB | OK | Very limited RAM |

## Tool Calling Support
- **Best**: Llama 3.x, Qwen 2.5 (native function calling)
- **Good**: Phi-3 (with prompting)
- **Limited**: Smaller 1B models (need examples in prompt)

## Embedding Models
For semantic search, use a separate small model:
- **all-MiniLM-L6-v2**: 23MB, fast, good quality
- Run alongside chat model (dual instance support)

## Related Notes
- [[Vector Search Overview]]
- [[LocalOS Project]]
`,

  'Meta/Obsidian Workflow.md': `---
tags: [obsidian, productivity, workflow]
type: meta
---

# My Obsidian Workflow

How I use Obsidian for personal knowledge management.

## Daily Notes
- Morning planning and goals
- Meeting notes throughout the day
- Evening reflection

## Project Notes
- One note per active project
- Link to related resources
- Track progress and next steps

## Permanent Notes
- Evergreen content that doesn't change
- Well-organized with tags
- Heavily linked to other notes

## Tags I Use
#fleeting - Quick captures
#permanent - Polished notes
#project - Active projects
#learning - Things I'm studying

## Folder Structure
\`\`\`
vault/
├── Daily/        # Daily notes
├── Projects/     # Active projects
├── Learning/     # Study notes
├── Development/  # Tech notes
├── Personal/     # Personal stuff
└── Meta/         # Vault meta-notes
\`\`\`

## Linking Strategy
- Link generously - every mention of a project/person gets linked
- Use aliases for natural language links
- Backlinks surface unexpected connections

## Weekly Review
Every Sunday:
1. Process inbox (fleeting notes)
2. Update project notes
3. Review goals progress
4. Archive completed projects

See also: [[Personal/Preferences|My Preferences]]
`,

  'Meetings/2025-Q1-Planning.md': `---
tags: [meeting, planning, q1]
type: meeting
date: 2025-01-10
---

# Q1 Planning Meeting - 2025

**Date:** January 10, 2025
**Attendees:** Team

## Key Decisions
1. Focus on memory system implementation
2. Launch beta by end of Q1
3. Weekly sprint cycles

## Action Items
- [ ] Complete Phase A (Vector DB) by Jan 20
- [ ] Design UI mockups by Jan 15
- [ ] Set up CI/CD pipeline
- [ ] Write technical spec for vault integration

## Notes
Team is excited about the Obsidian integration feature. Users will love having their chat history searchable.

Next meeting: Jan 17, 2025

See: [[Projects/LocalOS|LocalOS Project]]
`,
};

export class SampleVaultService {
  /**
   * Create all sample vault files on the device and set it as the active vault
   */
  static async createAndSetSampleVault(
    onProgress?: (message: string) => void,
  ): Promise<void> {
    try {
      onProgress?.('Creating sample vault directory...');

      // Remove existing sample vault if present
      const exists = await RNFS.exists(SAMPLE_VAULT_DIR);
      if (exists) {
        await RNFS.unlink(SAMPLE_VAULT_DIR);
        Logger.info('Removed existing sample vault');
      }

      // Write all files
      const entries = Object.entries(SAMPLE_FILES);
      for (let i = 0; i < entries.length; i++) {
        const [relativePath, content] = entries[i];
        const fullPath = `${SAMPLE_VAULT_DIR}/${relativePath}`;
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));

        const dirExists = await RNFS.exists(dirPath);
        if (!dirExists) {
          await RNFS.mkdir(dirPath);
        }

        await RNFS.writeFile(fullPath, content, 'utf8');
        onProgress?.(
          `Writing ${i + 1}/${entries.length}: ${relativePath.split('/').pop()}`,
        );
        Logger.info(`Wrote: ${relativePath}`);
      }

      onProgress?.('Setting vault as active...');
      await VaultService.setActiveVault(SAMPLE_VAULT_DIR);

      onProgress?.('Indexing vault for semantic search...');
      await VaultIndexService.indexFullVault(msg => onProgress?.(msg));

      Logger.info(`Sample vault created with ${entries.length} files`);
    } catch (error) {
      Logger.error('Failed to create sample vault:', error);
      throw error;
    }
  }

  static get vaultPath(): string {
    return SAMPLE_VAULT_DIR;
  }

  static get fileCount(): number {
    return Object.keys(SAMPLE_FILES).length;
  }
}
