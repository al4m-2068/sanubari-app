import { create } from "zustand";
import { persist } from "zustand/middleware";

const MOCK_USERS = [
  {
    id: 1,
    name: {
      first: 'Albar',
      last: 'Abdul Malik',
    },
    email: 'albar2806@student.abudzar.sch.id',
    password: '12345678',
    birthDate: '2010-06-28',
    profilePicture: '/albar.png',
    measurementData: [
      { date: '2026-10-05T14:00:00.000Z', bpm: 102 },
      { date: '2026-10-04T14:20:00.000Z', bpm: 62 },
      { date: '2026-10-03T14:10:00.000Z', bpm: 63 },
      { date: '2026-10-02T14:17:00.000Z', bpm: 61 },
      { date: '2026-10-01T14:15:00.000Z', bpm: 20 },
    ],
    chatData: [
      {chatId: 'almakraimfahit09837723', topic: 'Best thing to maintain after using lorem ipsum', chatContent: [
        {talkId: 1, question: 'What is the best thing to maintain after using lorem ipsum?', answer: {text: 'A lorem ipsum should be maintained carefully every lorem ipsum range of time.', images: []}},
        {talkId: 2, question: 'How long is using lorem ipsum allowed?', answer: {text: 'A lorem ipsum should not consumed more than lorem ipsum week.', images: null}},
      ]},
      {chatId: 'almakraimfahit09837893', topic: 'Best thing to maintainas after using lorem ipsum', chatContent: [
        {talkId: 1, question: 'What is the best thing to maintain after using lorem ipsum?', answer: {text: 'A lorem ipsum should be maintained carefully every lorem ipsum range of time.', images: []}},
        {talkId: 2, question: 'How long is using lorem ipsum allowed?', answer: {text: 'A lorem ipsum should not consumed more than lorem ipsum week.', images: ['https://assets-a1.kompasiana.com/items/album/2021/09/08/koe-no-katachi-netflix-1200-6138792e010190577f651952.jpg', '/src/assets/images/DSC05019.JPG']}},
      ]},
      {chatId: 'almakraimfahit09837763', topic: 'Best thing to maintain after using lorem ipsum', chatContent: [
        {talkId: 1, question: 'What is the best thing to maintain after using lorem ipsum?', answer: {text: 'A lorem ipsum should be maintained carefully every lorem ipsum range of time.', images: []}},
        {talkId: 2, question: 'How long is using lorem ipsum allowed?', answer: {text: 'A lorem ipsum should not consumed more than lorem ipsum week.', images: ['https://assets-a1.kompasiana.com/items/album/2021/09/08/koe-no-katachi-netflix-1200-6138792e010190577f651952.jpg', 'https://m.media-amazon.com/images/M/MV5BYWMxYmU3NmItYTczZS00NWJkLWJjNzQtOTk2YTI1ZDAyNWQzXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg']}},
      ]},
    ]
  }
]

export const useSariAuthStore = create(
  // persist(
    (set) => ({
      user: MOCK_USERS[0],
      error: null,

      login: (email, password) => {
        const foundUser = MOCK_USERS.find(u => {
          u.email == email && u.password == password
        })

        if (foundUser) {
          set({
            user: foundUser,
            error: null
          })
          return true
        } else {
          set({
            error: 'Akun tidak ditemukan'
          })
          return false
        }
      },
      logout: set({ user: null, error: null }),
    }),
  //   {
  //     name: 'sari-auth'
  //   }
  // // )
)