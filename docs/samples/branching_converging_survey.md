# Branching and Converging Survey

## Description
This survey is a positive test fixture for Markdown import and schema generation flows that need to exercise non-linear survey logic. It includes an early screener branch, two middle paths that merge back into a shared section, and two different terminal outcomes.

## Goal
Verify that the wizard can produce a Researvo schema with conditional branches, a mid-survey merge point, and separate ending nodes for eligible and ineligible respondents.

## Flow Outline
1. Consent is required before the respondent can continue.
2. Respondents who are not eligible for the study go directly to the ineligible ending.
3. Eligible respondents split into creator and non-creator paths.
4. Creator and non-creator paths merge into the same satisfaction question.
5. Respondents with very low satisfaction branch to a follow-up about blockers, then return to the shared final research question.
6. All eligible respondents finish at the eligible completion ending.

## Questions
1. Do you consent to participate in this anonymous product research survey?
   - Yes, I consent
   - No, I do not consent

   Branching:
   - If "No, I do not consent", go to Ending A: Ineligible or opted out.
   - If "Yes, I consent", continue to Question 2.

2. Are you at least 18 years old and currently involved in survey, research, product, design, or analytics work?
   - Yes
   - No

   Branching:
   - If "No", go to Ending A: Ineligible or opted out.
   - If "Yes", continue to Question 3.

3. Which best describes your recent relationship with survey creation?
   - I created or edited a survey in the last 30 days
   - I reviewed survey results but did not create a survey
   - I am evaluating tools but have not used one recently
   - None of these

   Branching:
   - If "I created or edited a survey in the last 30 days", go to Question 4A.
   - If "I reviewed survey results but did not create a survey", go to Question 4B.
   - If "I am evaluating tools but have not used one recently", go to Question 4B.
   - If "None of these", go to Ending A: Ineligible or opted out.

4A. What was the hardest part of creating or editing your most recent survey? Select all that apply.
   - Writing unbiased questions
   - Designing branch logic
   - Defining variables and coding
   - Previewing the respondent experience
   - Publishing or sharing the survey
   - Exporting clean data
   - Something else

   Merge:
   - After this question, go to Question 5.

4B. What would make you more confident reviewing or choosing a survey tool? Select all that apply.
   - Clear validation warnings
   - A visual flow map
   - Strong data export support
   - Templates for common research designs
   - Collaboration or review controls
   - Privacy and consent controls
   - Something else

   Merge:
   - After this question, go to Question 5.

5. How satisfied are you with your current survey workflow? Use a 1 to 5 scale where 1 means very dissatisfied, 3 means neutral, and 5 means very satisfied.

   Branching:
   - If the answer is 1 or 2, go to Question 6.
   - If the answer is 3, 4, or 5, skip to Question 7.

6. What is the main blocker behind that low satisfaction?
   - It takes too long to build surveys
   - The logic is hard to verify
   - Data exports are messy
   - Research quality is hard to maintain
   - Stakeholder review is slow
   - Other

   Merge:
   - After this question, go to Question 7.

7. What is one improvement that would most increase your trust in the survey creation workflow?

   Completion:
   - After this question, go to Ending B: Eligible completion.

## Ending A: Ineligible or opted out
Thank you. Based on your answers, this survey is now complete and no research responses are needed.

## Ending B: Eligible completion
Thank you for completing the study. Your anonymous responses will be used to improve the survey creation workflow.

## Constraints
Do not collect names, email addresses, phone numbers, organization names, account IDs, street addresses, or other directly identifying information. The consent question and eligibility screener should be required. Research questions after eligibility may be optional unless they are required for branch logic.
