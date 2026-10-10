# Interview Practice Tracker

A responsive dashboard to track weekly interview preparation: DSA problems, Git questions and full-stack technical questions, plus the machine-coding task. Built for Sheryians Coding School, Sheet 01 (Frontend Machine Coding Round).

**Live demo:** _add your deployed link here_
**Demo video:** _add your 1-2 minute video link here_

## Features

- **Dashboard**: total questions, completed DSA problems, completed interview questions (Git + Technical), and a machine-coding status you can set (Pending / In Progress / Completed).
- **Progress**: a large completion percentage, a progress strip with one block per question (coloured by status), and a per-category bar for DSA, Git and Technical.
- **Question tracker**: add, edit and delete questions with category, difficulty and status. Change a status straight from the list. Deleting shows an Undo.
- **Search and filters**: search by text, and filter by category, status and difficulty. Filters combine, and "Clear filters" resets them.
- **Persistence**: everything is stored in LocalStorage and survives a refresh. Stored data is validated when loaded.
- **States**: empty state (with a one-click "Load Sheet 01 questions"), no-results state, and form validation.
- **Responsive**: desktop rows become stacked cards on mobile, and the add/edit dialog becomes a bottom sheet.
- **Extras**: light/dark theme (remembers your choice), keyboard friendly, visible focus, reduced-motion respected.

## Tech

HTML, CSS and vanilla JavaScript. No framework, no build step, no backend.

## Run locally

1. Clone the repo.
2. Open `index.html` in a browser (double-click works), or serve the folder:
   ```bash
   npx serve .
   ```

## Deploy

The site is static, so any static host works.

- **GitHub Pages**: repo Settings > Pages > Deploy from branch > `main` / root.
- **Netlify**: drag and drop the folder at app.netlify.com/drop.
- **Vercel**: `npx vercel` in the folder, or import the repo.

## Project structure

```
index.html   page structure, dialog markup
styles.css   design tokens (light/dark), layout, components
app.js       state, LocalStorage, render functions, events
```

How `app.js` is organised: constants and sample data, storage helpers, state with selectors (`computeStats`, `visibleQuestions`), render functions (`renderHero`, `renderStats`, `renderChips`, `renderList`), dialog and validation, then event wiring. Every change updates state, saves it, and re-renders from state.

## Data model

```js
{ id: string, title: string, category: 'DSA' | 'Git' | 'Technical',
  difficulty: 'Easy' | 'Medium' | 'Hard',
  status: 'Pending' | 'In Progress' | 'Completed' }
```

Keys in LocalStorage: `ipt.questions.v1`, `ipt.machine.v1`, `ipt.theme.v1`.

## Assumptions

- Completion percentage = completed questions / all stored questions. "In Progress" does not count as complete.
- "Interview questions" means the Git and Technical categories together.
- Machine-coding status is a separate setting because the question form only has the DSA, Git and Technical categories.
- Titles are trimmed, need at least 3 characters, and cannot repeat inside the same category.
- User text is rendered with `textContent`, never `innerHTML`, so it cannot inject HTML.

## Ideas for improvement

- Notes or a link per question, due dates, and a weekly history.
- Export and import as JSON.
- Move to React with `useReducer` and a custom `useLocalStorage` hook.
- Unit tests for the selectors.
