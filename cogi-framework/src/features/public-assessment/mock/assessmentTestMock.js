export const assessmentMockTests = {
  secondary: {
    code: 'secondary',
    title: 'Secondary English Level Check',
    gradeRange: 'Lớp 6–9',
    estimatedMinutes: '20–30 phút',
    sections: [
      {
        code: 'listening',
        title: 'Listening',
        instructions: 'Hãy nghe kỹ đoạn âm thanh và chọn câu trả lời phù hợp.',
        suggestedMinutes: 5,
        questions: [
          {
            id: 'l1',
            type: 'single_choice',
            prompt: 'What is the speaker mainly talking about?',
            audioKey: 'listening-demo',
            maxPlays: 2,
            options: [
              { value: 'a', label: 'A school trip' },
              { value: 'b', label: 'A birthday party' },
              { value: 'c', label: 'A family dinner' },
            ],
          },
          {
            id: 'l2',
            type: 'single_choice',
            prompt: 'Where will the students meet?',
            audioKey: 'listening-demo',
            maxPlays: 2,
            options: [
              { value: 'a', label: 'At the school gate' },
              { value: 'b', label: 'At the bus stop' },
              { value: 'c', label: 'In the library' },
            ],
          },
          {
            id: 'l3',
            type: 'single_choice',
            prompt: 'What should the students bring?',
            audioKey: 'listening-demo',
            maxPlays: 2,
            options: [
              { value: 'a', label: 'A notebook' },
              { value: 'b', label: 'A lunch box' },
              { value: 'c', label: 'A camera' },
            ],
          },
        ],
      },
      {
        code: 'reading',
        title: 'Reading',
        instructions: 'Đọc kỹ đoạn văn rồi chọn hoặc nhập câu trả lời phù hợp.',
        suggestedMinutes: 7,
        passage: 'Mai is 13 years old. She lives in Hanoi with her family. Every morning, she goes to school by bus. After school, she often helps her mother cook dinner and then studies English online for one hour. On weekends, she enjoys visiting her grandparents and reading story books.',
        questions: [
          {
            id: 'r1',
            type: 'single_choice',
            prompt: 'How does Mai go to school?',
            options: [
              { value: 'a', label: 'By bicycle' },
              { value: 'b', label: 'By bus' },
              { value: 'c', label: 'On foot' },
            ],
          },
          {
            id: 'r2',
            type: 'multiple_choice',
            prompt: 'Which activities does Mai do after school?',
            options: [
              { value: 'help_cook', label: 'Helps her mother cook dinner' },
              { value: 'play_game', label: 'Plays computer games' },
              { value: 'study_online', label: 'Studies English online' },
              { value: 'swim', label: 'Goes swimming' },
            ],
          },
          {
            id: 'r3',
            type: 'short_text',
            prompt: 'How long does Mai study English online each day?',
            placeholder: 'Nhập câu trả lời ngắn',
          },
        ],
      },
      {
        code: 'language',
        title: 'Language in Use',
        instructions: 'Chọn đáp án đúng hoặc hoàn thành câu với câu trả lời ngắn.',
        suggestedMinutes: 7,
        questions: [
          {
            id: 'g1',
            type: 'single_choice',
            prompt: 'Choose the correct sentence.',
            options: [
              { value: 'a', label: 'She don\'t like apples.' },
              { value: 'b', label: 'She doesn\'t like apples.' },
              { value: 'c', label: 'She isn\'t like apples.' },
            ],
          },
          {
            id: 'g2',
            type: 'single_choice',
            prompt: 'Choose the best word to complete the sentence: My brother is interested ___ science.',
            options: [
              { value: 'a', label: 'on' },
              { value: 'b', label: 'in' },
              { value: 'c', label: 'at' },
            ],
          },
          {
            id: 'g3',
            type: 'multiple_choice',
            prompt: 'Select all words that are adjectives.',
            options: [
              { value: 'a', label: 'beautiful' },
              { value: 'b', label: 'run' },
              { value: 'c', label: 'careful' },
              { value: 'd', label: 'teacher' },
            ],
          },
          {
            id: 'g4',
            type: 'short_text',
            prompt: 'Complete the sentence with one word: Yesterday, we ___ to the museum.',
            placeholder: 'Nhập 1 từ',
          },
        ],
      },
      {
        code: 'writing',
        title: 'Writing',
        instructions: 'Viết một đoạn văn ngắn để thể hiện khả năng diễn đạt của bạn.',
        suggestedMinutes: 10,
        questions: [
          {
            id: 'w1',
            type: 'long_text',
            prompt: 'Write about a memorable day at school. Write about 80–100 words.',
            minWords: 80,
            suggestedWords: 100,
            placeholder: 'Viết câu trả lời của bạn tại đây...',
          },
        ],
      },
    ],
  },
}

export function getMockAssessmentTest(testCode) {
  return assessmentMockTests[String(testCode || '').trim()] || null
}
