# How to Run the Application

## Prerequisites
- Node.js v22 or higher
- npm (comes with Node.js)

## Installation

1. Install dependencies for the entire project:
   ```
   npm run install:all
   ```

   Or install manually:
   ```
   npm install
   cd frontend && npm install && cd ..
   cd backend && npm install && cd ..
   ```

## Running the Application

### Test Mode (30 vacancies)
1. Make sure `.env.test` is configured:
   ```
   TEST_MODE=true
   RESUME_ID=1
   VACANCY_COUNT=30
   ```

2. Run in test mode:
   ```
   npm run dev
   ```

### Production Mode (Customizable vacancies count)
You can choose how many vacancies to parse: 50, 300, 700, or 1000.

1. Configure `.env.production`:
   ```
   TEST_MODE=false
   RESUME_ID=1
   VACANCY_COUNT=50
   ```

2. Or use the convenient script `SET_VACANCY_COUNT.bat` to choose:
   - Double-click on `SET_VACANCY_COUNT.bat` and select your preferred count

3. Run in production mode:
   ```
   npm start
   ```

## How It Works

The application works in 3 phases:

1. **Parsing Phase** - Collects vacancies from all regions worldwide
2. **Rating Phase** - Sorts vacancies by relevance score
3. **Applying Phase** - Sends applications to the most relevant vacancies

## Features Implemented

- ✅ Parses customizable number of vacancies (50/300/700/1000) from all regions worldwide
- ✅ Improved parsing speed with optimized delays
- ✅ Better relevance filtering to get more suitable vacancies
- ✅ Fixed modal window handling for cover letters
- ✅ Enhanced international vacancy support
- ✅ Correct UI phase display
- ✅ Resume-based search support

## Troubleshooting

If you encounter any issues:

1. Make sure you're logged into HH.ru in the browser that opens
2. Check that your resume is properly configured on HH.ru
3. Ensure you have a stable internet connection
4. If the application crashes, restart and try again

## Configuration

You can configure multiple resumes in `backend/src/config/index.js` under the `resumes` array.